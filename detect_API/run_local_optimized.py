#!/usr/bin/env python3
"""
本地運行版本的安全帽與機車超載檢測系統 - 雙模型重構版 V2
直接在 macOS 主機上運行，可完美存取本地攝影機
整合了兩種偵測邏輯：
1. 以車牌為中心的複合式違規偵測 (超載 + 未戴安全帽)
2. 獨立的未戴安全帽騎士偵測
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

# ==================== 1. 初始化與設定 ====================
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)
app = Flask(__name__)
CORS(app, origins=['http://localhost:8080'], supports_credentials=True)

# --- 模型路徑設定 (雙模型) ---
PERSON_MODEL_PATH = os.getenv('HELMATE_MODEL_PATH') 
PLATE_MODEL_PATH = os.getenv('PLATE_MODEL_PATH') 

DATABASE_URL = os.getenv('DATABASE_URL')
LPR_API_URL = "http://localhost:3001/recognize_plate"
WEB_API_URL = "http://localhost:3002"

print("⚡ 雙模型整合運行模式配置 (複合邏輯版):")
print("   騎士偵測模型: {PERSON_MODEL_PATH}")
print("   車牌偵測模型: {PLATE_MODEL_PATH}")
print("   資料庫: {'已配置' if DATABASE_URL else '未配置'}")
print("   車牌API: {LPR_API_URL}")
print("   Web API: {WEB_API_URL}")

# 全域變數管理
global_cap = None
person_model = None
plate_model = None
stop_detection_flag = True

# 執行緒安全的佇列和鎖
frame_queue = queue.Queue(maxsize=1)
producer_thread = None
logic_thread = None
inference_thread = None

# 共享的最新結果 (受鎖保護)
latest_frame = None
latest_results = None 
data_lock = threading.Lock()

# --- 常數設定 ---
HELMET_CLASS_NAME = 'helmet'
NO_HELMET_CLASS_NAME = 'no-helmet'
NUMBER_PLATE_CLASS_NAME = 'license_plate' # 與您的車牌模型類別名稱一致
PERSON_CLASS_NAMES = [HELMET_CLASS_NAME, NO_HELMET_CLASS_NAME]

ROI_EXPAND_UP = 15.0
ROI_EXPAND_DOWN = 3.0
ROI_EXPAND_HORIZONTAL = 4.0

CONFIDENCE_THRESHOLD = 0.65
VISUAL_CONFIDENCE = 0.5
SCREENSHOT_PATH = "successful_detections"

TARGET_FPS = 15
FRAME_SKIP = 3
RESIZE_WIDTH = 480
DISPLAY_WIDTH = 1024

if not os.path.exists(SCREENSHOT_PATH):
    os.makedirs(SCREENSHOT_PATH)

# ==================== 2. 輔助函式 (保持不變) ====================
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

def save_to_database(owner_info, image_path, violation_type, fine, confidence=None):
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
            image_path, image_data, timestamp, fine, confidence
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) 
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
                    fine,
                    confidence
                ))
                new_record = cur.fetchone()
                conn.commit()
                
                if new_record:
                    result = {
                        'id': new_record[0], 'type': new_record[1], 'plateNumber': new_record[2],
                        'timestamp': new_record[3].isoformat() + 'Z', 'status': new_record[4]
                    }
                    # ################## ▼▼▼ 修正處 ▼▼▼ ##################
                    # 建立格式化的信心度字串
                    conf_str = f"{confidence:.2f}" if confidence is not None else "N/A"
                    logging.info(f"💾 資料庫寫入成功 ({violation_type}), 信心度: {conf_str}")
                    # ################## ▲▲▲ 修正處 ▲▲▲ ##################
                    return result
    except Exception as error:
        logging.error(f"資料庫寫入錯誤: {error}")
        return None

def notify_violation(violation_data):
    # ... (此函式保持不變)
    notify_url = f'{WEB_API_URL}/notify/new-violation'
    try:
        response = requests.post(notify_url, json=violation_data, timeout=3)
        if response.status_code == 200:
            logging.info(f"✅ 成功通知伺服器廣播新違規: {violation_data['plateNumber']}")
        else:
            logging.error(f"❌ 通知伺服器失敗，狀態碼: {response.status_code}")
    except requests.exceptions.RequestException as e:
        logging.error(f"❌ 呼叫廣播 API 時發生網路錯誤: {e}")

# ==================== 3. 核心偵測與串流邏輯 ====================
# ... (frame_producer, perform_inference 函式保持雙模型架構不變)
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
    global stop_detection_flag, person_model, plate_model, frame_queue, latest_frame, latest_results, data_lock
    logging.info("🧠 雙模型推理執行緒已啟動")
    while not stop_detection_flag:
        try:
            frame = frame_queue.get(timeout=1)
            person_results = person_model(frame, conf=0.3, verbose=False, imgsz=320)
            plate_results = plate_model(frame, conf=0.3, verbose=False, imgsz=320)
            with data_lock:
                latest_frame = frame
                latest_results = {'persons': person_results[0], 'plates': plate_results[0]}
        except queue.Empty: continue
        except Exception as e: logging.error(f"推理錯誤: {e}")
    logging.info("🧠 模型推理執行緒已結束")

def process_multiple_violations(crop_img, violations_list):
    # ... (此函式保持不變, 它能靈活處理單一或多個違規)
    if not violations_list: return
    logging.info(f"🚗 偵測到事件，開始進行車牌辨識...")
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
            owner_info, filename, 
            violation['type'], 
            violation['fine'],
            violation.get('confidence', 0.0)
        )
        if new_violation_data:
            notify_violation(new_violation_data)


# ######################################################################
# ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ 核心修改處 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
# 整合了兩種違規偵測邏輯
# ######################################################################
def run_detection_logic():
    global stop_detection_flag, latest_results, data_lock, latest_frame
    last_successful_detection_time = 0
    violation_cooldown = 3.0
    logging.info("🔍 [複合邏輯] 偵測邏輯執行緒已啟動")
    
    while not stop_detection_flag:
        time.sleep(0.2)
        
        with data_lock:
            if latest_frame is None or latest_results is None: continue
            local_frame_copy = latest_frame.copy()
            local_person_results = latest_results['persons']
            local_plate_results = latest_results['plates']
        
        current_time = time.time()
        if current_time - last_successful_detection_time < violation_cooldown: continue
        
        # --- 1. 整理當前幀的所有偵測物件 ---
        plate_detections = []
        for box in local_plate_results.boxes:
            if box.conf[0] > CONFIDENCE_THRESHOLD and plate_model.names[int(box.cls[0])] == NUMBER_PLATE_CLASS_NAME:
                plate_detections.append({'box': box.xyxy[0].cpu().numpy(), 'conf': box.conf[0].item()})

        person_detections = []
        for box in local_person_results.boxes:
            if box.conf[0] > CONFIDENCE_THRESHOLD:
                person_detections.append({
                    'box': box.xyxy[0].cpu().numpy(),
                    'class_name': person_model.names[int(box.cls[0])],
                    'conf': box.conf[0].item(),
                    'is_associated': False  # <--- 關鍵：新增關聯標記
                })
        
        violation_found_this_frame = False

        # --- 2. 主要流程：以「車牌」為中心，偵測複合違規 ---
        if plate_detections:
            for plate in plate_detections:
                person_count_on_moto = 0
                has_no_helmet_rider = False
                max_no_helmet_conf = 0.0
                
                npx1, npy1, npx2, npy2 = map(int, plate['box'])
                plate_h, plate_w = npy2 - npy1, npx2 - npx1
                if plate_h <= 0 or plate_w <= 0: continue
                
                # 定義ROI
                moto_roi_y1 = max(0, npy1 - int(plate_h * ROI_EXPAND_UP))
                moto_roi_y2 = min(local_frame_copy.shape[0], npy2 + int(plate_h * ROI_EXPAND_DOWN))
                moto_roi_x1 = max(0, npx1 - int(plate_w * ROI_EXPAND_HORIZONTAL))
                moto_roi_x2 = min(local_frame_copy.shape[1], npx2 + int(plate_w * ROI_EXPAND_HORIZONTAL))

                # 在ROI內尋找並關聯騎士
                for person in person_detections:
                    px1, py1, px2, py2 = map(int, person['box'])
                    person_center_x, person_center_y = (px1 + px2) / 2, (py1 + py2) / 2
                    
                    if moto_roi_x1 < person_center_x < moto_roi_x2 and moto_roi_y1 < person_center_y < moto_roi_y2:
                        person['is_associated'] = True  # <--- 標記此騎士已被處理
                        person_count_on_moto += 1
                        if person['class_name'] == NO_HELMET_CLASS_NAME:
                            has_no_helmet_rider = True
                            max_no_helmet_conf = max(max_no_helmet_conf, person['conf'])
                
                # 判斷違規
                violations_to_report = []
                if person_count_on_moto > 2:
                    violations_to_report.append({'type': '違規乘載人數', 'fine': 1000, 'confidence': plate['conf']})
                if has_no_helmet_rider:
                    violations_to_report.append({'type': '未戴安全帽', 'fine': 800, 'confidence': max_no_helmet_conf})

                if violations_to_report:
                    logging.info(f"🚨 [車牌關聯] 偵測到違規! 人數: {person_count_on_moto}, 是否有未戴安全帽: {has_no_helmet_rider}")
                    crop_img = local_frame_copy[moto_roi_y1:moto_roi_y2, moto_roi_x1:moto_roi_x2]

                    if crop_img.size > 0:
                        threading.Thread(target=process_multiple_violations, args=(crop_img, violations_to_report), daemon=True).start()
                        last_successful_detection_time = time.time()
                        violation_found_this_frame = True
                        break # 處理完一個車牌事件就跳出，等待下一幀
        
        # --- 3. 輔助流程：處理未被關聯的「獨立未戴安全帽」騎士 ---
        if not violation_found_this_frame:
            for person in person_detections:
                # 只有當騎士是'no-helmet'且'未被關聯'時，才觸發此邏輯
                if not person['is_associated'] and person['class_name'] == NO_HELMET_CLASS_NAME:
                    logging.info(f"🚨 [獨立騎士] 偵測到未戴安全帽! 觸發處理...")
                    
                    px1, py1, px2, py2 = map(int, person['box'])
                    h, w, _ = local_frame_copy.shape
                    
                    # 以騎士為中心，定義一個合理的截圖範圍，嘗試捕獲車牌
                    person_height, person_width = py2 - py1, px2 - px1
                    crop_y1 = max(0, py1 - person_height * 2)
                    crop_y2 = min(h, py2 + person_height * 8)
                    crop_x1 = max(0, px1 - person_width * 3)
                    crop_x2 = min(w, px2 + person_width * 3)
                    crop_img = local_frame_copy[crop_y1:crop_y2, crop_x1:crop_x2]

                    if crop_img.size > 0:
                        violation_info = [{'type': '未戴安全帽', 'fine': 800, 'confidence': person['conf']}]
                        threading.Thread(target=process_multiple_violations, args=(crop_img, violation_info), daemon=True).start()

                        last_successful_detection_time = time.time()
                        break # 每幀只處理一個獨立事件，避免畫面混亂

    logging.info("🔍 背景偵測邏輯執行緒已結束")

# ... (generate_frames, 和所有 Flask API 端點都保持和上一版相同)
def generate_frames():
    global stop_detection_flag, data_lock, latest_frame, latest_results
    while not stop_detection_flag:
        time.sleep(1/TARGET_FPS)
        with data_lock:
            if latest_frame is None or latest_results is None: continue
            frame_to_show = latest_frame.copy()
            person_results_to_show = latest_results['persons']
            plate_results_to_show = latest_results['plates']
        
        height, width = frame_to_show.shape[:2]
        scale_factor = DISPLAY_WIDTH / width if width > DISPLAY_WIDTH else 1.0
        if scale_factor != 1.0:
            frame_to_show = cv2.resize(frame_to_show, (DISPLAY_WIDTH, int(height * scale_factor)))

        for box in person_results_to_show.boxes:
            if box.conf[0] > VISUAL_CONFIDENCE:
                x1, y1, x2, y2 = map(int, [b * scale_factor for b in box.xyxy[0]])
                conf, class_name = box.conf[0], person_model.names[int(box.cls[0])]
                color = (0, 0, 255) if class_name == NO_HELMET_CLASS_NAME else (0, 255, 0)
                cv2.rectangle(frame_to_show, (x1, y1), (x2, y2), color, 2)
                cv2.putText(frame_to_show, f'{class_name} {conf:.2f}', (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        
        for box in plate_results_to_show.boxes:
            if box.conf[0] > VISUAL_CONFIDENCE:
                x1, y1, x2, y2 = map(int, [b * scale_factor for b in box.xyxy[0]])
                conf, class_name = box.conf[0], plate_model.names[int(box.cls[0])]
                color = (255, 0, 0)
                cv2.rectangle(frame_to_show, (x1, y1), (x2, y2), color, 2)
                cv2.putText(frame_to_show, f'{class_name} {conf:.2f}', (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        (flag, encoded_image) = cv2.imencode(".jpg", frame_to_show, [cv2.IMWRITE_JPEG_QUALITY, 75])
        if not flag: continue
        yield(b'--frame\r\n' b'Content-Type: image/jpeg\r\n\r\n' + bytearray(encoded_image) + b'\r\n')

# ==================== 4. Flask API 端點 ====================
@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/start_detection', methods=['POST'])
def start_detection():
    global global_cap, person_model, plate_model, stop_detection_flag, producer_thread, logic_thread, inference_thread
    if producer_thread and producer_thread.is_alive():
        return jsonify({"status": "fail", "message": "偵測已經在運行中。"}), 400
    data = request.get_json()
    video_path = data.get('video_path')
    if not video_path: return jsonify({"status": "fail", "message": "請提供 'video_path'。"}), 400
    try:
        if person_model is None:
            if not PERSON_MODEL_PATH or not os.path.exists(PERSON_MODEL_PATH):
                return jsonify({"status": "fail", "message": f"騎士偵測模型不存在: {PERSON_MODEL_PATH}"}), 500
            person_model = YOLO(PERSON_MODEL_PATH)
            logging.info("✅ 騎士偵測 YOLO 模型載入成功！")
        if plate_model is None:
            if not PLATE_MODEL_PATH or not os.path.exists(PLATE_MODEL_PATH):
                return jsonify({"status": "fail", "message": f"車牌偵測模型不存在: {PLATE_MODEL_PATH}"}), 500
            plate_model = YOLO(PLATE_MODEL_PATH)
            logging.info("✅ 車牌偵測 YOLO 模型載入成功！")
    except Exception as e:
        return jsonify({"status": "fail", "message": f"模型載入失敗: {e}"}), 500
    try:
        capture_source = int(video_path) if video_path.isdigit() else video_path
        global_cap = cv2.VideoCapture(capture_source)
        global_cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        global_cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        width, height = global_cap.get(cv2.CAP_PROP_FRAME_WIDTH), global_cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
        logging.info(f"✅ 攝影機請求 1280x720，實際啟動解析度: {int(width)}x{int(height)}")
        if not global_cap.isOpened(): raise IOError(f"無法開啟影像來源: {video_path}")
    except Exception as e:
        return jsonify({"status": "fail", "message": str(e)}), 400
    stop_detection_flag = False
    producer_thread = threading.Thread(target=frame_producer, daemon=True)
    inference_thread = threading.Thread(target=perform_inference, daemon=True)
    logic_thread = threading.Thread(target=run_detection_logic, daemon=True)
    producer_thread.start()
    inference_thread.start()
    logic_thread.start()
    logging.info(f"🚀 雙模型偵測任務開始")
    return jsonify({"status": "success"})

# ... 其餘API端點 /stop_detection, /status, /set_confidence, /get_confidence, /test_camera 保持不變
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
    return jsonify({"status": "success", "confidence_percent": int(CONFIDENCE_THRESHOLD * 100)})

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

# ==================== 5. 啟動伺服器 ====================
if __name__ == "__main__":
    print("=" * 60)
    print("⚡ 交通 AI 系統 - 雙模型整合模式 (複合邏輯版)")
    print("=" * 60)
    print("🔧 騎士模型：{PERSON_MODEL_PATH}")
    print("🔧 車牌模型：{PLATE_MODEL_PATH}")
    print("=" * 60)
    
    if not PERSON_MODEL_PATH or not os.path.exists(PERSON_MODEL_PATH):
        print("❌ 錯誤：找不到騎士模型檔案，請檢查 .env 的 HELMATE_MODEL_PATH！")
        sys.exit(1)
    if not PLATE_MODEL_PATH or not os.path.exists(PLATE_MODEL_PATH):
        print("❌ 錯誤：找不到車牌模型檔案，請檢查 .env 的 PLATE_MODEL_PATH！")
        sys.exit(1)
    
    print("\n🚀 啟動 Flask 伺服器...")
    print("📱 前端請訪問: http://localhost:8080")
    print("🔧 API 端點: http://localhost:5001")
    print("按 Ctrl+C 停止服務\n")
    
    app.run(host='0.0.0.0', port=5001, debug=False, use_reloader=False, threaded=True)