import os
import cv2
import time
import requests
import psycopg2 
import threading
import logging
import queue
from datetime import datetime
from ultralytics import YOLO
from dotenv import load_dotenv
from flask import Flask, jsonify, request, Response
from flask_cors import CORS

# ==================== 1. 初始化與設定 ====================
load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)
app = Flask(__name__)
CORS(app, origins=['http://localhost:8080'], supports_credentials=True)

MODEL_PATH = os.getenv('MODEL_PATH')
DATABASE_URL = os.getenv('DATABASE_URL')
LPR_API_URL = os.getenv('LPR_API_URL')

# 全域變數管理
global_cap = None
no_helmet_model = None
stop_detection_flag = True

# 執行緒安全的佇列和鎖
frame_queue = queue.Queue(maxsize=2) # 生產者 -> 推理執行緒
producer_thread = None
logic_thread = None
inference_thread = None # 【新增】推理執行緒

# 【新增】共享的最新結果 (受鎖保護)
latest_frame = None
latest_results = None
data_lock = threading.Lock()

# 常數設定
NO_HELMET_CLASS_NAME = 'no-helmet' 
CONFIDENCE_THRESHOLD = 0.65 # 用於判斷違規的信心度
VISUAL_CONFIDENCE = 0.4 # 用於畫面上顯示的信心度
SCREENSHOT_PATH = "successful_detections"
EXPAND_DOWN_FACTOR = 15.0  # 大幅增加向下擴展，確保包含車牌
EXPAND_SIDES_FACTOR = 8.0   # 增加左右擴展，確保完整車輛

if not os.path.exists(SCREENSHOT_PATH):
    os.makedirs(SCREENSHOT_PATH)

# ==================== 2. 輔助函式 (保持不變) ====================
def call_lpr_api(image_data):
    try:
        _, img_encoded = cv2.imencode('.jpg', image_data)
        files = {'file': ('violation.jpg', img_encoded.tobytes(), 'image/jpeg')}
        response = requests.post(LPR_API_URL, files=files, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            if 'data' in result and result['data'] is not None:
                return result['data']
        elif response.status_code == 404:
            return None
        else:
            logging.error(f"API 請求錯誤，狀態碼: {response.status_code}, 回應: {response.text}")
            return None
    except requests.exceptions.RequestException as e:
        logging.error(f"呼叫 API 時發生網路錯誤: {e}")
        return None

def save_to_database(owner_info, image_path):
    """
    將違規資料存入資料庫，並回傳新紀錄的完整資料以供廣播。
    """
    sql = """
        INSERT INTO violations (
            license_plate, owner_name, owner_phone, owner_email,
            owner_address, violation_type, violation_address,
            image_path, timestamp, fine
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) 
        RETURNING id, violation_type, license_plate, timestamp, status; 
    """
    # 【修改】在 SQL 語句最後加上 RETURNING，這會讓 INSERT 操作回傳指定欄位的值

    conn = None 
    try:
        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                timestamp_now = datetime.now() # 先產生一個時間戳，確保寫入和回傳的是同一個
                cur.execute(sql, (
                    owner_info.get('license_plate_number', 'N/A'),
                    owner_info.get('full_name', 'N/A'),
                    owner_info.get('phone_number', 'N/A'),
                    owner_info.get('email', 'N/A'),
                    owner_info.get('address', 'N/A'),
                    '未戴安全帽',
                    '高雄市燕巢區安招里安林路112號',
                    image_path,
                    timestamp_now,
                    800
                ))
                # 【修改】獲取 RETURNING 回傳的結果
                new_record = cur.fetchone() 
                if new_record:
                    # 【修改】將回傳的 tuple 格式化為字典
                    return {
                        'id': new_record[0],
                        'type': new_record[1],
                        'plateNumber': new_record[2],
                        'timestamp': new_record[3].isoformat() + 'Z', # 轉換為 ISO 格式並標示為 UTC
                        'status': new_record[4]
                    }
                return None # 如果沒有回傳結果，則返回 None

    except (Exception, psycopg2.DatabaseError) as error:
        logging.error(f"資料庫寫入錯誤: {error}")
        return None # 發生錯誤時返回 None
    finally:
        if conn is not None:
            conn.close()

def notify_violation(violation_data):
    """
    向另一個 Flask 應用程式的廣播 API 發送 POST 請求。
    """
    # 【關鍵】這裡是您另一個 Flask 應用程式 (包含 WebSocket) 的 URL
    notify_url = 'http://web_api:3002/notify/new-violation' # 使用容器服務名稱
    logging.info(f"🚀 準備發送通知到: {notify_url}")
    try:
        response = requests.post(notify_url, json=violation_data, timeout=3)
        if response.status_code == 200:
            logging.info(f"✅ 成功通知伺服器廣播新違規: {violation_data['plateNumber']}")
        else:
            logging.error(f"❌ 通知伺服器失敗，狀態碼: {response.status_code}, 回應: {response.text}")
    except requests.exceptions.RequestException as e:
        logging.error(f"❌ 呼叫廣播 API 時發生網路錯誤: {e}")

# ==================== 3. 核心偵測與串流邏輯  ====================

def frame_producer():
    """【生產者】不斷從攝影機讀取畫面，放入佇列。"""
    global stop_detection_flag, global_cap, frame_queue
    logging.info("影像生產者執行緒已啟動。")
    while not stop_detection_flag:
        if not (global_cap and global_cap.isOpened()):
            time.sleep(0.1)
            continue
        ret, frame = global_cap.read()
        if not ret:
            logging.warning("讀取影像幀失敗，來源可能已結束。")
            time.sleep(0.5)
            continue
        if not frame_queue.full():
            frame_queue.put(frame)
    logging.info("影像生產者執行緒已結束。")

def perform_inference():
    """【主廚】從佇列拿畫面，執行模型，將結果存入共享變數。"""
    global stop_detection_flag, no_helmet_model, frame_queue, latest_frame, latest_results, data_lock
    logging.info("模型推理執行緒已啟動。")
    while not stop_detection_flag:
        try:
            frame = frame_queue.get(timeout=1)
            results = no_helmet_model(frame, conf=VISUAL_CONFIDENCE, verbose=False)
            with data_lock:
                latest_frame = frame
                latest_results = results[0] # results is a list
        except queue.Empty:
            continue
    logging.info("模型推理執行緒已結束。")

def run_detection_logic():
    """
    【服務員1】從共享變數拿結果，判斷是否違規，並在成功後觸發資料庫儲存與即時通知。
    """
    global stop_detection_flag, latest_results, data_lock, latest_frame
    
    last_successful_detection_time = 0
    violation_cooldown = 2.0  # 每次成功偵測後的冷卻時間（秒），防止重複觸發
    
    logging.info("背景偵測邏輯執行緒已啟動。")

    while not stop_detection_flag:
        time.sleep(0.1)  # 降低此執行緒的 CPU 使用率，每 0.1 秒檢查一次即可

        # 使用 with data_lock: 安全地從共享變數中讀取最新畫面和結果
        with data_lock:
            if latest_frame is None or latest_results is None:
                continue  # 如果沒有新畫面或結果，就繼續等待
            
            # 複製一份到本地變數，以盡快釋放鎖，讓其他執行緒可以工作
            local_frame_copy = latest_frame.copy()
            local_results = latest_results
        
        current_time = time.time()
        
        # 檢查是否已超過冷卻時間，避免對同一個事件重複處理
        if current_time - last_successful_detection_time > violation_cooldown:
            frame_height, frame_width, _ = local_frame_copy.shape
            
            # 遍歷偵測到的所有物件框
            for box in local_results.boxes:
                # 只處理信心度高於我們設定的嚴格閾值的物件
                if box.conf[0] > CONFIDENCE_THRESHOLD:
                    class_name = no_helmet_model.names[int(box.cls[0])]
                    
                    # 判斷是否為我們關注的「未戴安全帽」類別
                    if class_name.lower() == NO_HELMET_CLASS_NAME.lower():
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        
                        # 擴大截圖範圍以包含更多上下文（例如車牌）
                        box_width = x2 - x1
                        box_height = y2 - y1
                        new_x1 = max(0, x1 - int(box_width * EXPAND_SIDES_FACTOR))
                        new_y1 = max(0, y1)
                        new_x2 = min(frame_width, x2 + int(box_width * EXPAND_SIDES_FACTOR))
                        new_y2 = min(frame_height, y2 + int(box_height * EXPAND_DOWN_FACTOR))
                        
                        # 截取擴大後的圖像區域
                        crop_img = local_frame_copy[new_y1:new_y2, new_x1:new_x2]
                        
                        if crop_img.size > 0:
                            # 呼叫 API 進行車牌辨識
                            owner_info = call_lpr_api(crop_img)
                            
                            if owner_info:
                                # 準備檔案名稱並儲存截圖
                                ts_str = time.strftime("%Y%m%d_%H%M%S")
                                filename = os.path.join(SCREENSHOT_PATH, f"success_{ts_str}.jpg")
                                cv2.imwrite(filename, crop_img)
                                
                                # === 【核心修改】 ===
                                # 1. 將資料存入資料庫，並接收回傳的完整新紀錄
                                new_violation_data = save_to_database(owner_info, filename)
                                
                                # 2. 如果資料庫寫入成功（有回傳資料），就呼叫通知函式
                                if new_violation_data:
                                    notify_violation(new_violation_data)
                                
                                # 更新最後成功時間以啟動冷卻計時
                                last_successful_detection_time = time.time()
                                
                                plate = owner_info.get('license_plate_number', 'N/A')
                                logging.info(f"成功偵測到違規 (車牌: {plate})，資料已寫入資料庫並發送通知。")
                                
                                # 處理完一筆違規後就跳出迴圈，等待下一次冷卻結束
                                break 

    logging.info("背景偵測邏輯執行緒已結束。")

def generate_frames():
    """【服務員2】從共享變數拿結果，快速畫框並串流。"""
    global stop_detection_flag, data_lock, latest_frame, latest_results
    while not stop_detection_flag:
        # 目標 30 FPS
        time.sleep(1/30) 
        with data_lock:
            if latest_frame is None or latest_results is None:
                continue
            frame_to_show = latest_frame.copy()
            results_to_show = latest_results

        for box in results_to_show.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            conf = box.conf[0]
            class_name = no_helmet_model.names[int(box.cls[0])]
            color = (0, 0, 255) if class_name.lower() == NO_HELMET_CLASS_NAME.lower() else (0, 255, 0)
            cv2.rectangle(frame_to_show, (x1, y1), (x2, y2), color, 2)
            label = f'{class_name} {conf:.2f}'
            cv2.putText(frame_to_show, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        (flag, encodedImage) = cv2.imencode(".jpg", frame_to_show)
        if not flag:
            continue
        yield(b'--frame\r\n' b'Content-Type: image/jpeg\r\n\r\n' + bytearray(encodedImage) + b'\r\n')

# ==================== 4. Flask API 端點 (修改) ====================
@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/start_detection', methods=['POST'])
def start_detection():
    global global_cap, no_helmet_model, stop_detection_flag, producer_thread, logic_thread, inference_thread
    
    if producer_thread and producer_thread.is_alive():
        return jsonify({"status": "fail", "message": "偵測已經在運行中。"}), 400

    data = request.get_json()
    video_path = data.get('video_path')
    if not video_path:
        return jsonify({"status": "fail", "message": "請提供 'video_path'。"}), 400

    if no_helmet_model is None:
        try:
            no_helmet_model = YOLO(MODEL_PATH)
            logging.info("YOLO 模型載入成功！")
        except Exception as e:
            return jsonify({"status": "fail", "message": f"模型載入失敗: {e}"}), 500

    try:
        capture_source = int(video_path) if video_path.isdigit() else video_path
        global_cap = cv2.VideoCapture(capture_source)
        if not global_cap.isOpened():
            raise IOError(f"無法開啟影像來源: {video_path}")
    except Exception as e:
        return jsonify({"status": "fail", "message": str(e)}), 400

    if isinstance(capture_source, int) and capture_source == 1:
        logging.info("偵測到使用外部相機(1)，等待 2 秒以確保連線穩定...")
        time.sleep(2)

    stop_detection_flag = False
    
    producer_thread = threading.Thread(target=frame_producer, daemon=True)
    inference_thread = threading.Thread(target=perform_inference, daemon=True) # 【新增】
    logic_thread = threading.Thread(target=run_detection_logic, daemon=True)
    
    producer_thread.start()
    inference_thread.start() # 【新增】
    logic_thread.start()
    
    logging.info(f"偵測任務開始，影像來源: '{video_path}'")
    return jsonify({"status": "success"})

@app.route('/stop_detection', methods=['POST'])
def stop_detection():
    global global_cap, stop_detection_flag, producer_thread, logic_thread, inference_thread, latest_frame, latest_results

    if not (producer_thread and producer_thread.is_alive()):
        return jsonify({"status": "fail", "message": "偵測並未在運行中。"}), 400
    
    logging.info("收到停止偵測的請求...")
    stop_detection_flag = True
    
    if producer_thread: producer_thread.join()
    if inference_thread: inference_thread.join() # 【新增】
    if logic_thread: logic_thread.join()
    
    if global_cap:
        global_cap.release()
        global_cap = None
        
    with frame_queue.mutex: frame_queue.queue.clear()
    with data_lock:
        latest_frame = None
        latest_results = None

    producer_thread, inference_thread, logic_thread = None, None, None
    
    logging.info("偵測已完全停止。")
    return jsonify({"status": "success", "message": "偵測已停止。"})

@app.route('/status', methods=['GET'])
def get_status():
    if producer_thread and producer_thread.is_alive():
        return jsonify({"status": "running", "message": "偵測正在運行中。"})
    else:
        return jsonify({"status": "stopped", "message": "偵測已停止。"})

# ==================== 5. 啟動伺服器 ====================
if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5001, debug=True, use_reloader=False)