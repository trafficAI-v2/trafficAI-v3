#!/usr/bin/env python3
"""
本地運行版本的安全帽檢測系統
直接在 macOS 主機上運行，可完美存取本地攝影機
"""

import os
import sys
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

# 設定環境變數檔案路徑
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

# ==================== 1. 初始化與設定 ====================
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)
app = Flask(__name__)
CORS(app, origins=['http://localhost:8080'], supports_credentials=True)

# 本地運行模式的路徑設定
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'halbest.pt')
DATABASE_URL = os.getenv('DATABASE_URL')
LPR_API_URL = "http://localhost:3001/recognize_plate"  # 本地模式使用 localhost

print(f"🔧 本地運行模式配置:")
print(f"   模型路徑: {MODEL_PATH}")
print(f"   資料庫: {'已配置' if DATABASE_URL else '未配置'}")
print(f"   車牌API: {LPR_API_URL}")

# 全域變數管理
global_cap = None
no_helmet_model = None
stop_detection_flag = True

# 執行緒安全的佇列和鎖
frame_queue = queue.Queue(maxsize=2)
producer_thread = None
logic_thread = None
inference_thread = None

# 共享的最新結果 (受鎖保護)
latest_frame = None
latest_results = None
data_lock = threading.Lock()

# 常數設定
NO_HELMET_CLASS_NAME = 'no-helmet'
CONFIDENCE_THRESHOLD = 0.65
VISUAL_CONFIDENCE = 0.4
SCREENSHOT_PATH = "successful_detections"
EXPAND_DOWN_FACTOR = 5.0
EXPAND_SIDES_FACTOR = 1.5

if not os.path.exists(SCREENSHOT_PATH):
    os.makedirs(SCREENSHOT_PATH)

# ==================== 2. 輔助函式 ====================
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
    if not DATABASE_URL:
        logging.warning("資料庫未配置，跳過資料儲存")
        return
        
    sql = """
        INSERT INTO violations (
            license_plate, owner_name, owner_phone, owner_email,
            owner_address, violation_type, violation_address,
            image_path, timestamp, fine
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    conn = None 
    try:
        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (
                    owner_info.get('license_plate_number', 'N/A'),
                    owner_info.get('full_name', 'N/A'),
                    owner_info.get('phone_number', 'N/A'),
                    owner_info.get('email', 'N/A'),
                    owner_info.get('address', 'N/A'),
                    '未戴安全帽',
                    '高雄市燕巢區安招里安林路112號',
                    image_path,
                    datetime.now(),
                    800
                ))
    except (Exception, psycopg2.DatabaseError) as error:
        logging.error(f"資料庫寫入錯誤: {error}")
    finally:
        if conn is not None:
            conn.close()

# ==================== 3. 核心偵測與串流邏輯 ====================
def frame_producer():
    global stop_detection_flag, global_cap, frame_queue
    logging.info("📹 影像生產者執行緒已啟動 (本地模式)")
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
    logging.info("📹 影像生產者執行緒已結束")

def perform_inference():
    global stop_detection_flag, no_helmet_model, frame_queue, latest_frame, latest_results, data_lock
    logging.info("🧠 模型推理執行緒已啟動 (本地模式)")
    while not stop_detection_flag:
        try:
            frame = frame_queue.get(timeout=1)
            results = no_helmet_model(frame, conf=VISUAL_CONFIDENCE, verbose=False)
            with data_lock:
                latest_frame = frame
                latest_results = results[0]
        except queue.Empty:
            continue
    logging.info("🧠 模型推理執行緒已結束")

def run_detection_logic():
    global stop_detection_flag, latest_results, data_lock, latest_frame
    last_successful_detection_time = 0
    violation_cooldown = 2.0
    logging.info("🔍 背景偵測邏輯執行緒已啟動 (本地模式)")
    
    while not stop_detection_flag:
        time.sleep(0.1)
        with data_lock:
            if latest_frame is None or latest_results is None:
                continue
            local_frame_copy = latest_frame.copy()
            local_results = latest_results
        
        current_time = time.time()
        if current_time - last_successful_detection_time > violation_cooldown:
            frame_height, frame_width, _ = local_frame_copy.shape
            for box in local_results.boxes:
                if box.conf[0] > CONFIDENCE_THRESHOLD:
                    class_name = no_helmet_model.names[int(box.cls[0])]
                    if class_name.lower() == NO_HELMET_CLASS_NAME.lower():
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        box_width = x2 - x1
                        box_height = y2 - y1
                        new_x1 = max(0, x1 - int(box_width * EXPAND_SIDES_FACTOR))
                        new_y1 = max(0, y1)
                        new_x2 = min(frame_width, x2 + int(box_width * EXPAND_SIDES_FACTOR))
                        new_y2 = min(frame_height, y2 + int(box_height * EXPAND_DOWN_FACTOR))
                        crop_img = local_frame_copy[new_y1:new_y2, new_x1:new_x2]
                        
                        if crop_img.size > 0:
                            owner_info = call_lpr_api(crop_img)
                            if owner_info:
                                ts_str = time.strftime("%Y%m%d_%H%M%S")
                                filename = os.path.join(SCREENSHOT_PATH, f"success_{ts_str}.jpg")
                                cv2.imwrite(filename, crop_img)
                                save_to_database(owner_info, filename)
                                last_successful_detection_time = time.time()
                                plate = owner_info.get('license_plate_number', 'N/A')
                                logging.info(f"✅ 成功偵測到違規 (車牌: {plate})，資料已寫入資料庫")
                                break 
    logging.info("🔍 背景偵測邏輯執行緒已結束")

def generate_frames():
    global stop_detection_flag, data_lock, latest_frame, latest_results
    while not stop_detection_flag:
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

# ==================== 4. Flask API 端點 ====================
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

    # 載入模型
    if no_helmet_model is None:
        try:
            if not os.path.exists(MODEL_PATH):
                return jsonify({"status": "fail", "message": f"模型檔案不存在: {MODEL_PATH}"}), 500
            no_helmet_model = YOLO(MODEL_PATH)
            logging.info("✅ YOLO 模型載入成功！(本地模式)")
        except Exception as e:
            return jsonify({"status": "fail", "message": f"模型載入失敗: {e}"}), 500

    # 嘗試開啟攝影機
    try:
        capture_source = int(video_path) if video_path.isdigit() else video_path
        global_cap = cv2.VideoCapture(capture_source)
        
        if not global_cap.isOpened():
            raise IOError(f"無法開啟影像來源: {video_path}")
            
        # 測試讀取一幀
        ret, test_frame = global_cap.read()
        if not ret:
            global_cap.release()
            raise IOError(f"攝影機 {video_path} 可以開啟但無法讀取畫面")
            
        logging.info(f"✅ 攝影機連線成功！解析度: {test_frame.shape[1]}x{test_frame.shape[0]}")
        
    except Exception as e:
        return jsonify({"status": "fail", "message": str(e)}), 400

    # 啟動執行緒
    stop_detection_flag = False
    producer_thread = threading.Thread(target=frame_producer, daemon=True)
    inference_thread = threading.Thread(target=perform_inference, daemon=True)
    logic_thread = threading.Thread(target=run_detection_logic, daemon=True)
    
    producer_thread.start()
    inference_thread.start()
    logic_thread.start()
    
    logging.info(f"🚀 偵測任務開始，影像來源: '{video_path}' (本地模式)")
    return jsonify({"status": "success"})

@app.route('/stop_detection', methods=['POST'])
def stop_detection():
    global global_cap, stop_detection_flag, producer_thread, logic_thread, inference_thread, latest_frame, latest_results

    if not (producer_thread and producer_thread.is_alive()):
        return jsonify({"status": "fail", "message": "偵測並未在運行中。"}), 400
    
    logging.info("🛑 收到停止偵測的請求...")
    stop_detection_flag = True
    
    if producer_thread: producer_thread.join()
    if inference_thread: inference_thread.join()
    if logic_thread: logic_thread.join()
    
    if global_cap:
        global_cap.release()
        global_cap = None
        
    with frame_queue.mutex: frame_queue.queue.clear()
    with data_lock:
        latest_frame = None
        latest_results = None

    producer_thread, inference_thread, logic_thread = None, None, None
    
    logging.info("✅ 偵測已完全停止 (本地模式)")
    return jsonify({"status": "success", "message": "偵測已停止。"})

@app.route('/status', methods=['GET'])
def get_status():
    if producer_thread and producer_thread.is_alive():
        return jsonify({"status": "running", "message": "偵測正在運行中 (本地模式)。"})
    else:
        return jsonify({"status": "stopped", "message": "偵測已停止 (本地模式)。"})

@app.route('/test_camera', methods=['POST'])
def test_camera():
    """測試攝影機連線狀態"""
    data = request.get_json()
    video_path = data.get('video_path')
    if not video_path:
        return jsonify({"status": "fail", "message": "請提供 'video_path'。"}), 400
    
    try:
        capture_source = int(video_path) if video_path.isdigit() else video_path
        test_cap = cv2.VideoCapture(capture_source)
        
        if test_cap.isOpened():
            ret, frame = test_cap.read()
            test_cap.release()
            
            if ret and frame is not None:
                height, width = frame.shape[:2]
                return jsonify({
                    "status": "success", 
                    "message": f"攝影機 {video_path} 連線成功 (本地模式)",
                    "resolution": f"{width}x{height}",
                    "source_type": "本地攝影機"
                })
            else:
                return jsonify({
                    "status": "fail", 
                    "message": f"攝影機 {video_path} 可以開啟但無法讀取畫面"
                }), 400
        else:
            test_cap.release()
            return jsonify({
                "status": "fail", 
                "message": f"無法連線到攝影機: {video_path}"
            }), 400
            
    except Exception as e:
        return jsonify({"status": "fail", "message": f"測試失敗: {str(e)}"}), 500

# ==================== 5. 啟動伺服器 ====================
if __name__ == "__main__":
    print("🎬 交通 AI 系統 - 本地運行模式")
    print("=" * 50)
    print("📹 攝影機存取模式：本地直連 (繞過 Docker 限制)")
    print("🌐 API 服務端口：5001")
    print("🔧 模型路徑：", MODEL_PATH)
    print("=" * 50)
    
    # 檢查模型檔案
    if not os.path.exists(MODEL_PATH):
        print(f"❌ 錯誤：找不到模型檔案 {MODEL_PATH}")
        print(f"請確保 halbest.pt 檔案在 {os.path.dirname(__file__)} 目錄中")
        sys.exit(1)
    
    # 測試攝影機
    print("🔍 正在測試攝影機存取...")
    test_cap = cv2.VideoCapture(0)
    if test_cap.isOpened():
        ret, frame = test_cap.read()
        if ret:
            print(f"✅ 攝影機 0 可用，解析度: {frame.shape[1]}x{frame.shape[0]}")
        test_cap.release()
    else:
        print("⚠️  攝影機 0 無法存取，您仍可以嘗試其他索引")
    
    print("\n🚀 啟動 Flask 伺服器...")
    print("📱 前端請訪問: http://localhost:8080")
    print("🔧 API 端點: http://localhost:5001")
    print("按 Ctrl+C 停止服務\n")
    
    app.run(host='0.0.0.0', port=5001, debug=True, use_reloader=False)