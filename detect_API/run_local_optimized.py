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

# ==================== 1. 配置管理 ====================
class Config:
    """集中管理所有配置參數"""
    def __init__(self):
        self.load_environment_variables()
        self.setup_constants()
        self.setup_directories()
    
    def load_environment_variables(self):
        """載入環境變數"""
        self.PERSON_MODEL_PATH = os.getenv('HELMATE_MODEL_PATH')
        self.PLATE_MODEL_PATH = os.getenv('PLATE_MODEL_PATH')
        self.DATABASE_URL = os.getenv('DATABASE_URL')
        self.LPR_API_URL = "http://localhost:3001/recognize_plate"
        self.WEB_API_URL = "http://localhost:3002"
    
    def setup_constants(self):
        """設置常數"""
        # 類別名稱
        self.HELMET_CLASS_NAME = 'helmet'
        self.NO_HELMET_CLASS_NAME = 'no-helmet'
        self.NUMBER_PLATE_CLASS_NAME = 'license_plate'
        self.PERSON_CLASS_NAMES = [self.HELMET_CLASS_NAME, self.NO_HELMET_CLASS_NAME]
        
        # ROI 擴展參數
        self.ROI_EXPAND_UP = 15.0
        self.ROI_EXPAND_DOWN = 3.0
        self.ROI_EXPAND_HORIZONTAL = 4.0
        
        # 檢測參數
        self.CONFIDENCE_THRESHOLD = 0.65
        self.VISUAL_CONFIDENCE = 0.5
        
        # 性能參數
        self.TARGET_FPS = 15
        self.FRAME_SKIP = 3
        self.RESIZE_WIDTH = 480
        self.DISPLAY_WIDTH = 1024
        
        # 路徑設定
        self.SCREENSHOT_PATH = "successful_detections"
    
    def setup_directories(self):
        """建立必要的目錄"""
        if not os.path.exists(self.SCREENSHOT_PATH):
            os.makedirs(self.SCREENSHOT_PATH)
    
    def print_configuration(self):
        """印出配置資訊"""
        print("⚡ 雙模型整合運行模式配置 (複合邏輯版):")
        print(f"   騎士偵測模型: {self.PERSON_MODEL_PATH}")
        print(f"   車牌偵測模型: {self.PLATE_MODEL_PATH}")
        print(f"   資料庫: {'已配置' if self.DATABASE_URL else '未配置'}")
        print(f"   車牌API: {self.LPR_API_URL}")
        print(f"   Web API: {self.WEB_API_URL}")

class SystemState:
    """管理系統狀態和執行緒"""
    def __init__(self):
        self.global_cap = None
        self.person_model = None
        self.plate_model = None
        self.stop_detection_flag = True
        
        # 執行緒安全的佇列和鎖
        self.frame_queue = queue.Queue(maxsize=1)
        self.producer_thread = None
        self.logic_thread = None
        self.inference_thread = None
        
        # 共享的最新結果 (受鎖保護)
        self.latest_frame = None
        self.latest_results = None
        self.data_lock = threading.Lock()

def setup_logging():
    """設置日誌系統"""
    logging.basicConfig(
        level=logging.INFO, 
        format='%(asctime)s - %(levelname)s - %(message)s', 
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)

def setup_flask_app():
    """設置 Flask 應用程式"""
    app = Flask(__name__)
    CORS(app, origins=['http://localhost:8080'], supports_credentials=True)
    return app

# ==================== 2. 全域初始化 ====================
setup_logging()
config = Config()
system_state = SystemState()
app = setup_flask_app()

# 向後相容的全域變數 (方便現有代碼使用)
global_cap = system_state.global_cap
person_model = system_state.person_model
plate_model = system_state.plate_model
stop_detection_flag = system_state.stop_detection_flag
frame_queue = system_state.frame_queue
producer_thread = system_state.producer_thread
logic_thread = system_state.logic_thread
inference_thread = system_state.inference_thread
latest_frame = system_state.latest_frame
latest_results = system_state.latest_results
data_lock = system_state.data_lock

# 常數的向後相容
HELMET_CLASS_NAME = config.HELMET_CLASS_NAME
NO_HELMET_CLASS_NAME = config.NO_HELMET_CLASS_NAME
NUMBER_PLATE_CLASS_NAME = config.NUMBER_PLATE_CLASS_NAME
PERSON_CLASS_NAMES = config.PERSON_CLASS_NAMES
ROI_EXPAND_UP = config.ROI_EXPAND_UP
ROI_EXPAND_DOWN = config.ROI_EXPAND_DOWN
ROI_EXPAND_HORIZONTAL = config.ROI_EXPAND_HORIZONTAL
CONFIDENCE_THRESHOLD = config.CONFIDENCE_THRESHOLD
VISUAL_CONFIDENCE = config.VISUAL_CONFIDENCE
SCREENSHOT_PATH = config.SCREENSHOT_PATH
TARGET_FPS = config.TARGET_FPS
FRAME_SKIP = config.FRAME_SKIP
RESIZE_WIDTH = config.RESIZE_WIDTH
DISPLAY_WIDTH = config.DISPLAY_WIDTH
DATABASE_URL = config.DATABASE_URL
LPR_API_URL = config.LPR_API_URL
WEB_API_URL = config.WEB_API_URL
PERSON_MODEL_PATH = config.PERSON_MODEL_PATH
PLATE_MODEL_PATH = config.PLATE_MODEL_PATH

config.print_configuration()

# ==================== 3. API 呼叫模組 ====================
class LPRApiClient:
    """車牌識別 API 客戶端"""
    
    @staticmethod
    def prepare_image_data(image_data):
        """準備圖片數據用於 API 呼叫"""
        try:
            _, img_encoded = cv2.imencode('.jpg', image_data, [cv2.IMWRITE_JPEG_QUALITY, 65])
            return {'file': ('violation.jpg', img_encoded.tobytes(), 'image/jpeg')}
        except Exception:
            logging.error("圖片編碼失敗")
            return None
    
    @staticmethod
    def make_api_request(files):
        """發送 API 請求"""
        try:
            response = requests.post(
                LPR_API_URL, 
                files=files, 
                timeout=5,
                headers={'Connection': 'close'}
            )
            return response
        except requests.exceptions.RequestException as e:
            logging.error(f"呼叫車牌 API 時發生網路錯誤: {e}")
            return None
    
    @staticmethod
    def process_api_response(response):
        """處理 API 響應"""
        if response and response.status_code == 200:
            result = response.json()
            if 'data' in result and result['data'] is not None:
                return result['data']
        return None

def call_lpr_api(image_data):
    """呼叫車牌識別 API (重構版)"""
    api_start_time = time.time()
    
    # 準備圖片數據
    files = LPRApiClient.prepare_image_data(image_data)
    if not files:
        return None
    
    # 發送請求
    response = LPRApiClient.make_api_request(files)
    if not response:
        return None
    
    # 處理響應
    result = LPRApiClient.process_api_response(response)
    
    api_duration = time.time() - api_start_time
    if result:
        logging.info(f"🚗 車牌識別成功，耗時: {api_duration:.3f}s")
    
    return result

# ==================== 4. 資料庫操作模組 ====================
class DatabaseManager:
    """資料庫管理器"""
    
    @staticmethod
    def encode_image_to_base64(image_path):
        """將圖片編碼為 base64"""
        try:
            if image_path and os.path.exists(image_path):
                with open(image_path, 'rb') as image_file:
                    return base64.b64encode(image_file.read()).decode('utf-8')
        except Exception as e:
            logging.error(f"❌ 讀取圖片檔案失敗: {e}")
        return None
    
    @staticmethod
    def prepare_sql_data(owner_info, image_path, violation_type, fine, confidence):
        """準備 SQL 插入數據"""
        image_data = DatabaseManager.encode_image_to_base64(image_path)
        timestamp_now = datetime.now()
        
        return (
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
        )
    
    @staticmethod
    def execute_insert_query(sql, data):
        """執行插入查詢"""
        try:
            with psycopg2.connect(DATABASE_URL, connect_timeout=3) as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, data)
                    new_record = cur.fetchone()
                    conn.commit()
                    return new_record
        except Exception:
            logging.error("資料庫寫入錯誤")
            return None
    
    @staticmethod
    def format_violation_result(new_record, confidence):
        """格式化違規結果"""
        if new_record:
            result = {
                'id': new_record[0], 
                'type': new_record[1], 
                'plateNumber': new_record[2],
                'timestamp': new_record[3].isoformat() + 'Z', 
                'status': new_record[4]
            }
            conf_str = f"{confidence:.2f}" if confidence is not None else "N/A"
            logging.info(f"💾 資料庫寫入成功 ({new_record[1]}), 信心度: {conf_str}")
            return result
        return None

def save_to_database(owner_info, image_path, violation_type, fine, confidence=None):
    """保存違規資料到資料庫 (重構版)"""
    if not DATABASE_URL:
        logging.warning("資料庫未配置，跳過資料儲存")
        return None
    
    sql = """
        INSERT INTO violations (
            license_plate, owner_name, owner_phone, owner_email,
            owner_address, violation_type, violation_address,
            image_path, image_data, timestamp, fine, confidence
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) 
        RETURNING id, violation_type, license_plate, timestamp, status; 
    """
    
    # 準備數據
    data = DatabaseManager.prepare_sql_data(owner_info, image_path, violation_type, fine, confidence)
    
    # 執行查詢
    new_record = DatabaseManager.execute_insert_query(sql, data)
    
    # 格式化結果
    return DatabaseManager.format_violation_result(new_record, confidence)

# ==================== 5. 通知服務模組 ====================
class NotificationService:
    """通知服務"""
    
    @staticmethod
    def send_violation_notification(violation_data):
        """發送違規通知"""
        notify_url = f'{WEB_API_URL}/api/notify/new-violation'
        try:
            response = requests.post(notify_url, json=violation_data, timeout=3)
            if response.status_code == 200:
                logging.info(f"✅ 成功通知伺服器廣播新違規: {violation_data['plateNumber']}")
            else:
                logging.error(f"❌ 通知伺服器失敗，狀態碼: {response.status_code}")
        except requests.exceptions.RequestException as e:
            logging.error(f"❌ 呼叫廣播 API 時發生網路錯誤: {e}")

def notify_violation(violation_data):
    """通知違規 (向後相容函數)"""
    NotificationService.send_violation_notification(violation_data)

# ==================== 6. 違規處理模組 ====================
class ViolationProcessor:
    """違規處理器"""
    
    @staticmethod
    def generate_filename(owner_info):
        """生成檔案名稱"""
        ts_str = time.strftime("%Y%m%d_%H%M%S")
        plate = owner_info.get('license_plate_number', 'UNKNOWN')
        return os.path.join(SCREENSHOT_PATH, f"event_{plate}_{ts_str}.jpg")
    
    @staticmethod
    def save_violation_image(crop_img, filename):
        """保存違規圖片"""
        try:
            cv2.imwrite(filename, crop_img)
            logging.info(f"📸 事件圖片已保存至: {filename}")
            return True
        except Exception as e:
            logging.error(f"❌ 保存圖片失敗: {e}")
            return False
    
    @staticmethod
    def process_single_violation(owner_info, filename, violation):
        """處理單一違規"""
        new_violation_data = save_to_database(
            owner_info, filename, 
            violation['type'], 
            violation['fine'],
            violation.get('confidence', 0.0)
        )
        if new_violation_data:
            NotificationService.send_violation_notification(new_violation_data)

def process_multiple_violations(crop_img, violations_list):
    """處理多個違規事件 (重構版)"""
    if not violations_list:
        return
    
    logging.info("🚗 偵測到事件，開始進行車牌辨識...")
    
    # 1. 呼叫車牌識別 API
    owner_info = call_lpr_api(crop_img)
    if not owner_info:
        logging.info("❌ 車牌識別失敗，無法處理此事件中的任何違規。")
        return
    
    # 2. 生成並保存圖片
    filename = ViolationProcessor.generate_filename(owner_info)
    if not ViolationProcessor.save_violation_image(crop_img, filename):
        return
    
    # 3. 處理所有違規
    logging.info(f"💾 準備將 {len(violations_list)} 項違規寫入資料庫...")
    for violation in violations_list:
        ViolationProcessor.process_single_violation(owner_info, filename, violation)

# ==================== 7. 框架處理模組 ====================
class FrameProcessor:
    """框架處理器"""
    
    @staticmethod
    def resize_frame_if_needed(frame):
        """如果需要，調整框架大小"""
        height, width = frame.shape[:2]
        if width > RESIZE_WIDTH:
            scale = RESIZE_WIDTH / width
            frame = cv2.resize(frame, (RESIZE_WIDTH, int(height * scale)))
        return frame
    
    @staticmethod
    def should_skip_frame(frame_count):
        """判斷是否應該跳過此框架"""
        return frame_count % FRAME_SKIP != 0

def frame_producer():
    """影像生產者執行緒 (重構版)"""
    global stop_detection_flag, global_cap, frame_queue
    logging.info("📹 影像生產者執行緒已啟動")
    frame_count = 0
    
    while not stop_detection_flag:
        # 檢查攝影機狀態
        if not (global_cap and global_cap.isOpened()):
            time.sleep(0.1)
            continue
        
        # 讀取框架
        ret, frame = global_cap.read()
        if not ret:
            time.sleep(0.1)
            continue
        
        # 框架計數和跳過邏輯
        frame_count += 1
        if FrameProcessor.should_skip_frame(frame_count):
            continue
        
        # 調整框架大小
        frame = FrameProcessor.resize_frame_if_needed(frame)
        
        # 將框架加入佇列
        try:
            frame_queue.put_nowait(frame)
        except queue.Full:
            try:
                frame_queue.get_nowait()
                frame_queue.put_nowait(frame)
            except queue.Empty:
                pass
    
    logging.info("📹 影像生產者執行緒已結束")

# ==================== 8. 推理模組 ====================
class InferenceEngine:
    """推理引擎"""
    
    @staticmethod
    def run_person_detection(person_model, frame):
        """執行人員檢測"""
        return person_model(frame, conf=0.3, verbose=False, imgsz=320)
    
    @staticmethod
    def run_plate_detection(plate_model, frame):
        """執行車牌檢測"""
        return plate_model(frame, conf=0.3, verbose=False, imgsz=320)
    
    @staticmethod
    def update_shared_results(frame, person_results, plate_results):
        """更新共享結果"""
        global latest_frame, latest_results, data_lock
        with data_lock:
            latest_frame = frame
            latest_results = {'persons': person_results[0], 'plates': plate_results[0]}

def perform_inference():
    """模型推理執行緒 (重構版)"""
    global stop_detection_flag, person_model, plate_model, frame_queue
    logging.info("🧠 雙模型推理執行緒已啟動")
    
    while not stop_detection_flag:
        try:
            # 從佇列獲取框架
            frame = frame_queue.get(timeout=1)
            
            # 執行雙模型推理
            person_results = InferenceEngine.run_person_detection(person_model, frame)
            plate_results = InferenceEngine.run_plate_detection(plate_model, frame)
            
            # 更新共享結果
            InferenceEngine.update_shared_results(frame, person_results, plate_results)
            
        except queue.Empty:
            continue
        except Exception as e:
            logging.error(f"推理錯誤: {e}")
    
    logging.info("🧠 模型推理執行緒已結束")

# ==================== 9. 檢測邏輯模組 ====================
class DetectionLogic:
    """檢測邏輯處理器"""
    
    @staticmethod
    def extract_plate_detections(plate_results, plate_model):
        """提取車牌檢測結果"""
        plate_detections = []
        for box in plate_results.boxes:
            if (box.conf[0] > CONFIDENCE_THRESHOLD and 
                plate_model.names[int(box.cls[0])] == NUMBER_PLATE_CLASS_NAME):
                plate_detections.append({
                    'box': box.xyxy[0].cpu().numpy(), 
                    'conf': box.conf[0].item()
                })
        return plate_detections
    
    @staticmethod
    def extract_person_detections(person_results, person_model):
        """提取人員檢測結果"""
        person_detections = []
        for box in person_results.boxes:
            if box.conf[0] > CONFIDENCE_THRESHOLD:
                person_detections.append({
                    'box': box.xyxy[0].cpu().numpy(),
                    'class_name': person_model.names[int(box.cls[0])],
                    'conf': box.conf[0].item(),
                    'is_associated': False
                })
        return person_detections
    
    @staticmethod
    def calculate_roi_coordinates(plate_box):
        """計算 ROI 座標"""
        npx1, npy1, npx2, npy2 = map(int, plate_box)
        plate_h, plate_w = npy2 - npy1, npx2 - npx1
        
        return {
            'plate_h': plate_h,
            'plate_w': plate_w,
            'roi_y1': max(0, npy1 - int(plate_h * ROI_EXPAND_UP)),
            'roi_y2': npy2 + int(plate_h * ROI_EXPAND_DOWN),
            'roi_x1': max(0, npx1 - int(plate_w * ROI_EXPAND_HORIZONTAL)),
            'roi_x2': npx2 + int(plate_w * ROI_EXPAND_HORIZONTAL)
        }
    
    @staticmethod
    def is_person_in_roi(person_box, roi_coords):
        """判斷人員是否在 ROI 內"""
        px1, py1, px2, py2 = map(int, person_box)
        person_center_x, person_center_y = (px1 + px2) / 2, (py1 + py2) / 2
        
        return (roi_coords['roi_x1'] < person_center_x < roi_coords['roi_x2'] and 
                roi_coords['roi_y1'] < person_center_y < roi_coords['roi_y2'])
    
    @staticmethod
    def analyze_violations_for_plate(person_detections, roi_coords):
        """分析特定車牌的違規情況"""
        person_count_on_moto = 0
        has_no_helmet_rider = False
        max_no_helmet_conf = 0.0
        
        for person in person_detections:
            if DetectionLogic.is_person_in_roi(person['box'], roi_coords):
                person['is_associated'] = True
                person_count_on_moto += 1
                if person['class_name'] == NO_HELMET_CLASS_NAME:
                    has_no_helmet_rider = True
                    max_no_helmet_conf = max(max_no_helmet_conf, person['conf'])
        
        return person_count_on_moto, has_no_helmet_rider, max_no_helmet_conf
    
    @staticmethod
    def determine_violations(person_count, has_no_helmet, no_helmet_conf, plate_conf):
        """判斷違規類型"""
        violations = []
        if person_count > 2:
            violations.append({
                'type': '違規乘載人數', 
                'fine': 1000, 
                'confidence': plate_conf
            })
        if has_no_helmet:
            violations.append({
                'type': '未戴安全帽', 
                'fine': 800, 
                'confidence': no_helmet_conf
            })
        return violations
    
    @staticmethod
    def process_unassociated_riders(person_detections, frame_copy):
        """處理未關聯的騎士"""
        for person in person_detections:
            if not person['is_associated'] and person['class_name'] == NO_HELMET_CLASS_NAME:
                logging.info("🚨 [獨立騎士] 偵測到未戴安全帽! 觸發處理...")
                
                # 計算截圖範圍
                crop_coords = DetectionLogic.calculate_rider_crop_coordinates(
                    person['box'], frame_copy.shape
                )
                crop_img = frame_copy[crop_coords['y1']:crop_coords['y2'], 
                                   crop_coords['x1']:crop_coords['x2']]
                
                if crop_img.size > 0:
                    violation_info = [{
                        'type': '未戴安全帽', 
                        'fine': 800, 
                        'confidence': person['conf']
                    }]
                    threading.Thread(
                        target=process_multiple_violations, 
                        args=(crop_img, violation_info), 
                        daemon=True
                    ).start()
                    return True
        return False
    
    @staticmethod
    def calculate_rider_crop_coordinates(person_box, frame_shape):
        """計算騎士截圖座標"""
        px1, py1, px2, py2 = map(int, person_box)
        h, w, _ = frame_shape
        person_height, person_width = py2 - py1, px2 - px1
        
        return {
            'y1': max(0, py1 - person_height * 2),
            'y2': min(h, py2 + person_height * 8),
            'x1': max(0, px1 - person_width * 3),
            'x2': min(w, px2 + person_width * 3)
        }


def run_detection_logic():
    """執行檢測邏輯 (重構版)"""
    global stop_detection_flag, latest_results, data_lock, latest_frame
    last_successful_detection_time = 0
    violation_cooldown = 3.0
    logging.info("🔍 [複合邏輯] 偵測邏輯執行緒已啟動")
    
    while not stop_detection_flag:
        time.sleep(0.2)
        
        # 獲取當前框架和結果
        with data_lock:
            if latest_frame is None or latest_results is None:
                continue
            local_frame_copy = latest_frame.copy()
            local_person_results = latest_results['persons']
            local_plate_results = latest_results['plates']
        
        # 檢查冷卻時間
        current_time = time.time()
        if current_time - last_successful_detection_time < violation_cooldown:
            continue
        
        # 提取檢測結果
        plate_detections = DetectionLogic.extract_plate_detections(local_plate_results, plate_model)
        person_detections = DetectionLogic.extract_person_detections(local_person_results, person_model)
        
        violation_found_this_frame = False
        
        # 主要流程：以車牌為中心的檢測
        if plate_detections:
            violation_found_this_frame = process_plate_centered_detection(
                plate_detections, person_detections, local_frame_copy
            )
            if violation_found_this_frame:
                last_successful_detection_time = time.time()
        
        # 輔助流程：處理未關聯的騎士
        if not violation_found_this_frame:
            if DetectionLogic.process_unassociated_riders(person_detections, local_frame_copy):
                last_successful_detection_time = time.time()
    
    logging.info("🔍 背景偵測邏輯執行緒已結束")

def process_plate_centered_detection(plate_detections, person_detections, frame_copy):
    """處理以車牌為中心的檢測"""
    for plate in plate_detections:
        # 檢查車牌尺寸有效性
        roi_coords = DetectionLogic.calculate_roi_coordinates(plate['box'])
        if roi_coords['plate_h'] <= 0 or roi_coords['plate_w'] <= 0:
            continue
        
        # 調整 ROI 邊界
        roi_coords = adjust_roi_boundaries(roi_coords, frame_copy.shape)
        
        # 分析違規情況
        person_count, has_no_helmet, max_no_helmet_conf = DetectionLogic.analyze_violations_for_plate(
            person_detections, roi_coords
        )
        
        # 判斷違規並處理
        violations = DetectionLogic.determine_violations(
            person_count, has_no_helmet, max_no_helmet_conf, plate['conf']
        )
        
        if violations:
            process_detected_violations(violations, roi_coords, frame_copy, person_count, has_no_helmet)
            return True
    
    return False

def adjust_roi_boundaries(roi_coords, frame_shape):
    """調整 ROI 邊界以符合框架大小"""
    roi_coords['roi_y2'] = min(frame_shape[0], roi_coords['roi_y2'])
    roi_coords['roi_x2'] = min(frame_shape[1], roi_coords['roi_x2'])
    return roi_coords

def process_detected_violations(violations, roi_coords, frame_copy, person_count, has_no_helmet):
    """處理檢測到的違規"""
    logging.info(f"🚨 [車牌關聯] 偵測到違規! 人數: {person_count}, 是否有未戴安全帽: {has_no_helmet}")
    
    crop_img = frame_copy[
        roi_coords['roi_y1']:roi_coords['roi_y2'], 
        roi_coords['roi_x1']:roi_coords['roi_x2']
    ]
    
    if crop_img.size > 0:
        threading.Thread(
            target=process_multiple_violations, 
            args=(crop_img, violations), 
            daemon=True
        ).start()

# ==================== 10. 視頻串流模組 ====================
class VideoRenderer:
    """視頻渲染器"""
    
    @staticmethod
    def calculate_display_scale(frame_width):
        """計算顯示縮放比例"""
        return DISPLAY_WIDTH / frame_width if frame_width > DISPLAY_WIDTH else 1.0
    
    @staticmethod
    def resize_frame_for_display(frame, scale_factor):
        """為顯示調整框架大小"""
        if scale_factor != 1.0:
            height, width = frame.shape[:2]
            return cv2.resize(frame, (DISPLAY_WIDTH, int(height * scale_factor)))
        return frame
    
    @staticmethod
    def draw_person_detections(frame, person_results, scale_factor):
        """繪製人員檢測結果"""
        for box in person_results.boxes:
            if box.conf[0] > VISUAL_CONFIDENCE:
                x1, y1, x2, y2 = map(int, [b * scale_factor for b in box.xyxy[0]])
                conf, class_name = box.conf[0], person_model.names[int(box.cls[0])]
                color = (0, 0, 255) if class_name == NO_HELMET_CLASS_NAME else (0, 255, 0)
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(frame, f'{class_name} {conf:.2f}', (x1, y1 - 10), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
    
    @staticmethod
    def draw_plate_detections(frame, plate_results, scale_factor):
        """繪製車牌檢測結果"""
        for box in plate_results.boxes:
            if box.conf[0] > VISUAL_CONFIDENCE:
                x1, y1, x2, y2 = map(int, [b * scale_factor for b in box.xyxy[0]])
                conf, class_name = box.conf[0], plate_model.names[int(box.cls[0])]
                color = (255, 0, 0)
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(frame, f'{class_name} {conf:.2f}', (x1, y1 - 10), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
    
    @staticmethod
    def encode_frame_to_jpeg(frame):
        """將框架編碼為 JPEG"""
        (flag, encoded_image) = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
        return flag, encoded_image

def generate_frames():
    """生成視頻串流框架 (重構版)"""
    global stop_detection_flag, data_lock, latest_frame, latest_results
    
    while not stop_detection_flag:
        time.sleep(1/TARGET_FPS)
        
        # 獲取最新的框架和結果
        with data_lock:
            if latest_frame is None or latest_results is None:
                continue
            frame_to_show = latest_frame.copy()
            person_results_to_show = latest_results['persons']
            plate_results_to_show = latest_results['plates']
        
        # 計算顯示比例並調整框架大小
        height, width = frame_to_show.shape[:2]
        scale_factor = VideoRenderer.calculate_display_scale(width)
        frame_to_show = VideoRenderer.resize_frame_for_display(frame_to_show, scale_factor)
        
        # 繪製檢測結果
        VideoRenderer.draw_person_detections(frame_to_show, person_results_to_show, scale_factor)
        VideoRenderer.draw_plate_detections(frame_to_show, plate_results_to_show, scale_factor)
        
        # 編碼並產生串流
        flag, encoded_image = VideoRenderer.encode_frame_to_jpeg(frame_to_show)
        if not flag:
            continue
        
        yield(b'--frame\r\n' b'Content-Type: image/jpeg\r\n\r\n' + 
              bytearray(encoded_image) + b'\r\n')

# ==================== 11. 模型管理模組 ====================
class ModelManager:
    """模型管理器"""
    
    @staticmethod
    def validate_model_path(model_path, model_name):
        """驗證模型路徑"""
        if not model_path or not os.path.exists(model_path):
            raise ValueError(f"{model_name}模型不存在: {model_path}")
    
    @staticmethod
    def load_person_model():
        """載入人員檢測模型"""
        global person_model
        if person_model is None:
            ModelManager.validate_model_path(PERSON_MODEL_PATH, "騎士偵測")
            person_model = YOLO(PERSON_MODEL_PATH)
            logging.info("✅ 騎士偵測 YOLO 模型載入成功！")
    
    @staticmethod
    def load_plate_model():
        """載入車牌檢測模型"""
        global plate_model
        if plate_model is None:
            ModelManager.validate_model_path(PLATE_MODEL_PATH, "車牌偵測")
            plate_model = YOLO(PLATE_MODEL_PATH)
            logging.info("✅ 車牌偵測 YOLO 模型載入成功！")
    
    @staticmethod
    def load_all_models():
        """載入所有模型"""
        ModelManager.load_person_model()
        ModelManager.load_plate_model()

# ==================== 12. 攝影機管理模組 ====================
class CameraManager:
    """攝影機管理器"""
    
    @staticmethod
    def parse_video_source(video_path):
        """解析視頻來源"""
        return int(video_path) if video_path.isdigit() else video_path
    
    @staticmethod
    def setup_camera(capture_source):
        """設置攝影機"""
        global global_cap
        global_cap = cv2.VideoCapture(capture_source)
        global_cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        global_cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        
        if not global_cap.isOpened():
            raise IOError(f"無法開啟影像來源: {capture_source}")
        
        # 記錄實際解析度
        width = global_cap.get(cv2.CAP_PROP_FRAME_WIDTH)
        height = global_cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
        logging.info(f"✅ 攝影機請求 1280x720，實際啟動解析度: {int(width)}x{int(height)}")
    
    @staticmethod
    def test_camera_connection(video_path):
        """測試攝影機連線"""
        capture_source = CameraManager.parse_video_source(video_path)
        test_cap = cv2.VideoCapture(capture_source)
        
        if test_cap.isOpened():
            ret, frame = test_cap.read()
            test_cap.release()
            if ret and frame is not None:
                height, width = frame.shape[:2]
                return True, f"攝影機 {video_path} 連線成功", f"{width}x{height}"
        
        return False, f"無法連線到攝影機: {video_path}", None

# ==================== 13. 執行緒管理模組 ====================
class ThreadManager:
    """執行緒管理器"""
    
    @staticmethod
    def start_detection_threads():
        """啟動檢測執行緒"""
        global stop_detection_flag, producer_thread, inference_thread, logic_thread
        
        stop_detection_flag = False
        producer_thread = threading.Thread(target=frame_producer, daemon=True)
        inference_thread = threading.Thread(target=perform_inference, daemon=True)
        logic_thread = threading.Thread(target=run_detection_logic, daemon=True)
        
        producer_thread.start()
        inference_thread.start()
        logic_thread.start()
        
        logging.info("🚀 雙模型偵測任務開始")
    
    @staticmethod
    def stop_detection_threads():
        """停止檢測執行緒"""
        global stop_detection_flag, producer_thread, logic_thread, inference_thread
        global global_cap, latest_frame, latest_results, data_lock
        
        logging.info("🛑 收到停止偵測的請求...")
        stop_detection_flag = True
        
        # 等待執行緒結束
        threads = [producer_thread, inference_thread, logic_thread]
        for thread in threads:
            if thread:
                thread.join(timeout=2)
        
        # 清理資源
        if global_cap:
            global_cap.release()
            global_cap = None
        
        # 清空佇列
        while not frame_queue.empty():
            try:
                frame_queue.get_nowait()
            except queue.Empty:
                break
        
        # 清理共享數據
        with data_lock:
            latest_frame = None
            latest_results = None
        
        producer_thread, inference_thread, logic_thread = None, None, None
        logging.info("✅ 偵測已完全停止")

# ==================== 14. Flask API 端點 ====================
@app.route('/video_feed')
def video_feed():
    """視頻串流端點"""
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/start_detection', methods=['POST'])
def start_detection():
    """啟動檢測端點"""
    global producer_thread
    
    # 檢查是否已在運行
    if producer_thread and producer_thread.is_alive():
        return jsonify({"status": "fail", "message": "偵測已經在運行中。"}), 400
    
    # 獲取請求參數
    data = request.get_json()
    video_path = data.get('video_path')
    if not video_path:
        return jsonify({"status": "fail", "message": "請提供 'video_path'。"}), 400
    
    try:
        # 載入模型
        ModelManager.load_all_models()
        
        # 設置攝影機
        capture_source = CameraManager.parse_video_source(video_path)
        CameraManager.setup_camera(capture_source)
        
        # 啟動執行緒
        ThreadManager.start_detection_threads()
        
        return jsonify({"status": "success"})
        
    except ValueError as e:
        return jsonify({"status": "fail", "message": str(e)}), 500
    except IOError as e:
        return jsonify({"status": "fail", "message": str(e)}), 400
    except Exception as e:
        return jsonify({"status": "fail", "message": f"模型載入失敗: {e}"}), 500

@app.route('/stop_detection', methods=['POST'])
def stop_detection():
    """停止檢測端點"""
    global producer_thread
    
    if not (producer_thread and producer_thread.is_alive()):
        return jsonify({"status": "fail", "message": "偵測並未在運行中。"}), 400
    
    ThreadManager.stop_detection_threads()
    return jsonify({"status": "success", "message": "偵測已停止。"})

@app.route('/status', methods=['GET'])
def get_status():
    """獲取狀態端點"""
    global producer_thread
    is_running = producer_thread and producer_thread.is_alive()
    return jsonify({
        "status": "running" if is_running else "stopped", 
        "message": f"偵測正在{'運行' if is_running else '停止'}中。"
    })

@app.route('/set_confidence', methods=['POST'])
def set_confidence():
    """設置信心度端點"""
    global CONFIDENCE_THRESHOLD, VISUAL_CONFIDENCE
    
    data = request.get_json()
    if not data or 'confidence' not in data:
        return jsonify({
            "status": "fail", 
            "message": "請提供 'confidence' 參數 (0-100)"
        }), 400
    
    try:
        confidence_percent = float(data['confidence'])
        if not (0 <= confidence_percent <= 100):
            return jsonify({
                "status": "fail", 
                "message": "信心度必須在 0-100 之間"
            }), 400
        
        new_threshold = confidence_percent / 100.0
        CONFIDENCE_THRESHOLD = new_threshold
        VISUAL_CONFIDENCE = max(0.3, new_threshold - 0.1)
        
        logging.info(f"🎯 信心度閾值已更新：{CONFIDENCE_THRESHOLD:.2f} (顯示閾值：{VISUAL_CONFIDENCE:.2f})")
        return jsonify({
            "status": "success", 
            "message": "信心度閾值已設定為 {confidence_percent}%"
        })
        
    except ValueError:
        return jsonify({"status": "fail", "message": "信心度必須是數字"}), 400

@app.route('/get_confidence', methods=['GET'])
def get_confidence():
    """獲取信心度端點"""
    return jsonify({
        "status": "success", 
        "confidence_percent": int(CONFIDENCE_THRESHOLD * 100)
    })

@app.route('/test_camera', methods=['POST'])
def test_camera():
    """測試攝影機端點"""
    data = request.get_json()
    video_path = data.get('video_path')
    if not video_path:
        return jsonify({"status": "fail", "message": "請提供 'video_path'。"}), 400
    
    try:
        success, message, resolution = CameraManager.test_camera_connection(video_path)
        if success:
            return jsonify({
                "status": "success", 
                "message": message, 
                "resolution": resolution
            })
        else:
            return jsonify({"status": "fail", "message": message}), 400
            
    except Exception as e:
        return jsonify({"status": "fail", "message": f"測試失敗: {str(e)}"}), 500

# ==================== 15. 應用程式啟動 ====================
def validate_startup_requirements():
    """驗證啟動需求"""
    if not PERSON_MODEL_PATH or not os.path.exists(PERSON_MODEL_PATH):
        print("❌ 錯誤：找不到騎士模型檔案，請檢查 .env 的 HELMATE_MODEL_PATH！")
        sys.exit(1)
    if not PLATE_MODEL_PATH or not os.path.exists(PLATE_MODEL_PATH):
        print("❌ 錯誤：找不到車牌模型檔案，請檢查 .env 的 PLATE_MODEL_PATH！")
        sys.exit(1)

def print_startup_banner():
    """印出啟動橫幅"""
    print("=" * 60)
    print("⚡ 交通 AI 系統 - 雙模型整合模式 (複合邏輯版)")
    print("=" * 60)
    print(f"🔧 騎士模型：{PERSON_MODEL_PATH}")
    print(f"🔧 車牌模型：{PLATE_MODEL_PATH}")
    print("=" * 60)
    print("\n🚀 啟動 Flask 伺服器...")
    print("📱 前端請訪問: http://localhost:8080")
    print("🔧 API 端點: http://localhost:5001")
    print("按 Ctrl+C 停止服務\n")

# ==================== 16. 主程序入口 ====================
if __name__ == "__main__":
    try:
        # 驗證啟動需求
        validate_startup_requirements()
        
        # 印出啟動橫幅
        print_startup_banner()
        
        # 啟動 Flask 應用
        app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)
        
    except KeyboardInterrupt:
        print("\n🛑 收到中斷信號，正在停止...")
        if 'system_state' in globals():
            ThreadManager.stop_detection_threads()
        print("✅ 系統已安全停止")
    except Exception as e:
        print(f"❌ 系統啟動失敗: {e}")
        sys.exit(1)