import os
import psycopg2
import secrets
import base64
import psutil
import traceback
import io
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt, JWTManager
from functools import wraps
from flask_mail import Mail, Message
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from datetime import datetime, timedelta, timezone
from flask_jwt_extended import get_jwt_identity



# --- 應用程式設定 ---
load_dotenv()
app = Flask(__name__)

# 允許的前端來源，.env 裡可設定 CORS_ALLOWED_ORIGINS=http://localhost:8080
allowed_origins = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:8080')
CORS(app, resources={
    r"/*": {  # 匹配所有路徑
        "origins": allowed_origins,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Type", "Authorization"]
    }
})
socketio = SocketIO(app, cors_allowed_origins=allowed_origins)

# JWT 設定
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "default-dev-secret-key") 
jwt = JWTManager(app)

# Mail 初始化設定
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'True').lower() in ['true', '1', 't']
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER')
mail = Mail(app)

# --- SQL 查詢常數 ---
SQL_SELECT_USER_ID_BY_USERNAME = "SELECT id FROM users WHERE username = %s"

# --- 錯誤訊息常數 ---
ERROR_INTERNAL_SERVER = "Internal Server Error"
ERROR_INTERNAL_SERVER_ZH = "伺服器內部錯誤"
ERROR_INTERNAL_SERVER_USER = "找不到用戶"

# --- 手動標註違規類型與罰金對應表 ---
MANUAL_VIOLATION_FINES = {
    "違規乘載人數": 1000,
    "未戴安全帽": 800,
    "亂丟煙蒂": 600
}

# Email發送函數
import smtplib
import base64
import os
import psycopg2
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage

# --- 資料庫連線 (根據您的原碼) ---
def get_db_connection():
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise ValueError("DATABASE_URL not set in .env file")
    conn = psycopg2.connect(db_url)
    return conn

# ==================================================
# Email 輔助函數
# ==================================================
def format_timestamp_for_email(timestamp_input):
    """格式化時間戳為電子郵件顯示格式"""
    if not timestamp_input:
        return 'N/A'
    
    timestamp_str = timestamp_input.isoformat() if hasattr(timestamp_input, 'isoformat') else str(timestamp_input)
    
    try:
        date_part_str, time_part_str_with_zone = timestamp_str.split('T') if 'T' in timestamp_str else timestamp_str.split(' ', 1)
        date_part = date_part_str.replace('-', '/')
        
        if not time_part_str_with_zone:
            return date_part
        
        # 清理時區信息
        time_part_clean = time_part_str_with_zone.split('+')[0] if '+' in time_part_str_with_zone else time_part_str_with_zone.rstrip('Z')
        main_time_part = time_part_clean.split('.')[0]
        hours, minutes, seconds = map(int, main_time_part.split(':'))
        
        ampm = '下午' if hours >= 12 else '上午'
        display_hours = hours % 12 or 12
        time_part = f"{ampm} {display_hours}:{minutes:02d}:{seconds:02d}"
        
        return f"{date_part} {time_part}"
        
    except Exception as e:
        print(f"❌ 時間格式化失敗: {timestamp_input}, 錯誤: {e}")
        return str(timestamp_input)

def format_current_time():
    """格式化當前時間為台灣時區"""
    taiwan_tz = timezone(timedelta(hours=8))
    now = datetime.now(taiwan_tz)
    date_part = now.strftime('%Y/%m/%d')
    hours, minutes, seconds = now.hour, now.minute, now.second
    ampm = '下午' if hours >= 12 else '上午'
    display_hours = hours % 12 or 12
    time_part = f"{ampm} {display_hours}:{minutes:02d}:{seconds:02d}"
    return f"{date_part} {time_part}"

def get_violation_image_data(violation_id):
    """獲取違規照片數據"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        image_query = "SELECT image_data FROM violations WHERE id = %s"
        cur.execute(image_query, (violation_id,))
        image_result = cur.fetchone()
        cur.close()
        conn.close()
        
        image_data_base64 = image_result[0] if image_result and image_result[0] else None
        print(f"🔍 DEBUG: Fetching image for violation ID {violation_id}. Found: {'Yes' if image_data_base64 else 'No'}")
        return image_data_base64
    except Exception as e:
        print(f"❌ 獲取違規照片失敗: {e}")
        return None

def get_owner_information(plate_number):
    """獲取車主資訊"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        owner_query = """
            SELECT full_name, id_number, gender, date_of_birth, phone_number, email, address, vehicle_type
            FROM owners 
            WHERE license_plate_number = %s
        """
        cur.execute(owner_query, (plate_number,))
        owner_info = cur.fetchone()
        cur.close()
        conn.close()
        
        if owner_info:
            _, id_number, gender, birth_date, phone, owner_email, address, vehicle_type = owner_info
            formatted_birth_date = birth_date.strftime('%Y/%m/%d') if birth_date else 'N/A'
            return {
                'id_number': id_number,
                'gender': gender,
                'birth_date': formatted_birth_date,
                'phone': phone,
                'email': owner_email,
                'address': address,
                'vehicle_type': vehicle_type
            }
        else:
            print(f"❌ DEBUG: No owner info found for {plate_number}")
            return {
                'id_number': 'N/A', 'gender': 'N/A', 'birth_date': 'N/A',
                'phone': 'N/A', 'email': 'N/A', 'address': 'N/A', 'vehicle_type': 'N/A'
            }
    except Exception as e:
        print(f"❌ 獲取車主資訊失敗: {e}")
        return None

def create_email_html_body(violation_data, owner_name, owner_info, formatted_violation_time, formatted_current_time, image_data_base64):
    """創建HTML郵件內容"""
    image_section = ('<img src="cid:violation_photo" alt="違規照片" class="violation-image">' 
                    if image_data_base64 else 
                    '<div style="border: 2px dashed #ccc; padding: 20px; background-color: #f8f9fa; border-radius: 8px; margin-top: 10px;">'
                    '<p style="color: #666; margin: 0; font-size: 14px;">無違規照片</p></div>')
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: 'Microsoft JhengHei', 'SimHei', Arial, sans-serif; margin: 0; padding: 20px; line-height: 1.6; background-color: #f5f5f5; }}
            .container {{ max-width: 800px; margin: 0 auto; background: white; border: 2px solid #ddd; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }}
            .header {{ background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; text-align: center; padding: 30px 20px; border-radius: 6px 6px 0 0; }}
            .header h1 {{ font-size: 28px; font-weight: bold; margin: 0 0 10px 0; letter-spacing: 1px; }}
            .header p {{ margin: 5px 0; font-size: 16px; }}
            .content {{ padding: 30px; }}
            .section {{ margin: 20px 0; padding: 25px; background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; }}
            .section-title {{ font-size: 18px; font-weight: bold; color: #333; margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }}
            .two-column {{ display: flex; gap: 40px; justify-content: space-between; flex-wrap: wrap; }}
            .column {{ flex: 1; min-width: 280px; padding: 0 10px; }}
            .field {{ margin: 8px 0; display: flex; align-items: flex-start; min-height: 24px; }}
            .label {{ font-weight: bold; color: #495057; min-width: 80px; flex-shrink: 0; margin-right: 8px; text-align: left; }}
            .value {{ color: #212529; flex: 1; word-wrap: break-word; line-height: 1.4; }}
            .violation-details {{ background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 25px; border-radius: 8px; margin: 20px 0; }}
            .violation-image {{ max-width: 100%; height: auto; border: 2px solid #ddd; border-radius: 8px; margin-top: 10px; display: block; }}
            .notice-section {{ background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 25px; border-radius: 5px; margin: 25px 0; }}
            .notice-title {{ font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #721c24; }}
            .footer {{ text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 14px; color: #6c757d; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>交通違規電子罰單</h1>
                <p>罰單編號: VIO-{violation_data['id']}</p>
                <p>開立日期: {datetime.now().strftime('%Y/%m/%d')}</p>
            </div>
            <div class="content">
                <div class="section">
                    <div class="section-title">車主基本資料</div>
                    <div class="two-column">
                        <div class="column">
                            <div class="field"><span class="label">車主姓名:</span><span class="value">{owner_name}</span></div>
                            <div class="field"><span class="label">身分證字號:</span><span class="value">{owner_info['id_number']}</span></div>
                            <div class="field"><span class="label">性別:</span><span class="value">{owner_info['gender']}</span></div>
                            <div class="field"><span class="label">出生年月日:</span><span class="value">{owner_info['birth_date']}</span></div>
                        </div>
                        <div class="column">
                            <div class="field"><span class="label">聯絡電話:</span><span class="value">{owner_info['phone']}</span></div>
                            <div class="field"><span class="label">電子郵件:</span><span class="value">{owner_info['email']}</span></div>
                            <div class="field"><span class="label">戶籍地址:</span><span class="value">{owner_info['address']}</span></div>
                        </div>
                    </div>
                </div>
                <div class="violation-details">
                    <div class="section-title">違規詳細資訊</div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 20px;">
                        <div style="flex-grow: 1; min-width: 320px;">
                            <div class="field"><span class="label">車牌號碼:</span><span class="value">{violation_data['plateNumber']}</span></div>
                            <div class="field"><span class="label">車輛類型:</span><span class="value">{owner_info['vehicle_type']}</span></div>
                            <div class="field"><span class="label">違規類型:</span><span class="value" style="color: #dc3545; font-weight: bold;">{violation_data['type']}</span></div>
                            <div class="field"><span class="label">違規時間:</span><span class="value">{formatted_violation_time}</span></div>
                            <div class="field"><span class="label">違規地點:</span><span class="value">{violation_data['location']}</span></div>
                        </div>
                        <div style="flex-shrink: 0; width: 300px; text-align: center;">
                            <div class="label" style="width: 100%; margin-bottom: 10px;">違規照片</div>
                            {image_section}
                        </div>
                    </div>
                </div>
                <div class="notice-section">
                    <div class="notice-title">注意事項</div>
                    <p>接獲違反道路交通管理事件電子通知單後，依所記載「應到案日期」前往監理所、站接受裁處或以郵繳即時銷案、電話語音轉帳、網路方式繳納罰鍰。</p>
                    <p>如發現通知單上所填載之車牌號碼或被通知人姓名有疑問，請於應到案日期前向原舉發單位或監理所、站提出書面申請要求更正。</p>
                </div>
            </div>
            <div class="footer">
                <p><strong>智慧交通監控系統</strong></p>
                <p>自動發送時間: {formatted_current_time}</p>
                <p style="color: #dc3545; font-weight: bold;">本郵件為系統自動發送，請勿直接回覆</p>
            </div>
        </div>
    </body>
    </html>
    """

def create_email_text_body(violation_data, owner_name, formatted_violation_time, formatted_current_time):
    """創建純文字郵件內容"""
    return f"""交通違規電子罰單通知

罰單編號: VIO-{violation_data['id']}
車主姓名: {owner_name}
車牌號碼: {violation_data['plateNumber']}

違規詳細資訊:
違規類型: {violation_data['type']}
違規時間: {formatted_violation_time}
違規地點: {violation_data['location']}

注意事項:
請依所記載「應到案日期」前往監理所、站接受裁處或以多元方式繳納罰鍰。
如有疑問，請洽詢服務專線或至監理站辦理。

智慧交通監控系統
發送時間: {formatted_current_time}"""

def attach_violation_image(msg, image_data_base64, violation_id):
    """附加違規照片到郵件"""
    if not image_data_base64:
        return False
        
    try:
        if image_data_base64.startswith('data:image'):
            image_data_base64 = image_data_base64.split(',')[1]
        
        image_data = base64.b64decode(image_data_base64)
        image = MIMEImage(image_data)
        image.add_header('Content-Disposition', 'inline', filename=f"violation_{violation_id}.jpg")
        image.add_header('Content-ID', '<violation_photo>')
        msg.attach(image)
        print(f"✅ DEBUG: 違規照片已作為內嵌圖片添加 (大小: {len(image_data)} bytes)")
        return True
    except Exception as img_error:
        print(f"❌ 處理違規照片失敗: {img_error}")
        return False

def send_email_via_smtp(msg, recipient_email):
    """透過 SMTP 發送郵件"""
    try:
        smtp_server = smtplib.SMTP(app.config['MAIL_SERVER'], app.config['MAIL_PORT'])
        if app.config.get('MAIL_USE_TLS'):
            smtp_server.starttls()
        smtp_server.login(app.config['MAIL_USERNAME'], app.config['MAIL_PASSWORD'])
        smtp_server.send_message(msg)
        smtp_server.quit()
        print(f"✅ Email sent successfully to {recipient_email}")
        return True
    except Exception as smtp_error:
        print(f"❌ SMTP發送失敗: {smtp_error}")
        return False

def send_email_via_fallback(subject, recipient_email, html_body, text_body):
    """備用郵件發送方式"""
    try:
        mail_msg = Message(subject=subject, recipients=[recipient_email], html=html_body, body=text_body)
        mail.send(mail_msg)
        print(f"✅ 備用郵件發送成功 to {recipient_email} (可能無內嵌圖片)")
        return True
    except Exception as fallback_error:
        print(f"❌ 備用郵件發送也失敗: {fallback_error}")
        return False

# Email發送函數 (重構後的主函數)
def send_violation_ticket_email(recipient_email, owner_name, violation_data):
    """
    發送交通違規罰單電子郵件（包含內嵌的違規照片）
    """
    try:
        # 1. 獲取基本數據
        formatted_current_time = format_current_time()
        formatted_violation_time = format_timestamp_for_email(violation_data['timestamp'])
        
        # 2. 獲取違規照片和車主資訊
        image_data_base64 = get_violation_image_data(violation_data['id'])
        owner_info = get_owner_information(violation_data['plateNumber'])
        
        if not owner_info:
            return False
        
        # 3. 創建郵件內容
        subject = f"交通違規電子罰單通知 - 車牌: {violation_data['plateNumber']}"
        html_body = create_email_html_body(violation_data, owner_name, owner_info, formatted_violation_time, formatted_current_time, image_data_base64)
        text_body = create_email_text_body(violation_data, owner_name, formatted_violation_time, formatted_current_time)
        
        # 4. 組裝郵件
        msg = MIMEMultipart('related')
        msg['Subject'] = subject
        msg['From'] = app.config['MAIL_DEFAULT_SENDER']
        msg['To'] = recipient_email
        
        msg_alternative = MIMEMultipart('alternative')
        msg.attach(msg_alternative)
        msg_alternative.attach(MIMEText(text_body, 'plain', 'utf-8'))
        msg_alternative.attach(MIMEText(html_body, 'html', 'utf-8'))
        
        # 5. 附加圖片
        attach_violation_image(msg, image_data_base64, violation_data['id'])
        
        # 6. 發送郵件 (嘗試 SMTP，失敗則使用備用方式)
        if send_email_via_smtp(msg, recipient_email):
            return True
        else:
            return send_email_via_fallback(subject, recipient_email, html_body, text_body)
        
    except Exception as e:
        import traceback
        print(f"❌ Failed to send email to {recipient_email}: {str(e)}")
        print(f"❌ 完整追蹤: {traceback.format_exc()}")
        return False
# ==================================================
# 【建立日誌記錄器 (log_action)】
# ==================================================
def log_action(module: str, level: str, action: str, details: str = "", user_identity=None, client_ip=None):
    """
    將一個操作記錄寫入 system_logs 資料表。
    :param module: 功能模組名稱
    :param level: 日誌等級 ('INFO', 'WARNING', 'ERROR')
    :param action: 執行的操作
    :param details: 詳細描述
    :param user_identity: 來自 get_jwt_identity() 的使用者身分
    :param client_ip: 請求的 IP 位址
    """
    username = "系統" # 預設為系統操作
    user_id = None
    if user_identity:
        # 從 JWT 的 identity 中解析使用者資訊
        # 假設 identity 可能是字串或字典
        if isinstance(user_identity, dict):
            username = user_identity.get('username', '未知使用者')
        else:
            username = str(user_identity)
        
        # (可選但建議) 查詢 user_id
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute(SQL_SELECT_USER_ID_BY_USERNAME, (username,))
            result = cur.fetchone()
            if result:
                user_id = result[0]
            cur.close()
            conn.close()
        except Exception as e:
            print(f"❌ 日誌記錄器中查詢 user_id 失敗: {e}")

    sql = """
        INSERT INTO system_logs (user_id, username, module, level, action, details, client_ip)
        VALUES (%s, %s, %s, %s, %s, %s, %s);
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(sql, (user_id, username, module, level, action, details, client_ip))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        # 如果日誌記錄失敗，我們不應該讓主操作失敗，所以只印出錯誤
        print(f"❌❌❌ 嚴重警告：寫入系統日誌失敗！錯誤: {e}")

# ==================================================
# 【權限控制裝飾器】
# ==================================================
def admin_required():
    def wrapper(fn):
        @wraps(fn)
        @jwt_required()
        def decorator(*args, **kwargs):
            claims = get_jwt()
            user_role = claims.get("role")
            if user_role != "admin":
                return jsonify(error="權限不足，僅限管理員操作"), 403
            return fn(*args, **kwargs)
        return decorator
    return wrapper

# ==================================================
# 攝影機相關 API
# ==================================================
@app.route('/api/cameras/status', methods=['GET'])
def get_cameras():
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute('SELECT id, name, status FROM cameras;')
            cameras_raw = cur.fetchall()
        conn.close()
        cameras = [{'id': row[0], 'name': row[1], 'status': row[2]} for row in cameras_raw]
        return jsonify(cameras)
    except Exception as e:
        print("❌ Error in get_cameras:", e)
        return jsonify({'error': ERROR_INTERNAL_SERVER}), 500

@app.route('/api/cameras/list', methods=['GET'])
def get_cameras_list():
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute('SELECT name FROM cameras;')
            cameras_raw = cur.fetchall()
        conn.close()
        cameras = [{'camera_name': row[0]} for row in cameras_raw]
        return jsonify(cameras)
    except Exception as e:
        print("❌ Error in get_cameras_list:", e)
        return jsonify({'error': ERROR_INTERNAL_SERVER}), 500

# ==================================================
# 違規類型 API
# ==================================================
@app.route('/api/violations/types', methods=['GET'])
def get_violation_types():
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute('SELECT DISTINCT violation_type FROM violations WHERE violation_type IS NOT NULL ORDER BY violation_type;')
            types_raw = cur.fetchall()
        conn.close()
        violation_types = [{'type_name': row[0]} for row in types_raw]
        return jsonify(violation_types)
    except Exception as e:
        print(f"❌ Error in get_violation_types: {e}")
        return jsonify({'error': ERROR_INTERNAL_SERVER}), 500

@app.route('/api/violations/manual-types', methods=['GET'])
def get_manual_violation_types():
    """
    獲取手動標註的違規類型及其對應的罰金
    """
    try:
        manual_types = [
            {
                'type_name': violation_type,
                'fine_amount': fine_amount,
                'formatted_fine': f"NT${fine_amount:,}"
            }
            for violation_type, fine_amount in MANUAL_VIOLATION_FINES.items()
        ]
        
        return jsonify({
            'violation_types': manual_types,
            'total_types': len(manual_types)
        })
    except Exception as e:
        print(f"❌ Error in get_manual_violation_types: {e}")
        return jsonify({'error': ERROR_INTERNAL_SERVER}), 500

# ==================================================
# 違規紀錄 API (已修正)
# ==================================================
@app.route('/api/violations', methods=['GET'])
def get_violations():
    try:
        status = request.args.get('status')
        search = request.args.get('search')
        v_type = request.args.get('type')
        location = request.args.get('location')
        date = request.args.get('date')
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        offset = (page - 1) * limit

        # 【修改 1】: 在 SELECT 查詢中加入 confidence 欄位
        base_query = """
            SELECT id, violation_type, license_plate, timestamp, violation_address, status, fine,
                   owner_name, owner_phone, owner_email, owner_address, confidence
            FROM violations
            WHERE 1=1
        """
        
        count_query = "SELECT COUNT(*) FROM violations WHERE 1=1"
        
        params = []
        
        if status and status != '全部':
            base_query += " AND status = %s"
            count_query += " AND status = %s"
            params.append(status)
        if search:
            base_query += " AND license_plate ILIKE %s"
            count_query += " AND license_plate ILIKE %s"
            params.append(f"%{search}%")
        if v_type and v_type != '所有類型':
            base_query += " AND violation_type = %s"
            count_query += " AND violation_type = %s"
            params.append(v_type)
        if location and location != '所有地點':
            base_query += " AND violation_address = %s"
            count_query += " AND violation_address = %s"
            params.append(location)
        if date:
            base_query += " AND timestamp::date = %s"
            count_query += " AND timestamp::date = %s"
            params.append(date)

        base_query += " ORDER BY timestamp DESC LIMIT %s OFFSET %s"

        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(count_query, tuple(params))
            total_count = cur.fetchone()[0]
            
            cur.execute(base_query, tuple(params + [limit, offset]))
            violations_raw = cur.fetchall()
        conn.close()

        # 【修改 2】: 重新對應所有欄位的索引，並加入 confidence
        violations = [
            {
                'id': row[0],
                'type': row[1],
                'plateNumber': row[2],
                'vehicleType': '', # 保持原有結構
                'timestamp': row[3].isoformat() if row[3] else None,
                'location': row[4],
                'status': row[5],
                'fine': row[6],
                'ownerName': row[7],
                'ownerPhone': row[8],
                'ownerEmail': row[9],
                'ownerAddress': row[10],
                'confidence': row[11]  # <--- 新增 confidence 欄位 (現在是第 11 個)
            }
            for row in violations_raw
        ]

        total_pages = (total_count + limit - 1) // limit
        
        response = {
            'data': violations,
            'pagination': {
                'current_page': page,
                'total_pages': total_pages,
                'total_records': total_count,
                'records_per_page': limit,
                'has_next': page < total_pages,
                'has_previous': page > 1
            }
        }
        
        return jsonify(response)

    except Exception as e:
        print(f"❌ Error in get_violations: {e}")
        return jsonify({'error': ERROR_INTERNAL_SERVER, 'details': str(e)}), 500


# ... (其餘所有 API 函式保持不變) ...

#即時違規檢測最新的10筆
@app.route('/api/violations/latest', methods=['GET'])
def get_latest_violations():
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, violation_type, license_plate, timestamp, status
                FROM violations
                ORDER BY timestamp DESC LIMIT 10;
            """)
            violations_raw = cur.fetchall()
        conn.close()

        latest_violations = [
            {
                'id': row[0],
                'type': row[1],
                'plateNumber': row[2],
                'timestamp': row[3].isoformat() + 'Z' if row[3] else None,
                'status': row[4]
            }
            for row in violations_raw
        ]
        return jsonify(latest_violations)
    except Exception as e:
        print(f"❌ Error in get_latest_violations: {e}")
        return jsonify({'error': ERROR_INTERNAL_SERVER}), 500

## ==================================================
# 違規狀態更新 API
# 安全注意：PUT 方法用於更新違規狀態
# OPTIONS 用於 CORS preflight，PUT 需要有效的 JWT 授權
@app.route('/api/violations/status', methods=['PUT', 'OPTIONS'])
def update_violations_status():
    if request.method == 'OPTIONS':
        response = jsonify({'message': 'CORS preflight OK'})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Methods", "PUT, OPTIONS")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        return response, 200

    try:
        # 檢查 JWT 授權
        from flask_jwt_extended import verify_jwt_in_request
        try:
            verify_jwt_in_request()
        except Exception:
            return jsonify({'error': '未授權，請提供有效的認證令牌'}), 401

        data = request.get_json()
        violation_ids = data.get('ids')
        new_status = data.get('status')

        if not violation_ids or not isinstance(violation_ids, list) or len(violation_ids) == 0:
            return jsonify({'error': '請求格式錯誤，需要一個非空的 "ids" 列表'}), 400

        if not new_status or new_status not in ['待審核', '已確認', '已駁回', '已開罰']:
            return jsonify({'error': '無效的 "status" 欄位'}), 400

        conn = get_db_connection()
        with conn.cursor() as cur:
            update_query = "UPDATE violations SET status = %s WHERE id = ANY(%s::int[])"
            params = (new_status, violation_ids)
            cur.execute(update_query, params)
            updated_rows = cur.rowcount
        conn.commit()
        conn.close()
        # --- 【新增日誌記錄】---
        try:
            # 將 ID 列表轉換為字串，方便記錄
            ids_str = ", ".join(map(str, violation_ids))
            log_action(
                module="違規管理",
                level="INFO",
                action="更新違規狀態",
                details=f"將 {updated_rows} 筆違規紀錄 (IDs: {ids_str}) 的狀態更新為 '{new_status}'",
                user_identity=get_jwt_identity(),
                client_ip=request.remote_addr
            )
        except Exception as log_error:
            print(f"⚠️ 警告：記錄 '更新違規狀態' 日誌時發生錯誤: {log_error}")
        # -----------------------

        return jsonify({'message': f'成功更新 {updated_rows} 筆紀錄的狀態'}), 200

    except Exception as e:
        if 'conn' in locals() and conn: conn.rollback()
        print(f"❌ Error in update_violations_status: {e}")
        return jsonify({'error': '內部伺服器錯誤'}), 500

# ==================================================
# 手動標註違規記錄 API
# ==================================================
# 安全注意：POST 方法用於建立新的違規記錄
# OPTIONS 用於 CORS preflight，POST 需要有效的 JWT 授權
@app.route('/api/violations/manual', methods=['POST', 'OPTIONS'])
def create_manual_violation():
    if request.method == 'OPTIONS':
        response = jsonify({'message': 'CORS preflight OK'})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        return response, 200

    try:
        # 檢查 JWT 授權
        from flask_jwt_extended import verify_jwt_in_request
        try:
            verify_jwt_in_request()
        except Exception:
            return jsonify({'error': '未授權，請提供有效的認證令牌'}), 401

        data = request.get_json()

        # 驗證必要欄位
        required_fields = ['license_plate', 'violation_type', 'violation_address', 'image_data']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'缺少必要欄位: {field}'}), 400
        
        # 提取資料
        license_plate = data['license_plate'].strip().upper()
        violation_type = data['violation_type']
        violation_address = data['violation_address']
        image_data = data['image_data']
        annotations = data.get('annotations', [])
        
        # 根據違規類型設定罰金金額
        fine_amount = MANUAL_VIOLATION_FINES.get(violation_type, 900)  # 預設罰金為900元
        
        # 基本驗證
        if len(license_plate) < 3:
            return jsonify({'error': '車牌號碼格式不正確'}), 400
        
        # 準備插入資料庫的資料
        current_time = datetime.now(timezone.utc)
        
        # 查詢車主資料
        owner_name = None
        owner_phone = None
        owner_email = None
        owner_address = None
        
        conn = get_db_connection()
        with conn.cursor() as cur:
            # 先查詢車主資料
            cur.execute("""
                SELECT full_name, phone_number, email, address 
                FROM owners 
                WHERE license_plate_number = %s
            """, (license_plate,))
            owner_data = cur.fetchone()
            
            if owner_data:
                owner_name, owner_phone, owner_email, owner_address = owner_data
            
            # 插入違規記錄（包含車主資料）
            insert_query = """
                INSERT INTO violations (
                    violation_type, license_plate, timestamp, violation_address, 
                    status, confidence, image_data, fine, owner_name, owner_phone, owner_email, owner_address
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """
            
            cur.execute(insert_query, (
                violation_type,
                license_plate,
                current_time,
                violation_address,
                '待審核',  # 手動標註的預設狀態
                '手動標注',  # confidence 統一設為 "手動標注"
                image_data,
                fine_amount,  # 根據違規類型設定的罰金
                owner_name,   # 車主姓名
                owner_phone,  # 車主電話
                owner_email,  # 車主信箱
                owner_address # 車主地址
            ))
            
            violation_id = cur.fetchone()[0]
        
        conn.commit()
        conn.close()
        
        # 記錄日誌
        try:
            log_action(
                module="手動標註",
                level="INFO",
                action="新增手動違規記錄",
                details=f"車牌: {license_plate}, 類型: {violation_type}, 地點: {violation_address}, 罰金: NT${fine_amount}, 車主: {owner_name or '未找到'}, 標註數量: {len(annotations)}",
                user_identity=get_jwt_identity(),
                client_ip=request.remote_addr
            )
        except Exception as log_error:
            print(f"⚠️ 警告：記錄手動標註日誌時發生錯誤: {log_error}")
        
        return jsonify({
            'message': '手動違規記錄已成功保存',
            'violation_id': violation_id,
            'license_plate': license_plate,
            'violation_type': violation_type,
            'fine_amount': fine_amount,
            'confidence': '手動標注',
            'owner_info': {
                'name': owner_name,
                'phone': owner_phone,
                'email': owner_email,
                'address': owner_address
            } if owner_name else None
        }), 201

    except Exception as e:
        if 'conn' in locals() and conn:
            conn.rollback()
        print(f"❌ Error in create_manual_violation: {e}")
        traceback.print_exc()
        return jsonify({'error': '保存失敗，請稍後再試'}), 500

# ==================================================
# WebSocket 廣播
# ==================================================
@app.route('/api/notify/new-violation', methods=['POST'])
def notify_new_violation():
    new_violation_data = request.json
    if not isinstance(new_violation_data, dict):
        return jsonify({"error": "Invalid data format. JSON object required."}), 400
    try:
        socketio.emit('new_violation', new_violation_data)
        print(f"🚀 Broadcasted new violation: {new_violation_data}")
        return jsonify({"message": "Notification broadcasted successfully."}), 200
    except Exception as e:
        print(f"❌ Error broadcasting: {e}")
        return jsonify({'error': 'Broadcast failed'}), 500

@socketio.on('connect')
def handle_connect():
    print('✅ Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    print('❌ Client disconnected')

# ==================================================
# 罰單相關 API
# ==================================================
@app.route('/api/violations/confirmed-count', methods=['GET'])
def get_confirmed_violations_count():
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM violations WHERE status = '已確認';")
            count = cur.fetchone()[0]
        conn.close()
        return jsonify({'count': count})
    except Exception as e:
        print(f"❌ Error in get_confirmed_violations_count: {e}")
        return jsonify({'error': ERROR_INTERNAL_SERVER}), 500

@app.route('/api/owners/<plate_number>', methods=['GET'])
def get_owner_info(plate_number):
    try:
        if not plate_number: return jsonify({'error': '車牌號碼不能為空'}), 400
        conn = get_db_connection()
        with conn.cursor() as cur:
            try:
                cur.execute("SELECT license_plate_number, full_name, id_number, email, phone_number, address, vehicle_type, gender, date_of_birth FROM owners WHERE license_plate_number = %s;", (plate_number,))
                owner_data = cur.fetchone()
                has_extended_fields = True
            except Exception as e:
                print(f"⚠️ Extended fields not available, using basic fields: {e}")
                cur.execute("SELECT license_plate_number, full_name, id_number, email, phone_number, address, vehicle_type FROM owners WHERE license_plate_number = %s;", (plate_number,))
                owner_data = cur.fetchone()
                has_extended_fields = False
        conn.close()
        if not owner_data: return jsonify({'error': '找不到該車牌號碼的車主資料'}), 404
        owner_info = {'license_plate_number': owner_data[0], 'full_name': owner_data[1], 'id_number': owner_data[2], 'email': owner_data[3], 'phone_number': owner_data[4], 'address': owner_data[5], 'vehicle_type': owner_data[6], 'gender': owner_data[7] if has_extended_fields and len(owner_data) > 7 else '', 'date_of_birth': owner_data[8] if has_extended_fields and len(owner_data) > 8 else ''}
        return jsonify(owner_info), 200
    except Exception as e:
        print(f"❌ Error in get_owner_info: {e}")
        return jsonify({'error': ERROR_INTERNAL_SERVER, 'details': str(e)}), 500

@app.route('/api/owners/<plate_number>/vehicle-type', methods=['GET'])
def get_vehicle_type(plate_number):
    try:
        if not plate_number: return jsonify({'error': '車牌號碼不能為空'}), 400
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT license_plate_number, vehicle_type FROM owners WHERE license_plate_number = %s;", (plate_number,))
            owner_data = cur.fetchone()
        conn.close()
        if not owner_data: return jsonify({'error': '找不到該車牌號碼的車輛類型'}), 404
        vehicle_info = {'license_plate_number': owner_data[0], 'vehicle_type': owner_data[1]}
        return jsonify(vehicle_info), 200
    except Exception as e:
        print(f"❌ Error in get_vehicle_type: {e}")
        return jsonify({'error': ERROR_INTERNAL_SERVER, 'details': str(e)}), 500

@app.route('/api/tickets/list', methods=['GET'])
def get_tickets_list():
    status = request.args.get('status')
    if not status or status not in ['已確認', '已開罰']: return jsonify({'error': "必須提供 '已確認' 或 '已開罰' 的 status 參數"}), 400
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT id, violation_type, license_plate, timestamp, violation_address FROM violations WHERE status = %s ORDER BY timestamp DESC;", (status,))
            violations_raw = cur.fetchall()
        conn.close()
        violations = [{'id': row[0], 'type': row[1], 'plateNumber': row[2], 'timestamp': row[3].isoformat() if row[3] else None, 'location': row[4]} for row in violations_raw]
        return jsonify(violations)
    except Exception as e:
        print(f"❌ Error in get_tickets_list: {e}")
        return jsonify({'error': ERROR_INTERNAL_SERVER}), 500

@app.route('/api/tickets/counts', methods=['GET'])
def get_tickets_counts():
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(CASE WHEN status = '已確認' THEN 1 END), COUNT(CASE WHEN status = '已開罰' THEN 1 END), COALESCE(SUM(CASE WHEN status = '已開罰' THEN fine END), 0) FROM violations;")
            counts = cur.fetchone()
        conn.close()
        result = {'pendingCount': int(counts[0]) if counts else 0, 'generatedCount': int(counts[1]) if counts else 0, 'totalFine': int(counts[2]) if counts else 0}
        return jsonify(result)
    except Exception as e:
        print(f"❌ Error in get_tickets_counts: {e}")
        return jsonify({'error': ERROR_INTERNAL_SERVER}), 500

@app.route('/api/violation/<int:violation_id>/generate-ticket', methods=['POST'])
def generate_ticket(violation_id):
    try:
        data = request.get_json()
        owner_info = data.get('ownerInfo', {})
        recipient_email = data.get('recipient_email')
        print(f"🔍 DEBUG generate_ticket: recipient_email = {recipient_email}")
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT id, violation_type, license_plate, timestamp, violation_address, status FROM violations WHERE id = %s;", (violation_id,))
            violation_data = cur.fetchone()
            if not violation_data: return jsonify({'error': '找不到指定的違規紀錄'}), 404
            if violation_data[5] != '已確認': return jsonify({'error': '違規狀態不符，無法生成罰單'}), 400
            cur.execute("UPDATE violations SET status = '已開罰' WHERE id = %s;", (violation_id,))
            violation_info = {'id': violation_data[0], 'type': violation_data[1], 'plateNumber': violation_data[2], 'timestamp': violation_data[3], 'location': violation_data[4]}
        conn.commit()
        conn.close()
        email_sent = False
        email_address = recipient_email or (owner_info.get('email') if owner_info else None)
        if email_address:
            email_sent = send_violation_ticket_email(recipient_email=email_address, owner_name=owner_info.get('full_name', '') if owner_info else '', violation_data=violation_info)
        response_message = f'罰單 (ID: {violation_id}) 已成功生成。'
        if email_sent: response_message += f' 電子罰單已發送至 {email_address}'
        elif email_address: response_message += ' 但電子郵件發送失敗。'
        else: response_message += ' 未提供收件人電子郵件，僅更新狀態。'
        return jsonify({'message': response_message, 'email_sent': email_sent, 'violation_id': violation_id}), 200
    except Exception as e:
        print(f"❌ Error in generate_ticket: {e}")
        return jsonify({'error': ERROR_INTERNAL_SERVER, 'details': str(e)}), 500

# ==================================================
# 統計分析 API
# ==================================================
@app.route('/api/analytics', methods=['GET'])
def get_analytics_data():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        time_range = request.args.get('time_range', 'last30days')
        time_filter_sql = ""
        if time_range == 'today': time_filter_sql = "AND timestamp >= CURRENT_DATE"
        elif time_range == 'last7days': time_filter_sql = "AND timestamp >= NOW() - INTERVAL '7 days'"
        else: time_filter_sql = "AND timestamp >= NOW() - INTERVAL '30 days'"
        cur.execute(f"SELECT COUNT(*), COUNT(CASE WHEN status = '已開罰' THEN 1 END), COALESCE(SUM(CASE WHEN status = '已開罰' THEN fine END), 0) FROM violations WHERE 1=1 {time_filter_sql};")
        kpi = cur.fetchone()
        kpi_data = {'totalViolations': kpi[0], 'confirmationRate': 0.0, 'ticketsIssued': kpi[1], 'totalFines': int(kpi[2])}
        cur.execute(f"SELECT date_trunc('day', timestamp)::date, COUNT(id) FROM violations WHERE 1=1 {time_filter_sql} GROUP BY 1 ORDER BY 1;")
        trend = cur.fetchall()
        trend_data = {'labels': [t[0].strftime('%m-%d') for t in trend], 'data': [t[1] for t in trend]}
        cur.execute(f"SELECT violation_type, COUNT(id) FROM violations WHERE 1=1 {time_filter_sql} GROUP BY 1 ORDER BY 2 DESC;")
        type_dist = cur.fetchall()
        type_distribution_data = {'labels': [t[0] for t in type_dist], 'data': [t[1] for t in type_dist]}
        cur.execute(f"SELECT violation_address, COUNT(id) FROM violations WHERE 1=1 {time_filter_sql} GROUP BY 1 ORDER BY 2 DESC LIMIT 5;")
        locations = cur.fetchall()
        location_data = {'labels': [l[0] for l in locations], 'data': [l[1] for l in locations]}
        efficiency_data = {'labels': ['待審核', '已確認', '已駁回', '已開罰'], 'data': [0, 1.3, 0.85, 2.6]}
        cur.execute("SELECT to_char(date_trunc('month', timestamp), 'YYYY-MM'), SUM(fine) FROM violations WHERE status = '已開罰' AND timestamp >= NOW() - INTERVAL '6 months' GROUP BY 1 ORDER BY 1;")
        revenue = cur.fetchall()
        revenue_data = {'labels': [r[0] for r in revenue], 'data': [int(r[1]) if r[1] is not None else 0 for r in revenue]}
        response_data = {'kpi': kpi_data, 'trend': trend_data, 'typeDistribution': type_distribution_data, 'locationAnalysis': location_data, 'efficiencyAnalysis': efficiency_data, 'revenue': revenue_data}
        cur.close()
        conn.close()
        return jsonify(response_data)
    except Exception as e:
        print(f"❌ Error in get_analytics_data: {e}")
        if 'cur' in locals() and cur and not cur.closed: cur.close()
        if 'conn' in locals() and conn and not conn.closed: conn.close()
        return jsonify({'error': ERROR_INTERNAL_SERVER, 'details': str(e)}), 500

# ==================================================
# 使用者管理 API
# ==================================================
@app.route('/api/register', methods=['POST'])
@admin_required()
def register():
    data = request.get_json()
    username, email, password, name, role = data.get('username'), data.get('email'), data.get('password'), data.get('name'), data.get('role', 'operator')
    if not all([username, email, password, name]): return jsonify({"error": "所有欄位 (username, email, password, name) 都是必填的"}), 400
    if role not in ['admin', 'operator']: return jsonify({"error": "無效的角色，只能是 'admin' 或 'operator'"}), 400
    hashed_password = generate_password_hash(password)
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE username = %s OR email = %s", (username, email))
        if cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({"error": "使用者名稱或電子郵件已存在"}), 409
        sql = "INSERT INTO users (username, email, password, name, role) VALUES (%s, %s, %s, %s, %s) RETURNING id;"
        cur.execute(sql, (username, email, hashed_password, name, role))
        new_user_id = cur.fetchone()[0]
        conn.commit()
        # --- 【核心修改】在这里呼叫 log_action() ---
        try:
            # 从 JWT Token 中获取执行此操作的管理员身分
            admin_identity = get_jwt_identity()
            
            log_action(
                module="使用者管理",
                level="INFO",
                action="建立新使用者",
                details=f"成功建立了新使用者 '{username}' (角色: {role}, ID: {new_user_id})",
                user_identity=admin_identity,
                client_ip=request.remote_addr # 获取请求的来源 IP
            )
        except Exception as log_error:
            # 如果出现错误,记录警告日志
            print(f"⚠️ 警告：紀錄 '建立新使用者' 日誌時發生錯誤: {log_error}")
        # ---------------------------------------------
        cur.close()
        conn.close()
        return jsonify({"message": f"使用者 '{username}' 註冊成功", "userId": new_user_id}), 201
    except psycopg2.Error as e:
        print(f"❌ 資料庫錯誤 in register: {e}")
        return jsonify({"error": "資料庫操作失敗"}), 500
    except Exception as e:
        print(f"❌ 未知錯誤 in register: {e}")
        return jsonify({"error": ERROR_INTERNAL_SERVER_ZH}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username, password = data.get('username'), data.get('password')
    if not username or not password: 
        return jsonify({"error": "請提供使用者名稱和密碼"}), 400

    conn = None  # 將 conn 宣告在 try 區塊外，以便 finally 可以存取
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        sql = "SELECT id, username, password, role, name, status FROM users WHERE username = %s OR email = %s"
        cur.execute(sql, (username, username))
        user = cur.fetchone()

        if user:
            db_id, db_username, db_password_hash, db_role, db_name, db_status = user
            
            if db_status != '啟用': 
                return jsonify({"error": "此帳號已被停用"}), 403
            
            if check_password_hash(db_password_hash, password):
                # --- 【核心修改開始】---
                try:
                    # 1. 【修正】移除 "lastLogin" 的雙引號，使其符合資料庫中的 'lastlogin'
                    # 2. 【優化】直接使用當前的連線 (cur) 進行更新，不要建立新連線
                    update_sql = 'UPDATE users SET lastlogin = %s WHERE id = %s'
                    cur.execute(update_sql, (datetime.now(timezone.utc), db_id))
                    
                    # 3. 【優化】提交事務以儲存變更
                    conn.commit()
                except Exception as e:
                    # 如果更新失敗，回滾事務以保持資料一致性
                    conn.rollback() 
                    print(f"❌ 更新 lastlogin 失敗: {e}")
                # --- 【核心修改結束】---

                identity = db_username
                additional_claims = {"role": db_role, "name": db_name}
                access_token = create_access_token(identity=identity, additional_claims=additional_claims)
                
                return jsonify(access_token=access_token)

        # 如果 user 不存在或密碼錯誤，回傳統一的錯誤訊息
        return jsonify({"error": "使用者名稱或密碼錯誤"}), 401

    except Exception as e:
        print(f"❌ 登入過程中發生嚴重錯誤: {e}")
        return jsonify({"error": ERROR_INTERNAL_SERVER_ZH}), 500
    finally:
        # 【優化】確保無論成功或失敗，資料庫連線最後都會被關閉
        if 'cur' in locals() and cur:
            cur.close()
        if conn:
            conn.close()

@app.route('/api/profile', methods=['GET'])
@jwt_required()
def get_profile():
    current_user = get_jwt_identity()
    return jsonify(logged_in_as=current_user)

@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get('email')
    if not email: return jsonify({"error": "必須提供電子郵件地址"}), 400
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        user = cur.fetchone()
        if user:
            token = secrets.token_urlsafe(32)
            expires = datetime.now(timezone.utc) + timedelta(hours=1)
            cur.execute("UPDATE users SET reset_token = %s, reset_token_expires = %s WHERE email = %s", (token, expires, email))
            conn.commit()
            reset_url = f"http://localhost:8080/reset-password?token={token}"
            msg = Message(subject="[Traffic AI] 密碼重設請求", recipients=[email])
            msg.body = f"您好，\n\n您已請求重設您的 Traffic AI 系統密碼。\n請點擊以下連結來設定您的新密碼：\n{reset_url}\n\n如果您沒有請求此操作，請忽略此郵件。\n此連結將在 1 小時後失效。\n\n謝謝！\nTraffic AI 系統團隊"
            mail.send(msg)
        cur.close()
        conn.close()
        return jsonify({"message": "如果該電子郵件已註冊，一封密碼重設郵件已被發送。"}), 200
    except Exception as e:
        print(f"❌❌❌ CRITICAL ERROR in forgot_password: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": ERROR_INTERNAL_SERVER_ZH}), 500

@app.route('/api/verify-reset-token', methods=['POST'])
def verify_reset_token():
    data = request.get_json()
    token = data.get('token')
    if not token: return jsonify({"error": "缺少 token"}), 400
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE reset_token = %s AND reset_token_expires > %s", (token, datetime.now(timezone.utc)))
        user = cur.fetchone()
        cur.close()
        conn.close()
        if user: return jsonify({"message": "Token 有效"}), 200
        else: return jsonify({"error": "無效或已過期的 token"}), 400
    except Exception as e:
        print(f"❌ Error in verify_reset_token: {e}")
        return jsonify({"error": ERROR_INTERNAL_SERVER_ZH}), 500

@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    token, new_password = data.get('token'), data.get('password')
    if not token or not new_password: return jsonify({"error": "缺少 token 或新密碼"}), 400
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE reset_token = %s AND reset_token_expires > %s", (token, datetime.now(timezone.utc)))
        user = cur.fetchone()
        if not user:
            cur.close()
            conn.close()
            return jsonify({"error": "無效或已過期的 token"}), 400
        hashed_password = generate_password_hash(new_password)
        cur.execute("UPDATE users SET password = %s, reset_token = NULL, reset_token_expires = NULL WHERE id = %s", (hashed_password, user[0]))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"message": "密碼已成功重設"}), 200
    except Exception as e:
        print(f"❌ Error in reset_password: {e}")
        return jsonify({"error": ERROR_INTERNAL_SERVER_ZH}), 500

@app.route('/api/violations/<int:violation_id>/image', methods=['GET'])
def get_violation_image(violation_id):
    try:
        if not violation_id: return jsonify({'error': '違規紀錄 ID 不能為空'}), 400
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT image_data, image_path, license_plate FROM violations WHERE id = %s;", (violation_id,))
            violation_data = cur.fetchone()
        conn.close()
        if not violation_data: return jsonify({'error': '找不到該違規紀錄'}), 404
        image_data, image_path, license_plate = violation_data
        if image_data: return jsonify({'success': True, 'image_data': image_data, 'license_plate': license_plate, 'image_source': 'database'}), 200
        if image_path and os.path.exists(image_path):
            try:
                with open(image_path, 'rb') as image_file:
                    image_binary = image_file.read()
                    image_data_b64 = base64.b64encode(image_binary).decode('utf-8')
                    return jsonify({'success': True, 'image_data': image_data_b64, 'license_plate': license_plate, 'image_source': 'file'}), 200
            except Exception as e:
                print(f"❌ 讀取圖片檔案失敗: {e}")
                return jsonify({'error': '無法讀取圖片檔案'}), 500
        return jsonify({'error': '找不到對應的圖片數據'}), 404
    except Exception as e:
        print(f"❌ Error in get_violation_image: {e}")
        return jsonify({'error': ERROR_INTERNAL_SERVER, 'details': str(e)}), 500

@app.route('/api/users', methods=['GET'])
@admin_required()
def get_users_list():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, username, email, name, role, status, lastLogin FROM users ORDER BY createdAt DESC")
        users_raw = cur.fetchall()
        cur.close()
        conn.close()
        users = [{"id": row[0], "username": row[1], "email": row[2], "name": row[3], "role": row[4], "status": row[5], "lastLogin": row[6].isoformat() if row[6] else None} for row in users_raw]
        return jsonify(users)
    except Exception as e:
        print(f"❌ Error in get_users_list: {e}")
        return jsonify({'error': ERROR_INTERNAL_SERVER}), 500

@app.route('/api/profile/change-password', methods=['PUT'])
@jwt_required()
def change_password():
    current_username = get_jwt_identity()
    data = request.get_json()
    old_password, new_password = data.get('old_password'), data.get('new_password')
    if not old_password or not new_password: return jsonify({"error": "必須提供舊密碼和新密碼"}), 400
    if len(new_password) < 8: return jsonify({"error": "新密碼長度至少需要 8 個字元"}), 400
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT password FROM users WHERE username = %s", (current_username,))
        user = cur.fetchone()
        if not user: return jsonify({"error": "找不到使用者"}), 404
        current_password_hash = user[0]
        if not check_password_hash(current_password_hash, old_password): return jsonify({"error": "舊密碼不正確"}), 401
        new_password_hash = generate_password_hash(new_password)
        cur.execute("UPDATE users SET password = %s WHERE username = %s", (new_password_hash, current_username))
        conn.commit()
        # --- 【新增日誌記錄】---
        try:
            log_action(
                module="個人資料",
                level="WARNING", # 修改密碼是較敏感的操作，使用 WARNING 等級
                action="修改密碼",
                details=f"使用者 '{current_username}' 成功修改了自己的密碼",
                user_identity=current_username,
                client_ip=request.remote_addr
            )
        except Exception as log_error:
            print(f"⚠️ 警告：記錄 '修改密碼' 日誌時發生錯誤: {log_error}")
        # -----------------------
        return jsonify({"message": "密碼已成功更新"}), 200
    except Exception as e:
        if conn: conn.rollback()
        print(f"❌ 修改密碼時發生錯誤: {e}")
        return jsonify({"error": ERROR_INTERNAL_SERVER_ZH}), 500
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()


# ==================================================
# 通知相關 API
# ==================================================
@app.route('/api/notifications/list', methods=['GET'])
@jwt_required()
def get_notifications():
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # 從 JWT 中獲取用戶名，然後獲取用戶 ID
            username = get_jwt_identity()
            cur.execute(SQL_SELECT_USER_ID_BY_USERNAME, (username,))
            user_result = cur.fetchone()
            if not user_result:
                return jsonify({'error': ERROR_INTERNAL_SERVER_USER}), 404
            
            user_id = str(user_result[0])  # 轉換為字符串，因為 notifications 表中的 userId 是 text 類型
            
            # 獲取該用戶的通知
            cur.execute("""
                SELECT id, title, message, type, priority, "isRead", "createdAt"
                FROM notifications
                WHERE "userId" = %s
                ORDER BY "createdAt" DESC
                LIMIT 50;
            """, (user_id,))
            notifications_raw = cur.fetchall()
        conn.close()

        notifications = [{
            'id': row[0],
            'title': row[1],
            'message': row[2],
            'type': row[3],
            'priority': row[4],
            'read': row[5],
            'createdAt': row[6].isoformat() if row[6] else None
        } for row in notifications_raw]

        return jsonify(notifications)
    except Exception as e:
        print(f"❌ Error in get_notifications: {e}")
        return jsonify({'error': ERROR_INTERNAL_SERVER}), 500

@app.route('/api/notifications/unread-count', methods=['GET'])
@jwt_required()
def get_unread_notifications_count():
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # 從 JWT 中獲取用戶名，然後獲取用戶 ID
            username = get_jwt_identity()
            cur.execute(SQL_SELECT_USER_ID_BY_USERNAME, (username,))
            user_result = cur.fetchone()
            if not user_result:
                return jsonify({'error': ERROR_INTERNAL_SERVER_USER}), 404
            
            user_id = str(user_result[0])  # 轉換為字符串
            
            # 獲取未讀通知數量
            cur.execute("""
                SELECT COUNT(*)
                FROM notifications
                WHERE "userId" = %s AND "isRead" = false;
            """, (user_id,))
            count = cur.fetchone()[0]
        conn.close()
        return jsonify({'count': count})
    except Exception as e:
        print(f"❌ Error in get_unread_notifications_count: {e}")
        return jsonify({'error': ERROR_INTERNAL_SERVER}), 500

@app.route('/api/notifications/mark-read', methods=['POST'])
@jwt_required()
def mark_notifications_as_read():
    try:
        data = request.get_json()
        notification_ids = data.get('ids', [])
        
        if not notification_ids:
            return jsonify({'error': '需要提供通知 ID'}), 400

        conn = get_db_connection()
        with conn.cursor() as cur:
            # 從 JWT 中獲取用戶名，然後獲取用戶 ID
            username = get_jwt_identity()
            cur.execute(SQL_SELECT_USER_ID_BY_USERNAME, (username,))
            user_result = cur.fetchone()
            if not user_result:
                return jsonify({'error': ERROR_INTERNAL_SERVER_USER}), 404
            
            user_id = str(user_result[0])  # 轉換為字符串
            
            # 更新通知狀態
            cur.execute("""
                UPDATE notifications
                SET "isRead" = true, "updatedAt" = CURRENT_TIMESTAMP
                WHERE id = ANY(%s) AND "userId" = %s;
            """, (notification_ids, user_id))
        conn.commit()
        conn.close()

        return jsonify({'message': '通知已標記為已讀'}), 200
    except Exception as e:
        print(f"❌ Error in mark_notifications_as_read: {e}")
        return jsonify({'error': ERROR_INTERNAL_SERVER}), 500

# ==================================================
# 【新增】系統效能監控 API
# ==================================================
@app.route('/api/system/performance', methods=['GET'])
@admin_required()
def get_system_performance():
    """
    獲取 web_api 容器自身的系統資源使用狀況。
    """
    try:
        # 獲取 CPU 使用率 (%), interval=1 表示比較 1 秒內的變化
        cpu_percent = psutil.cpu_percent(interval=1)
        
        # 獲取記憶體資訊
        memory_info = psutil.virtual_memory()
        memory_percent = memory_info.percent
        
        # 獲取磁碟資訊 (根目錄 '/')
        disk_info = psutil.disk_usage('/')
        disk_percent = disk_info.percent
        
        # 獲取網路 I/O
        net_io = psutil.net_io_counters()
        # 這裡只回傳總量，即時速率計算較複雜，可在前端實現
        net_sent_gb = round(net_io.bytes_sent / (1024**3), 2)
        net_recv_gb = round(net_io.bytes_recv / (1024**3), 2)

        performance_data = {
            "cpu": { "percent": cpu_percent },
            "memory": { "percent": memory_percent, "total_gb": round(memory_info.total / (1024**3), 2) },
            "disk": { "percent": disk_percent, "total_gb": round(disk_info.total / (1024**3), 2) },
            "network": { "sent_gb": net_sent_gb, "recv_gb": net_recv_gb }
        }
        return jsonify(performance_data)

    except Exception as e:
        print(f"❌ 獲取系統效能時發生錯誤: {e}")
        return jsonify({'error': '無法獲取系統效能數據'}), 500
    
# web_api/app.py -> 4. API 路由定義 (API Endpoints)

# ==================================================
# 【新增】系統日誌查詢 API
# ==================================================
@app.route('/api/logs', methods=['GET'])
@admin_required() # 只有管理員可以查詢系統日誌
def get_system_logs():
    """
    獲取系統日誌，並支援多種條件篩選與分頁。
    """
    try:
        # --- 1. 獲取篩選參數 ---
        search_term = request.args.get('search')
        level = request.args.get('level')
        module = request.args.get('module')
        username = request.args.get('user')
        start_date = request.args.get('start_date') # 預期格式: YYYY-MM-DD
        end_date = request.args.get('end_date')     # 預期格式: YYYY-MM-DD
        
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20)) # 日誌頁面預設顯示 20 筆
        offset = (page - 1) * limit

        # --- 2. 動態建立 SQL 查詢 ---
        base_query = "FROM system_logs WHERE 1=1"
        params = []

        if search_term:
            base_query += " AND (CAST(id AS TEXT) ILIKE %s OR username ILIKE %s OR action ILIKE %s OR details ILIKE %s)"
            params.extend([f"%{search_term}%"] * 4)
        if level:
            base_query += " AND level = %s"
            params.append(level)
        if module:
            base_query += " AND module = %s"
            params.append(module)
        if username:
            base_query += " AND username = %s"
            params.append(username)
        if start_date:
            base_query += " AND timestamp >= %s"
            params.append(start_date)
        if end_date:
            # 為了包含結束當天，我們需要將日期加一天
            end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date() + timedelta(days=1)
            base_query += " AND timestamp < %s"
            params.append(end_date_obj.strftime('%Y-%m-%d'))
            
        count_query = f"SELECT COUNT(*) {base_query}"
        data_query = f"SELECT id, timestamp, username, module, level, action, details {base_query} ORDER BY timestamp DESC LIMIT %s OFFSET %s"

        # --- 3. 執行查詢 ---
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute(count_query, tuple(params))
        total_count = cur.fetchone()[0]

        cur.execute(data_query, tuple(params + [limit, offset]))
        logs_raw = cur.fetchall()
        
        cur.close()
        conn.close()

        # --- 4. 格式化回傳資料 ---
        logs = [
            {
                "id": row[0],
                "timestamp": row[1].isoformat(),
                "username": row[2],
                "module": row[3],
                "level": row[4],
                "action": row[5],
                "details": row[6],
            }
            for row in logs_raw
        ]
        
        total_pages = (total_count + limit - 1) // limit
        
        return jsonify({
            'data': logs,
            'pagination': {
                'current_page': page,
                'total_pages': total_pages,
                'total_records': total_count,
            }
        })

    except Exception as e:
        print(f"❌ 獲取系統日誌時發生錯誤: {e}")
        traceback.print_exc()
        return jsonify({'error': ERROR_INTERNAL_SERVER_ZH}), 500


# ==================================================
# 主程式啟動
# ==================================================
if __name__ == "__main__":
    socketio.run(app, host='0.0.0.0', port=3002, debug=True, allow_unsafe_werkzeug=True)