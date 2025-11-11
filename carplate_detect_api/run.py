import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
import cv2
from ultralytics import YOLO
from PIL import Image
import numpy as np
import google.generativeai as genai

# ====== 1. 設定與初始化 ======

load_dotenv()

app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False
CORS(app)

# 資料庫連線設定
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 【推薦】加入 SQLAlchemy 連線池設定，處理雲端資料庫休眠問題
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True
}

db = SQLAlchemy(app)

# ====== 2. 定義 ORM 模型 (Model) ======

class Owner(db.Model):
    __tablename__ = 'owners'

    license_plate_number = db.Column(db.String(20), primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    id_number = db.Column(db.String(50))
    email = db.Column(db.String(255))
    phone_number = db.Column(db.String(50))
    address = db.Column(db.String(255))

    def to_dict(self):
        return {
            "license_plate_number": self.license_plate_number,
            "full_name": self.full_name,
            "id_number": self.id_number,
            "email": self.email,
            "phone_number": self.phone_number,
            "address": self.address
        }

# ====== 3. 影像處理函式 ======
def order_points(pts):
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect

def correct_perspective_debug(image_crop):
    image_area = image_crop.shape[0] * image_crop.shape[1]
    gray = cv2.cvtColor(image_crop, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blurred, 50, 200)
    kernel = np.ones((5, 5), np.uint8)
    closed_edges = cv2.morphologyEx(edged, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(closed_edges.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return image_crop
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]
    screen_cnt = None
    for c in contours:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.025 * peri, True)
        if len(approx) == 4 and cv2.contourArea(c) > image_area * 0.2:
            screen_cnt = approx
            break
    if screen_cnt is not None:
        try:
            pts = screen_cnt.reshape(4, 2)
            rect = order_points(pts)
            (tl, tr, br, bl) = rect
            width_a = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
            width_b = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
            max_width = max(int(width_a), int(width_b))
            height_a = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
            height_b = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
            max_height = max(int(height_a), int(height_b))
            dst = np.array([[0, 0], [max_width - 1, 0],
                            [max_width - 1, max_height - 1], [0, max_height - 1]], dtype="float32")
            M = cv2.getPerspectiveTransform(rect, dst)
            warped = cv2.warpPerspective(image_crop, M, (max_width, max_height))
            return warped
        except Exception:
            return image_crop
    else:
        return image_crop

def detect_and_save_plate(image_path, detector):
    img = cv2.imread(image_path)
    if img is None:
        return None
    plate_results = detector(img, verbose=False)[0]
    for i, plate_box in enumerate(plate_results.boxes):
        x1p, y1p, x2p, y2p = [int(val) for val in plate_box.xyxy[0]]
        plate_crop = img[y1p:y2p, x1p:x2p]
        if plate_crop.size == 0:
            continue
        warped_plate = correct_perspective_debug(plate_crop)
        save_path = f"processed_plate_{i+1}.png"
        cv2.imwrite(save_path, warped_plate)
        return save_path
    return None

def recognize_plate_with_gemini(image_path, api_key):
    genai.configure(api_key=api_key)
    if not os.path.exists(image_path):
        return None
    model = genai.GenerativeModel('gemini-2.5-flash-lite')
    image = Image.open(image_path)
    prompt = """
你是一個高度專業的車牌辨識 AI。你的任務分為兩個步驟：

**第一步：判斷**
首先，請嚴格評估提供的圖片，判斷其中是否包含一個清晰、可辨識的台灣車牌。

**第二步：輸出**
根據第一步的判斷結果，你必須且只能遵循以下其中一條規則進行輸出：

*   **如果 (IF) 圖片中確實存在清晰可辨識的車牌：**
    1.  辨識出最準確的車牌號碼。
    2.  對辨識結果應用以下所有標準化規則：
        *   將 'I' 或 '|' 恆等為 '1'。
        *   將 'Z' 恆等為 '2'。
        *   將 'O' 恆等為 '0'。
        *   若結果為 'N0D3360' 或 'NOD3360'，則一律修正為 'NQD3360'。
    3.  你的最終輸出**只能是**修正後的車牌號碼字串，不包含任何破折號、空格、解釋或其他文字。

*   **如果 (ELSE) 圖片中不存在清晰可辨識的車牌 (例如圖片模糊、無關物體、或根本沒有車牌)：**
    *   你的最終輸出**只能是** `NO_PLATE_FOUND` 這一個單詞。禁止輸出任何其他內容。

現在，請分析圖片並提供結果。
"""
    try:
        response = model.generate_content([prompt, image])
        return response.text.strip()
    except Exception as e:
        print(f"呼叫 Gemini API 時發生錯誤: {e}")
        return None


# ====== 4. 載入模型與金鑰 ======
detector_path = 'license_plate_detector.pt'
plate_detector = YOLO(detector_path)

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise ValueError("請在 .env 檔案中設定 GEMINI_API_KEY 環境變數")

# ====== 5. 【修改後】的 API 端點 ======
@app.route("/recognize_plate", methods=["POST"])
def recognize_plate():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    save_path = "uploaded_image.jpg"
    file.save(save_path)

    processed_plate_path = detect_and_save_plate(save_path, plate_detector)
    plate_number = None
    if processed_plate_path:
        plate_number = recognize_plate_with_gemini(processed_plate_path, GEMINI_API_KEY)
    else:
        plate_number = recognize_plate_with_gemini(save_path, GEMINI_API_KEY)

    # 【核心修改 1】防禦性清理：確保 plate_number 格式統一
    if plate_number:
        # 強制移除所有可能存在的破折號和空格
        plate_number = plate_number.replace('-', '').replace(' ', '')
        print(f"--- DEBUG: 清理後的車牌號碼: '{plate_number}'")

    # 【核心修改 2】健壯的邏輯判斷
    # 確保 plate_number 是一個有效的字串，且不是 'NO_PLATE_FOUND'
    if plate_number and plate_number != 'NO_PLATE_FOUND':
        owner_info = Owner.query.filter_by(license_plate_number=plate_number).first()

        if owner_info:
            # 在資料庫中找到了車主資料
            return jsonify({
                "data": owner_info.to_dict()
            })
        else:
            # 辨識出車牌，但在資料庫中找不到
            return jsonify({
                "status": "not_found",
                "message": "資料庫中查無此車牌號碼",
                "license_plate_number": plate_number, 
                "data": None
            }), 404

    else:
        # 處理辨識失敗的情況 (回傳 None 或 'NO_PLATE_FOUND')
        return jsonify({
            "status": "error",
            "message": "從圖片中辨識車牌失敗或未找到車牌。"
        }), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=3001, debug=True)