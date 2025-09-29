#!/usr/bin/env python3
"""
本地運行版本的安全帽與機車超載檢測系統 - 雙功能整合最終版
直接在 macOS 主機上運行，可完美存取本地攝影機
整合了複合式違規偵測邏輯，並進行了性能優化
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
import base64
from datetime import datetime
from ultralytics import YOLO
from dotenv import load_dotenv
from flask import Flask, jsonify, request, Response
from flask_cors import CORS

# 設定環境變數檔案路徑
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

# ==================== 1. 初始化與設定 (已整合) ====================
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)
app = Flask(__name__)
CORS(app, origins=['http://localhost:8080'], supports_credentials=True)

# --- 模型路徑設定 (整合) ---
HELMATE_MODEL_PATH = os.getenv('HELMATE_MODEL_PATH')
MOT_MODEL_PATH = os.getenv('MOT_MODEL_PATH')

DATABASE_URL = os.getenv('DATABASE_URL')
LPR_API_URL = "http://localhost:3001/recognize_plate"
WEB_API_URL = "http://localhost:3002"

print(f"⚡ 雙功能整合運行模式配置 (複合式違規版):")
print(f"   安全帽模型: {HELMATE_MODEL_PATH}")
print(f"   機車模型: {MOT_MODEL_PATH}")
print(f"   資料庫: {'已配置' if DATABASE_URL else '未配置'}")
print(f"   車牌API: {LPR_API_URL}")
print(f"   Web API: {WEB_API_URL}")

# 全域變數管理
global_cap = None
helmet_model = None
mot_model = None
stop_detection_flag = True

# 執行緒安全的佇列和鎖
frame_queue = queue.Queue(maxsize=1)
producer_thread = None
logic_thread = None
inference_thread = None

# 共享的最新結果 (受鎖保護)
latest_frame = None
latest_results = None # 將儲存一個字典: {'helmet': results, 'mot': results}
data_lock = threading.Lock()

# --- 常數設定 (整合) ---
# 安全帽相關
NO_HELMET_CLASS_NAME = 'no-helmet'
PERSON_CLASS_NAMES = ['helmet', 'no-helmet'] # 用於關聯機車與騎士

# 機車超載相關
MOTORCYCLE_CLASS_ID = 0 # 根據您的 motorcycle-best.pt 模型設定
ROI_UPSCALE_FACTOR = 0.8  # 機車上方感興趣區域的擴展比例

# 通用設定
CONFIDENCE_THRESHOLD = 0.65
VISUAL_CONFIDENCE = 0.5
SCREENSHOT_PATH = "successful_detections"

# 性能優化參數
TARGET_FPS = 15
FRAME_SKIP = 2
RESIZE_WIDTH = 640
DISPLAY_WIDTH = 1024

if not os.path.exists(SCREENSHOT_PATH):
    os.makedirs(SCREENSHOT_PATH)

# ==================== 2. 輔助函式 (已升級) ====================
def call_lpr_api(image_data):
    try:
        api_start_time = time.time()
        _, img_encoded = cv2.imencode('.jpg', image_data, [cv2.IMWRITE_JPEG_QUALITY, 65])
        files = {'file': ('violation.jpg', img_encoded.tobytes(), 'image/jpeg')}
        response = requests.post(
            LPR_API_URL, 
            files=files, 
            timeout=5,
            headers={'Connection': 'close'}
        )
        api_duration = time.time() - api_start_time
        if response.status_code == 200:
            result = response.json()
            if 'data' in result and result['data'] is not None:
                logging.info(f"🚗 車牌識別成功，耗時: {api_duration:.3f}s")
                return result['data']
        return None
    except requests.exceptions.RequestException as e:
        logging.error(f"呼叫車牌 API 時發生網路錯誤: {e}")
        return None

def save_to_database(owner_info, image_path, violation_type, fine):
    """
    將單筆違規資料存入資料庫 (通用版本)，並回傳新紀錄以供廣播。
    """
    if not DATABASE_URL:
        logging.warning("資料庫未配置，跳過資料儲存")
        return None
    
    image_data = None
    try:
        if image_path and os.path.exists(image_path):
            with open(image_path, 'rb') as image_file:
                image_data = base64.b64encode(image_file.read()).decode('utf-8')
    except Exception as e:
        logging.error(f"❌ 讀取圖片檔案失敗: {e}")
    
    sql = """
        INSERT INTO violations (
            license_plate, owner_name, owner_phone, owner_email,
            owner_address, violation_type, violation_address,
            image_path, image_data, timestamp, fine
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) 
        RETURNING id, violation_type, license_plate, timestamp, status; 
    """
    try:
        with psycopg2.connect(DATABASE_URL, connect_timeout=3) as conn:
            with conn.cursor() as cur:
                timestamp_now = datetime.now()
                cur.execute(sql, (
                    owner_info.get('license_plate_number', 'N/A'),
                    owner_info.get('full_name', 'N/A'),
                    owner_info.get('phone_number', 'N/A'),
                    owner_info.get('email', 'N/A'),
                    owner_info.get('address', 'N/A'),
                    violation_type,
                    '高雄市燕巢區安招里安林路112號',
                    image_path,
                    image_data,
                    timestamp_now,
                    fine
                ))
                new_record = cur.fetchone()
                conn.commit()
                
                if new_record:
                    result = {
                        'id': new_record[0], 'type': new_record[1], 'plateNumber': new_record[2],
                        'timestamp': new_record[3].isoformat() + 'Z', 'status': new_record[4]
                    }
                    logging.info(f"💾 資料庫寫入成功 ({violation_type})")
                    return result
    except Exception as error:
        logging.error(f"資料庫寫入錯誤: {error}")
        return None

def notify_violation(violation_data):
    notify_url = f'{WEB_API_URL}/notify/new-violation'
    try:
        response = requests.post(notify_url, json=violation_data, timeout=3)
        if response.status_code == 200:
            logging.info(f"✅ 成功通知伺服器廣播新違規: {violation_data['plateNumber']}")
        else:
            logging.error(f"❌ 通知伺服器失敗，狀態碼: {response.status_code}")
    except requests.exceptions.RequestException as e:
        logging.error(f"❌ 呼叫廣播 API 時發生網路錯誤: {e}")

# ==================== 3. 核心偵測與串流邏輯 (已升級) ====================
def frame_producer():
    global stop_detection_flag, global_cap, frame_queue
    logging.info("📹 影像生產者執行緒已啟動")
    frame_count = 0
    while not stop_detection_flag:
        if not (global_cap and global_cap.isOpened()):
            time.sleep(0.1); continue
        ret, frame = global_cap.read()
        if not ret:
            time.sleep(0.1); continue
        frame_count += 1
        if frame_count % FRAME_SKIP != 0:
            continue
        height, width = frame.shape[:2]
        if width > RESIZE_WIDTH:
            scale = RESIZE_WIDTH / width
            frame = cv2.resize(frame, (RESIZE_WIDTH, int(height * scale)))
        try:
            frame_queue.put_nowait(frame)
        except queue.Full:
            try:
                frame_queue.get_nowait()
                frame_queue.put_nowait(frame)
            except queue.Empty: pass
    logging.info("📹 影像生產者執行緒已結束")

def perform_inference():
    global stop_detection_flag, helmet_model, mot_model, frame_queue, latest_frame, latest_results, data_lock
    logging.info("🧠 雙模型推理執行緒已啟動")
    while not stop_detection_flag:
        try:
            frame = frame_queue.get(timeout=1)
            helmet_results = helmet_model(frame, conf=0.3, verbose=False, imgsz=416)
            mot_results = mot_model(frame, conf=0.3, verbose=False, imgsz=416)
            with data_lock:
                latest_frame = frame
                latest_results = {'helmet': helmet_results[0], 'mot': mot_results[0]}
        except queue.Empty: continue
        except Exception as e: logging.error(f"推理錯誤: {e}")
    logging.info("🧠 模型推理執行緒已結束")

def process_multiple_violations(crop_img, violations_list):
    """
    異步處理單一車輛的多重違規事件。
    """
    if not violations_list: return
    logging.info(f"🚗 偵測到複合事件，開始進行車牌辨識...")
    owner_info = call_lpr_api(crop_img)
    if not owner_info:
        logging.info("❌ 車牌識別失敗，無法處理此事件中的任何違規。")
        return
    ts_str = time.strftime("%Y%m%d_%H%M%S")
    plate = owner_info.get('license_plate_number', 'UNKNOWN')
    filename = os.path.join(SCREENSHOT_PATH, f"event_{plate}_{ts_str}.jpg")
    cv2.imwrite(filename, crop_img)
    logging.info(f"📸 事件圖片已保存至: {filename}")
    logging.info(f"💾 準備將 {len(violations_list)} 項違規寫入資料庫...")
    for violation in violations_list:
        new_violation_data = save_to_database(
            owner_info, filename, violation['type'], violation['fine']
        )
        if new_violation_data:
            notify_violation(new_violation_data)

def run_detection_logic():
    global stop_detection_flag, latest_results, data_lock, latest_frame
    last_successful_detection_time = 0
    violation_cooldown = 3.0
    logging.info("🔍 整合偵測邏輯執行緒已啟動 (邏輯修正版)")
    
    while not stop_detection_flag:
        time.sleep(0.2)
        with data_lock:
            if latest_frame is None or latest_results is None: continue
            local_frame_copy = latest_frame.copy()
            local_results = latest_results
        
        current_time = time.time()
        if current_time - last_successful_detection_time < violation_cooldown: continue
        
        # --- 步驟 1: 整理所有偵測到的物件 ---
        moto_boxes = []
        person_detections = []

        if 'mot' in local_results:
            for box in local_results['mot'].boxes:
                if int(box.cls[0]) == MOTORCYCLE_CLASS_ID and box.conf[0] > CONFIDENCE_THRESHOLD:
                    moto_boxes.append(box.xyxy[0].cpu().numpy())

        if 'helmet' in local_results:
            for box in local_results['helmet'].boxes:
                class_name = helmet_model.names[int(box.cls[0])]
                if class_name in PERSON_CLASS_NAMES and box.conf[0] > CONFIDENCE_THRESHOLD:
                    person_detections.append({
                        'box': box.xyxy[0].cpu().numpy(),
                        'class_name': class_name,
                        'is_associated': False # 新增一個標記，用於判斷是否已關聯到機車
                    })
        
        violation_found_this_frame = False

        # --- 步驟 2: 以機車為中心，處理超載和關聯的未戴安全帽 ---
        if moto_boxes:
            for moto_box in moto_boxes:
                person_count_on_moto = 0
                has_no_helmet_rider = False
                
                mx1, my1, mx2, my2 = map(int, moto_box)
                m_height = my2 - my1
                roi_y1 = max(0, my1 - int(m_height * ROI_UPSCALE_FACTOR))
                roi_x1, roi_x2, roi_y2 = mx1, mx2, my2

                # 遍歷所有騎士，判斷是否與當前機車關聯
                for person in person_detections:
                    px1, py1, px2, py2 = map(int, person['box'])
                    person_center_x = (px1 + px2) / 2
                    person_center_y = (py1 + py2) / 2
                    
                    if roi_x1 < person_center_x < roi_x2 and roi_y1 < person_center_y < roi_y2:
                        person['is_associated'] = True # 標記此人已被處理
                        person_count_on_moto += 1
                        if person['class_name'].lower() == NO_HELMET_CLASS_NAME.lower():
                            has_no_helmet_rider = True
                
                violations_to_report = []
                if person_count_on_moto > 2:
                    violations_to_report.append({'type': '違規乘載人數', 'fine': 1000})
                if has_no_helmet_rider:
                    violations_to_report.append({'type': '未戴安全帽', 'fine': 800})

                if violations_to_report:
                    logging.info(f"🚨 [機車關聯] 偵測到違規! 觸發處理...")
                    crop_img = local_frame_copy[my1:my2, mx1:mx2]
                    if crop_img.size > 0:
                        threading.Thread(target=process_multiple_violations, args=(
                            crop_img, violations_to_report
                        ), daemon=True).start()
                        
                        last_successful_detection_time = time.time()
                        violation_found_this_frame = True
                        break # 處理完一台違規機車後，跳出機車迴圈
        
        # --- 步驟 3: 獨立處理那些「未被關聯到任何機車」的未戴安全帽騎士 ---
        if not violation_found_this_frame: # 如果前面沒處理過任何機車違規
            for person in person_detections:
                # 如果這個人是未戴安全帽，並且他還沒被任何機車關聯處理過
                if not person['is_associated'] and person['class_name'].lower() == NO_HELMET_CLASS_NAME.lower():
                    logging.info(f"🚨 [獨立騎士] 偵測到未戴安全帽! 觸發處理...")
                    
                    # 截取該騎士的圖像 (由於沒有機車，我們只能截取騎士本身)
                    px1, py1, px2, py2 = map(int, person['box'])
                    # 稍微擴大截圖範圍，希望能拍到車牌的一部分
                    h, w, _ = local_frame_copy.shape
                    crop_y1 = max(0, py1 - (py2-py1))
                    crop_y2 = min(h, py2 + (py2-py1)*2)
                    crop_x1 = max(0, px1 - (px2-px1))
                    crop_x2 = min(w, px2 + (px2-px1))
                    crop_img = local_frame_copy[crop_y1:crop_y2, crop_x1:crop_x2]

                    if crop_img.size > 0:
                        violation_info = [{'type': '未戴安全帽', 'fine': 800}]
                        threading.Thread(target=process_multiple_violations, args=(
                            crop_img, violation_info
                        ), daemon=True).start()

                        last_successful_detection_time = time.time()
                        break # 處理完一個獨立的未戴安全帽騎士就結束

    logging.info("🔍 背景偵測邏輯執行緒已結束")

def generate_frames():
    global stop_detection_flag, data_lock, latest_frame, latest_results
    while not stop_detection_flag:
        time.sleep(1/TARGET_FPS)
        with data_lock:
            if latest_frame is None or latest_results is None: continue
            frame_to_show = latest_frame.copy()
            results_to_show = latest_results
        
        height, width = frame_to_show.shape[:2]
        scale_factor = DISPLAY_WIDTH / width if width < DISPLAY_WIDTH else 1.0
        if scale_factor != 1.0:
            frame_to_show = cv2.resize(frame_to_show, (DISPLAY_WIDTH, int(height * scale_factor)))

        if 'helmet' in results_to_show:
            for box in results_to_show['helmet'].boxes:
                if box.conf[0] > VISUAL_CONFIDENCE:
                    x1, y1, x2, y2 = map(int, [b * scale_factor for b in box.xyxy[0]])
                    conf = box.conf[0]
                    class_name = helmet_model.names[int(box.cls[0])]
                    color = (0, 0, 255) if class_name.lower() == NO_HELMET_CLASS_NAME.lower() else (0, 255, 0)
                    cv2.rectangle(frame_to_show, (x1, y1), (x2, y2), color, 3)
                    label = f'{class_name} {conf:.2f}'
                    cv2.putText(frame_to_show, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        
        if 'mot' in results_to_show and 'helmet' in results_to_show:
            person_boxes = [p['box'] for p in person_detections] if 'person_detections' in locals() else [box.xyxy[0].cpu().numpy() for box in results_to_show['helmet'].boxes if helmet_model.names[int(box.cls[0])] in PERSON_CLASS_NAMES]
            for mot_box_data in results_to_show['mot'].boxes:
                if int(mot_box_data.cls[0]) == MOTORCYCLE_CLASS_ID and mot_box_data.conf[0] > VISUAL_CONFIDENCE:
                    moto_box = mot_box_data.xyxy[0].cpu().numpy()
                    person_count_on_moto = 0
                    mx1, my1, mx2, my2 = map(int, moto_box)
                    m_height = my2 - my1
                    roi_y1, roi_x1, roi_x2, roi_y2 = max(0, my1 - int(m_height * ROI_UPSCALE_FACTOR)), mx1, mx2, my2
                    for person_box in person_boxes:
                        px1, py1, px2, py2 = map(int, person_box)
                        if roi_x1 < (px1 + px2) / 2 < roi_x2 and roi_y1 < (py1 + py2) / 2 < roi_y2:
                            person_count_on_moto += 1
                    is_overloaded = person_count_on_moto > 2
                    box_color = (0, 0, 255) if is_overloaded else (0, 255, 0)
                    smx1, smy1, smx2, smy2 = map(int, [b * scale_factor for b in moto_box])
                    label = f"Motorcycle - Persons: {person_count_on_moto}" + (" (Overloaded!)" if is_overloaded else "")
                    cv2.rectangle(frame_to_show, (smx1, smy1), (smx2, smy2), box_color, 2)
                    cv2.putText(frame_to_show, label, (smx1, smy1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, box_color, 2)
        
        (flag, encodedImage) = cv2.imencode(".jpg", frame_to_show, [cv2.IMWRITE_JPEG_QUALITY, 75])
        if not flag: continue
        yield(b'--frame\r\n' b'Content-Type: image/jpeg\r\n\r\n' + bytearray(encodedImage) + b'\r\n')

# ==================== 4. Flask API 端點 (已整合) ====================
@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/start_detection', methods=['POST'])
def start_detection():
    global global_cap, helmet_model, mot_model, stop_detection_flag, producer_thread, logic_thread, inference_thread
    if producer_thread and producer_thread.is_alive():
        return jsonify({"status": "fail", "message": "偵測已經在運行中。"}), 400
    data = request.get_json()
    video_path = data.get('video_path')
    if not video_path:
        return jsonify({"status": "fail", "message": "請提供 'video_path'。"}), 400
    try:
        if helmet_model is None:
            if not os.path.exists(HELMATE_MODEL_PATH):
                return jsonify({"status": "fail", "message": f"安全帽模型不存在: {HELMATE_MODEL_PATH}"}), 500
            helmet_model = YOLO(HELMATE_MODEL_PATH)
            logging.info("✅ 安全帽 YOLO 模型載入成功！")
        if mot_model is None:
            if not os.path.exists(MOT_MODEL_PATH):
                return jsonify({"status": "fail", "message": f"機車模型不存在: {MOT_MODEL_PATH}"}), 500
            mot_model = YOLO(MOT_MODEL_PATH)
            logging.info("✅ 機車 YOLO 模型載入成功！")
    except Exception as e:
        return jsonify({"status": "fail", "message": f"模型載入失敗: {e}"}), 500
    try:
        capture_source = int(video_path) if video_path.isdigit() else video_path
        global_cap = cv2.VideoCapture(capture_source)
        global_cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        global_cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        if not global_cap.isOpened():
            raise IOError(f"無法開啟影像來源: {video_path}")
        logging.info(f"✅ 攝影機連線成功: '{video_path}'")
    except Exception as e:
        return jsonify({"status": "fail", "message": str(e)}), 400
    stop_detection_flag = False
    producer_thread = threading.Thread(target=frame_producer, daemon=True)
    inference_thread = threading.Thread(target=perform_inference, daemon=True)
    logic_thread = threading.Thread(target=run_detection_logic, daemon=True)
    producer_thread.start()
    inference_thread.start()
    logic_thread.start()
    logging.info(f"🚀 雙功能偵測任務開始")
    return jsonify({"status": "success"})

@app.route('/stop_detection', methods=['POST'])
def stop_detection():
    global global_cap, stop_detection_flag, producer_thread, logic_thread, inference_thread, latest_frame, latest_results
    if not (producer_thread and producer_thread.is_alive()):
        return jsonify({"status": "fail", "message": "偵測並未在運行中。"}), 400
    logging.info("🛑 收到停止偵測的請求...")
    stop_detection_flag = True
    threads = [producer_thread, inference_thread, logic_thread]
    for thread in threads:
        if thread: thread.join(timeout=2)
    if global_cap:
        global_cap.release()
        global_cap = None
    while not frame_queue.empty():
        try: frame_queue.get_nowait()
        except queue.Empty: break
    with data_lock:
        latest_frame = None
        latest_results = None
    producer_thread, inference_thread, logic_thread = None, None, None
    logging.info("✅ 偵測已完全停止")
    return jsonify({"status": "success", "message": "偵測已停止。"})

@app.route('/status', methods=['GET'])
def get_status():
    is_running = producer_thread and producer_thread.is_alive()
    return jsonify({"status": "running" if is_running else "stopped", "message": f"偵測正在{'運行' if is_running else '停止'}中。"})

@app.route('/set_confidence', methods=['POST'])
def set_confidence():
    global CONFIDENCE_THRESHOLD, VISUAL_CONFIDENCE
    data = request.get_json()
    if not data or 'confidence' not in data:
        return jsonify({"status": "fail", "message": "請提供 'confidence' 參數 (0-100)"}), 400
    try:
        confidence_percent = float(data['confidence'])
        if not (0 <= confidence_percent <= 100):
            return jsonify({"status": "fail", "message": "信心度必須在 0-100 之間"}), 400
        new_threshold = confidence_percent / 100.0
        CONFIDENCE_THRESHOLD = new_threshold
        VISUAL_CONFIDENCE = max(0.3, new_threshold - 0.1)
        logging.info(f"🎯 信心度閾值已更新：{CONFIDENCE_THRESHOLD:.2f} (顯示閾值：{VISUAL_CONFIDENCE:.2f})")
        return jsonify({"status": "success", "message": f"信心度閾值已設定為 {confidence_percent}%"})
    except ValueError:
        return jsonify({"status": "fail", "message": "信心度必須是數字"}), 400

@app.route('/get_confidence', methods=['GET'])
def get_confidence():
    return jsonify({
        "status": "success",
        "confidence_percent": int(CONFIDENCE_THRESHOLD * 100),
    })

@app.route('/test_camera', methods=['POST'])
def test_camera():
    data = request.get_json()
    video_path = data.get('video_path')
    if not video_path: return jsonify({"status": "fail", "message": "請提供 'video_path'。"}), 400
    try:
        capture_source = int(video_path) if video_path.isdigit() else video_path
        test_cap = cv2.VideoCapture(capture_source)
        if test_cap.isOpened():
            ret, frame = test_cap.read()
            test_cap.release()
            if ret and frame is not None:
                height, width = frame.shape[:2]
                return jsonify({"status": "success", "message": f"攝影機 {video_path} 連線成功", "resolution": f"{width}x{height}"})
        return jsonify({"status": "fail", "message": f"無法連線到攝影機: {video_path}"}), 400
    except Exception as e:
        return jsonify({"status": "fail", "message": f"測試失敗: {str(e)}"}), 500

# ==================== 5. 啟動伺服器 (已更新) ====================
if __name__ == "__main__":
    print("=" * 60)
    print("⚡ 交通 AI 系統 - 雙功能整合模式 (複合式違規版)")
    print("=" * 60)
    print(f"🔧 安全帽模型：{HELMATE_MODEL_PATH}")
    print(f"🔧 機車模型：  {MOT_MODEL_PATH}")
    print("=" * 60)
    
    if not os.path.exists(HELMATE_MODEL_PATH) or not os.path.exists(MOT_MODEL_PATH):
        print(f"❌ 錯誤：找不到必要的模型檔案，請檢查路徑！")
        sys.exit(1)
    
    print("\n🚀 啟動 Flask 伺服器...")
    print("📱 前端請訪問: http://localhost:8080")
    print("🔧 API 端點: http://localhost:5001")
    print("按 Ctrl+C 停止服務\n")
    
    app.run(host='0.0.0.0', port=5001, debug=False, use_reloader=False, threaded=True)