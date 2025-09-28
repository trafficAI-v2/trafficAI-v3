import os
import psycopg2
import secrets
import base64
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


# --- 應用程式設定 ---
load_dotenv()
app = Flask(__name__)

# 允許的前端來源，.env 裡可設定 CORS_ALLOWED_ORIGINS=http://localhost:8080
allowed_origins = os.getenv('CORS_ALLOWED_ORIGINS', '*')
CORS(app)
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

# Email發送函數
import smtplib
import base64
import os
import psycopg2
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage

# 假設您在程式的其他地方已經定義了 Flask app 和 mail 實例
# from flask import Flask
# from flask_mail import Mail, Message
# app = Flask(__name__)
# # ... app.config 的設定 ...
# mail = Mail(app)

# --- 資料庫連線 (根據您的原碼) ---
def get_db_connection():
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise ValueError("DATABASE_URL not set in .env file")
    conn = psycopg2.connect(db_url)
    return conn

# Email發送函數
def send_violation_ticket_email(recipient_email, owner_name, violation_data, sms_content):
    """
    發送交通違規罰單電子郵件（包含內嵌的違規照片）
    """
    def format_timestamp_for_email(timestamp_input):
        """
        格式化時間戳，與 ViolationLog.tsx 保持一致
        輸入: ISO 格式時間戳字串或 datetime 對象
        輸出: "2024/01/15 下午 2:30:45" 格式
        """
        if not timestamp_input:
            return 'N/A'
        
        # 如果輸入是 datetime 對象，先轉換為字符串
        if hasattr(timestamp_input, 'isoformat'):
            timestamp_str = timestamp_input.isoformat()
        else:
            timestamp_str = str(timestamp_input)
        
        try:
            # 處理不同格式的時間戳
            if 'T' in timestamp_str:
                # 標準 ISO 格式: "2024-01-15T14:30:45.123Z"
                date_part_str, time_part_str_with_zone = timestamp_str.split('T')
            else:
                # 資料庫格式: "2024-01-15 14:30:45.123173+00:00"
                date_part_str, time_part_str_with_zone = timestamp_str.split(' ', 1)
            
            # 格式化日期部分 (YYYY-MM-DD → YYYY/MM/DD)
            date_part = date_part_str.replace('-', '/')
            
            if not time_part_str_with_zone:
                return date_part
            
            # 處理時間部分，移除毫秒和時區信息
            if '+' in time_part_str_with_zone:
                time_part_clean = time_part_str_with_zone.split('+')[0]
            elif time_part_str_with_zone.endswith('Z'):
                time_part_clean = time_part_str_with_zone.rstrip('Z')
            else:
                time_part_clean = time_part_str_with_zone
            
            main_time_part = time_part_clean.split('.')[0]
            hours, minutes, seconds = map(int, main_time_part.split(':'))
            
            ampm = '下午' if hours >= 12 else '上午'
            display_hours = hours % 12 or 12
            time_part = f"{ampm} {display_hours}:{minutes:02d}:{seconds:02d}"
            
            return f"{date_part} {time_part}"
        
        except Exception as e:
            print(f"❌ 時間格式化失敗: {timestamp_input}, 錯誤: {e}")
            return str(timestamp_input)

    try:
        # 從資料庫獲取違規圖片和車主資料
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 格式化當前時間，使用與前端一致的格式
        def format_current_time():
            """
            格式化當前時間為與前端一致的 12 小時制格式，使用台灣時區
            輸出: "2025/09/29 上午 12:02:30" 格式
            """
            from datetime import timezone, timedelta
            
            # 設定台灣時區 (UTC+8)
            taiwan_tz = timezone(timedelta(hours=8))
            now = datetime.now(taiwan_tz)
            
            date_part = now.strftime('%Y/%m/%d')
            hours = now.hour
            minutes = now.minute
            seconds = now.second
            
            ampm = '下午' if hours >= 12 else '上午'
            display_hours = hours % 12 or 12
            time_part = f"{ampm} {display_hours}:{minutes:02d}:{seconds:02d}"
            
            return f"{date_part} {time_part}"
        
        formatted_current_time = format_current_time()
        
        image_query = "SELECT image_data FROM violations WHERE id = %s"
        cur.execute(image_query, (violation_data['id'],))
        image_result = cur.fetchone()
        image_data_base64 = image_result[0] if image_result and image_result[0] else None
        
        print(f"🔍 DEBUG: Fetching image for violation ID {violation_data['id']}. Found: {'Yes' if image_data_base64 else 'No'}")
        
        owner_query = """
            SELECT full_name, id_number, gender, date_of_birth, phone_number, email, address, vehicle_type
            FROM owners 
            WHERE license_plate_number = %s
        """
        cur.execute(owner_query, (violation_data['plateNumber'],))
        owner_info = cur.fetchone()
        cur.close()
        conn.close()
        
        if owner_info:
            _, id_number, gender, birth_date, phone, owner_email, address, vehicle_type = owner_info
            formatted_birth_date = birth_date.strftime('%Y/%m/%d') if birth_date else 'N/A'
        else:
            print(f"❌ DEBUG: No owner info found for {violation_data['plateNumber']}")
            id_number, gender, formatted_birth_date, phone, owner_email, address, vehicle_type = ('N/A',) * 7
        
        subject = f"交通違規電子罰單通知 - 車牌: {violation_data['plateNumber']}"
        formatted_violation_time = format_timestamp_for_email(violation_data['timestamp'])
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{
                    font-family: 'Microsoft JhengHei', 'SimHei', Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    line-height: 1.6;
                    background-color: #f5f5f5;
                }}
                .container {{
                    max-width: 800px;
                    margin: 0 auto;
                    background: white;
                    border: 2px solid #ddd;
                    border-radius: 8px;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }}
                .header {{
                    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
                    color: white;
                    text-align: center;
                    padding: 30px 20px;
                    border-radius: 6px 6px 0 0;
                }}
                .header h1 {{
                    font-size: 28px;
                    font-weight: bold;
                    margin: 0 0 10px 0;
                    letter-spacing: 1px;
                }}
                .header p {{
                    margin: 5px 0;
                    font-size: 16px;
                }}
                .content {{
                    padding: 30px;
                }}
                .section {{
                    margin: 20px 0;
                    padding: 25px;
                    background-color: #f8f9fa;
                    border: 1px solid #e9ecef;
                    border-radius: 8px;
                }}
                .section-title {{
                    font-size: 18px;
                    font-weight: bold;
                    color: #333;
                    margin-bottom: 20px;
                    border-bottom: 2px solid #2563eb;
                    padding-bottom: 10px;
                }}
                .two-column {{
                    display: flex;
                    gap: 40px;
                    justify-content: space-between;
                    flex-wrap: wrap;
                }}
                .column {{
                    flex: 1;
                    min-width: 280px;
                    padding: 0 10px;
                }}
                .field {{
                    margin: 8px 0;
                    display: flex;
                    align-items: flex-start;
                    min-height: 24px;
                }}
                .label {{
                    font-weight: bold;
                    color: #495057;
                    min-width: 80px;
                    flex-shrink: 0;
                    margin-right: 8px;
                    text-align: left;
                }}
                .value {{
                    color: #212529;
                    flex: 1;
                    word-wrap: break-word;
                    line-height: 1.4;
                }}
                .violation-details {{
                    background-color: #fff3cd;
                    border: 1px solid #ffeaa7;
                    padding: 25px;
                    border-radius: 8px;
                    margin: 20px 0;
                }}
                .violation-image {{
                    max-width: 100%;
                    height: auto;
                    border: 2px solid #ddd;
                    border-radius: 8px;
                    margin-top: 10px;
                    display: block;
                }}
                .notice-section {{
                    background-color: #f8d7da;
                    border: 1px solid #f5c6cb;
                    color: #721c24;
                    padding: 25px;
                    border-radius: 5px;
                    margin: 25px 0;
                }}
                .notice-title {{
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 15px;
                    color: #721c24;
                }}
                .footer {{
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #dee2e6;
                    font-size: 14px;
                    color: #6c757d;
                }}
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
                                <div class="field"><span class="label">身分證字號:</span><span class="value">{id_number}</span></div>
                                <div class="field"><span class="label">性別:</span><span class="value">{gender}</span></div>
                                <div class="field"><span class="label">出生年月日:</span><span class="value">{formatted_birth_date}</span></div>
                            </div>
                            <div class="column">
                                <div class="field"><span class="label">聯絡電話:</span><span class="value">{phone}</span></div>
                                <div class="field"><span class="label">電子郵件:</span><span class="value">{owner_email}</span></div>
                                <div class="field"><span class="label">戶籍地址:</span><span class="value">{address}</span></div>
                            </div>
                        </div>
                    </div>
                    <div class="violation-details">
                        <div class="section-title">違規詳細資訊</div>
                        <!-- 【關鍵修改處】: 修改此 div 的 style -->
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 20px;">
                            <!-- 左側資料區 -->
                            <div style="flex-grow: 1; min-width: 320px;">
                                <div class="field"><span class="label">車牌號碼:</span><span class="value">{violation_data['plateNumber']}</span></div>
                                <div class="field"><span class="label">車輛類型:</span><span class="value">{vehicle_type}</span></div>
                                <div class="field"><span class="label">違規類型:</span><span class="value" style="color: #dc3545; font-weight: bold;">{violation_data['type']}</span></div>
                                <div class="field"><span class="label">違規時間:</span><span class="value">{formatted_violation_time}</span></div>
                                <div class="field"><span class="label">違規地點:</span><span class="value">{violation_data['location']}</span></div>
                            </div>
                            <!-- 右側照片區 -->
                            <div style="flex-shrink: 0; width: 300px; text-align: center;">
                                <div class="label" style="width: 100%; margin-bottom: 10px;">違規照片</div>
                                {'<img src="cid:violation_photo" alt="違規照片" class="violation-image">' if image_data_base64 else '<div style="border: 2px dashed #ccc; padding: 20px; background-color: #f8f9fa; border-radius: 8px; margin-top: 10px;"><p style="color: #666; margin: 0; font-size: 14px;">無違規照片</p></div>'}
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
        
        text_body = f"""
        交通違規電子罰單通知

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
        發送時間: {formatted_current_time}
        """
        
        msg = MIMEMultipart('related')
        msg['Subject'] = subject
        msg['From'] = app.config['MAIL_DEFAULT_SENDER']
        msg['To'] = recipient_email
        
        msg_alternative = MIMEMultipart('alternative')
        msg.attach(msg_alternative)
        
        msg_alternative.attach(MIMEText(text_body, 'plain', 'utf-8'))
        msg_alternative.attach(MIMEText(html_body, 'html', 'utf-8'))
        
        if image_data_base64:
            try:
                if image_data_base64.startswith('data:image'):
                    image_data_base64 = image_data_base64.split(',')[1]
                
                image_data = base64.b64decode(image_data_base64)
                
                image = MIMEImage(image_data)
                image.add_header('Content-Disposition', 'inline', filename=f"violation_{violation_data['id']}.jpg")
                image.add_header('Content-ID', '<violation_photo>')
                msg.attach(image)
                
                print(f"✅ DEBUG: 違規照片已作為內嵌圖片添加 (大小: {len(image_data)} bytes)")
                
            except Exception as img_error:
                print(f"❌ 處理違規照片失敗: {img_error}")
        
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
            try:
                mail_msg = Message(subject=subject, recipients=[recipient_email], html=html_body, body=text_body)
                mail.send(mail_msg)
                print(f"✅ 備用郵件發送成功 to {recipient_email} (可能無內嵌圖片)")
                return True
            except Exception as fallback_error:
                print(f"❌ 備用郵件發送也失敗: {fallback_error}")
                return False
        
    except Exception as e:
        import traceback
        print(f"❌ Failed to send email to {recipient_email}: {str(e)}")
        print(f"❌ 完整追蹤: {traceback.format_exc()}")
        return False

# --- 資料庫連線 ---
def get_db_connection():
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise ValueError("DATABASE_URL not set in .env file")
    conn = psycopg2.connect(db_url)
    return conn


# ==================================================
# 【權限控制裝飾器 (修正版)】
# ==================================================
def admin_required():
    def wrapper(fn):
        @wraps(fn)
        @jwt_required()
        def decorator(*args, **kwargs):
            # get_jwt() 會回傳解碼後的整個 token payload (一個字典)
            # 我們的 token payload 包含了 "sub", "iat", "exp", 以及我們自己加的 "role" 和 "name"
            claims = get_jwt()
            
            # 【核心修正】直接從 claims 字典中獲取 'role' 的值
            # 為了安全，使用 .get() 方法，如果 'role' 不存在，預設回傳 None
            user_role = claims.get("role")
            
            # 檢查 role 是否為 'admin'
            if user_role != "admin":
                return jsonify(error="權限不足，僅限管理員操作"), 403
            
            # 如果是 admin，則正常執行原始的 API 函式
            return fn(*args, **kwargs)
        return decorator
    return wrapper


# ==================================================
# 攝影機相關 API
# ==================================================
@app.route('/cameras_status', methods=['GET'])
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
        return jsonify({'error': 'Internal Server Error'}), 500


@app.route('/cameras_list', methods=['GET'])
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
        return jsonify({'error': 'Internal Server Error'}), 500


# ==================================================
# 違規類型 API
# ==================================================
@app.route('/violation-types', methods=['GET'])
def get_violation_types():
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # 從 violations 表中獲取不重複的違規類型，而不是從不存在的 violation_type 表
            cur.execute('SELECT DISTINCT violation_type FROM violations WHERE violation_type IS NOT NULL ORDER BY violation_type;')
            types_raw = cur.fetchall()
        conn.close()

        violation_types = [{'type_name': row[0]} for row in types_raw]
        return jsonify(violation_types)
    except Exception as e:
        print(f"❌ Error in get_violation_types: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500


# ==================================================
# 違規紀錄 API
# ==================================================
@app.route('/get_violations', methods=['GET'])
def get_violations():
    """
    獲取違規紀錄，並根據傳入的查詢參數進行篩選。
    支持的參數:
    - status: 處理狀態 (例如 '待審核', '已確認')
    - search: 車牌號碼 (模糊搜尋)
    - type: 違規類型 (精確匹配)
    - location: 違規地點 (精確匹配)
    - date: 違規日期 (YYYY-MM-DD, 精確匹配)
    - page: 頁碼 (從 1 開始，默認為 1)
    - limit: 每頁記錄數 (默認為 10)
    """
    try:
        # 1. 從請求的 URL 中獲取所有可能的查詢參數
        status = request.args.get('status')
        search = request.args.get('search')
        v_type = request.args.get('type')
        location = request.args.get('location')
        date = request.args.get('date')
        
        # 【新增】分頁參數
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        offset = (page - 1) * limit

        # 2. 建立基礎 SQL 查詢語句和一個空的參數列表
        # 【修改】在 SELECT 查詢中加上車主資訊和 fine 欄位
        base_query = """
            SELECT id, violation_type, license_plate, timestamp, violation_address, status, fine,
                   owner_name, owner_phone, owner_email, owner_address
            FROM violations
            WHERE 1=1
        """
        
        # 建立計數查詢，用於獲取總記錄數
        count_query = """
            SELECT COUNT(*)
            FROM violations
            WHERE 1=1
        """
        
        params = [] # 參數列表，用於安全地傳遞值，防止 SQL Injection

        # 3. 根據傳入的參數，動態地建立 SQL 的 WHERE 條件
        # (這部分的 if 判斷邏輯完全不需要變動)
        if status and status != '全部':
            base_query += " AND status = %s"
            count_query += " AND status = %s"
            params.append(status)
        if search:
            base_query += " AND license_plate ILIKE %s"
            count_query += " AND license_plate ILIKE %s"
            search_term = f"%{search}%"
            params.append(search_term)
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

        # 4. 加入排序和分頁，讓最新的紀錄顯示在最上面
        base_query += " ORDER BY timestamp DESC LIMIT %s OFFSET %s"

        # 5. 連接資料庫並執行查詢
        conn = get_db_connection()
        with conn.cursor() as cur:
            # 先獲取總記錄數
            cur.execute(count_query, tuple(params))
            total_count = cur.fetchone()[0]
            
            # 再獲取分頁數據
            cur.execute(base_query, tuple(params + [limit, offset]))
            violations_raw = cur.fetchall()
        conn.close()

        # 6. 將從資料庫取出的原始資料 (tuple) 格式化為前端需要的 JSON 格式
        # 【修改】將車主資訊和 fine 加入回傳的 JSON 中，並更新所有欄位的索引
        violations = [
            {
                'id': row[0],           # id 現在是第 0 個欄位
                'type': row[1],         # violation_type 現在是第 1 個欄位
                'plateNumber': row[2],  # license_plate 現在是第 2 個欄位
                'vehicleType': '',
                'timestamp': row[3].isoformat() if row[3] else None, # timestamp 是第 3 個
                'location': row[4],     # violation_address 是第 4 個
                'status': row[5],       # status 是第 5 個
                'fine': row[6],         # fine 是第 6 個
                'ownerName': row[7],    # owner_name 是第 7 個
                'ownerPhone': row[8],   # owner_phone 是第 8 個
                'ownerEmail': row[9],   # owner_email 是第 9 個
                'ownerAddress': row[10] # owner_address 是第 10 個
            }
            for row in violations_raw
        ]

        # 7. 回傳包含分頁信息的 JSON 格式結果
        total_pages = (total_count + limit - 1) // limit  # 計算總頁數
        
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
        return jsonify({'error': 'Internal Server Error', 'details': str(e)}), 500
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
        return jsonify({'error': 'Internal Server Error'}), 500


## ==================================================
# 違規狀態更新 API (修正 CORS 預檢問題) //更新違規狀態
@app.route('/violations/status', methods=['PUT', 'OPTIONS'])
def update_violations_status():
    if request.method == 'OPTIONS':
        # 處理預檢請求 (這部分可以保留)
        response = jsonify({'message': 'CORS preflight OK'})
        # 根據您的前端來源進行調整
        response.headers.add("Access-Control-Allow-Origin", "*") # 或 http://localhost:您的前端埠號
        response.headers.add("Access-Control-Allow-Methods", "PUT, OPTIONS")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        return response, 200

    try:
        data = request.get_json()
        # 【修改】接收 'ids' 而不是 'plateNumbers'
        violation_ids = data.get('ids')
        new_status = data.get('status')

        # 【修改】驗證 'ids' 欄位
        if not violation_ids or not isinstance(violation_ids, list) or len(violation_ids) == 0:
            return jsonify({'error': '請求格式錯誤，需要一個非空的 "ids" 列表'}), 400

        if not new_status or new_status not in ['待審核', '已確認', '已駁回', '已開罰']:
            return jsonify({'error': '無效的 "status" 欄位'}), 400

        conn = get_db_connection()
        with conn.cursor() as cur:
            # 【修改】使用更安全、更高效的 PostgreSQL 語法來更新
            # `WHERE id = ANY(%s)` 可以安全地處理 ID 列表
            update_query = "UPDATE violations SET status = %s WHERE id = ANY(%s::int[])"
            params = (new_status, violation_ids)
            
            # --- 如果您使用 MySQL，請改用以下兩行 ---
            # placeholders = ','.join(['%s'] * len(violation_ids))
            # update_query = f"UPDATE violations SET status = %s WHERE id IN ({placeholders})"
            # params = [new_status] + violation_ids
            # -----------------------------------------

            cur.execute(update_query, params)
            updated_rows = cur.rowcount

        conn.commit()
        conn.close()

        return jsonify({'message': f'成功更新 {updated_rows} 筆紀錄的狀態'}), 200

    except Exception as e:
        if 'conn' in locals() and conn:
            conn.rollback() # 確保出錯時回滾
        print(f"❌ Error in update_violations_status: {e}")
        return jsonify({'error': '內部伺服器錯誤'}), 500

# ==================================================
# WebSocket 廣播新違規事件
# ==================================================
@app.route('/notify/new-violation', methods=['POST'])
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


# ==================================================
# WebSocket 連線事件
# ==================================================
@socketio.on('connect')
def handle_connect():
    print('✅ Client connected')


@socketio.on('disconnect')
def handle_disconnect():
    print('❌ Client disconnected')

# ==================================================
# 獲取待處理罰單數量 API
# ==================================================
@app.route('/api/violations/confirmed-count', methods=['GET'])
def get_confirmed_violations_count():
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # 查詢 status 為 '已確認' 的紀錄總數
            cur.execute("SELECT COUNT(*) FROM violations WHERE status = '已確認';")
            count = cur.fetchone()[0]
        conn.close()
        return jsonify({'count': count})
    except Exception as e:
        print(f"❌ Error in get_confirmed_violations_count: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500


# ==================================================
# 【新增】車主資料查詢 API
# ==================================================
@app.route('/api/owners/<plate_number>', methods=['GET'])
def get_owner_info(plate_number):
    """
    根據車牌號碼查詢車主資料
    參數: plate_number - 車牌號碼 (URL 路徑參數)
    回傳: 車主完整資訊 (基於 owners 資料表結構)
    """
    try:
        if not plate_number:
            return jsonify({'error': '車牌號碼不能為空'}), 400

        conn = get_db_connection()
        with conn.cursor() as cur:
            # 先嘗試查詢所有欄位，如果失敗則查詢基本欄位
            try:
                cur.execute("""
                    SELECT license_plate_number, full_name, id_number, email, 
                           phone_number, address, vehicle_type, gender, date_of_birth
                    FROM owners 
                    WHERE license_plate_number = %s;
                """, (plate_number,))
                owner_data = cur.fetchone()
                has_extended_fields = True
            except Exception as e:
                print(f"⚠️ Extended fields not available, using basic fields: {e}")
                # 回退到基本欄位
                cur.execute("""
                    SELECT license_plate_number, full_name, id_number, email, 
                           phone_number, address, vehicle_type
                    FROM owners 
                    WHERE license_plate_number = %s;
                """, (plate_number,))
                owner_data = cur.fetchone()
                has_extended_fields = False
        conn.close()

        if not owner_data:
            return jsonify({'error': '找不到該車牌號碼的車主資料'}), 404

        # 格式化回傳資料
        owner_info = {
            'license_plate_number': owner_data[0],
            'full_name': owner_data[1],
            'id_number': owner_data[2],
            'email': owner_data[3],
            'phone_number': owner_data[4],
            'address': owner_data[5],
            'vehicle_type': owner_data[6],
            'gender': owner_data[7] if has_extended_fields and len(owner_data) > 7 else '',
            'date_of_birth': owner_data[8] if has_extended_fields and len(owner_data) > 8 else ''
        }

        return jsonify(owner_info), 200

    except Exception as e:
        print(f"❌ Error in get_owner_info: {e}")
        return jsonify({'error': 'Internal Server Error', 'details': str(e)}), 500


# ==================================================
# 【新增】根據車牌號碼查詢車輛類型 API
# ==================================================
@app.route('/api/owners/<plate_number>/vehicle-type', methods=['GET'])
def get_vehicle_type(plate_number):
    """
    根據車牌號碼查詢車輛類型
    參數: plate_number - 車牌號碼 (URL 路徑參數)
    回傳: 車輛類型資訊
    """
    try:
        if not plate_number:
            return jsonify({'error': '車牌號碼不能為空'}), 400

        conn = get_db_connection()
        with conn.cursor() as cur:
            # 只查詢車輛類型，簡化回應
            cur.execute("""
                SELECT license_plate_number, vehicle_type
                FROM owners 
                WHERE license_plate_number = %s;
            """, (plate_number,))
            
            owner_data = cur.fetchone()
        conn.close()

        if not owner_data:
            return jsonify({'error': '找不到該車牌號碼的車輛類型'}), 404

        # 格式化回傳資料
        vehicle_info = {
            'license_plate_number': owner_data[0],
            'vehicle_type': owner_data[1]
        }

        return jsonify(vehicle_info), 200

    except Exception as e:
        print(f"❌ Error in get_vehicle_type: {e}")
        return jsonify({'error': 'Internal Server Error', 'details': str(e)}), 500
    

# ==================================================
# 【新增】罰單產生區 API
# ==================================================
# 1. 獲取罰單列表 (依據 '已確認' 或 '已開罰' 狀態)
@app.route('/api/tickets/list', methods=['GET'])
def get_tickets_list():
    status = request.args.get('status')
    if not status or status not in ['已確認', '已開罰']:
        return jsonify({'error': "必須提供 '已確認' 或 '已開罰' 的 status 參數"}), 400

    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # 【修正】從 SELECT 語句中移除 confidence
            cur.execute("""
                SELECT id, violation_type, license_plate, timestamp, violation_address
                FROM violations 
                WHERE status = %s
                ORDER BY timestamp DESC;
            """, (status,))
            violations_raw = cur.fetchall()
        conn.close()

        # 【修正】從回傳的 JSON 中移除 confidence
        violations = [
            {
                'id': row[0],
                'type': row[1],
                'plateNumber': row[2],
                'timestamp': row[3].isoformat() if row[3] else None,
                'location': row[4]
            }
            for row in violations_raw
        ]
        return jsonify(violations)
    except Exception as e:
        print(f"❌ Error in get_tickets_list: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500


# 2. 獲取罰單統計數量與總金額
@app.route('/api/tickets/counts', methods=['GET'])
def get_tickets_counts():
    """
    專為「罰單產生區」設計，獲取統計數字。
    """
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(CASE WHEN status = '已確認' THEN 1 END) AS pending_count,
                    COUNT(CASE WHEN status = '已開罰' THEN 1 END) AS generated_count,
                    COALESCE(SUM(CASE WHEN status = '已開罰' THEN fine END), 0) AS total_fine
                FROM violations;
            """)
            counts = cur.fetchone()
        conn.close()

        result = {
            'pendingCount': int(counts[0]) if counts else 0,
            'generatedCount': int(counts[1]) if counts else 0,
            'totalFine': int(counts[2]) if counts else 0
        }
        return jsonify(result)
    except Exception as e:
        print(f"❌ Error in get_tickets_counts: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500
    
@app.route('/api/violation/<int:violation_id>/generate-ticket', methods=['POST'])
def generate_ticket(violation_id):
    """
    生成罰單並發送電子郵件通知
    """
    try:
        # 獲取請求資料
        data = request.get_json()
        owner_info = data.get('ownerInfo', {})
        sms_content = data.get('smsContent', '')
        recipient_email = data.get('recipient_email')  # 新增：從請求中獲取收件人郵件
        
        print(f"🔍 DEBUG generate_ticket: 請求資料 = {data}")
        print(f"🔍 DEBUG generate_ticket: recipient_email = {recipient_email}")
        print(f"🔍 DEBUG generate_ticket: owner_info = {owner_info}")
        
        conn = get_db_connection()
        with conn.cursor() as cur:
            # 首先獲取違規詳細資料
            cur.execute("""
                SELECT id, violation_type, license_plate, timestamp, violation_address, status
                FROM violations 
                WHERE id = %s;
            """, (violation_id,))
            
            violation_data = cur.fetchone()
            if not violation_data:
                return jsonify({'error': '找不到指定的違規紀錄'}), 404
                
            # 檢查狀態是否為已確認
            if violation_data[5] != '已確認':
                return jsonify({'error': '違規狀態不符，無法生成罰單'}), 400
            
            # 更新違規狀態為已開罰
            cur.execute(
                "UPDATE violations SET status = '已開罰' WHERE id = %s;", 
                (violation_id,)
            )
            
            # 準備違規資料用於email
            violation_info = {
                'id': violation_data[0],
                'type': violation_data[1],  # violation_type
                'plateNumber': violation_data[2],
                'timestamp': violation_data[3],
                'location': violation_data[4]
            }
            
        conn.commit()
        conn.close()
        
        # 如果有指定收件人或車主email，發送電子郵件
        email_sent = False
        email_address = recipient_email or (owner_info.get('email') if owner_info else None)
        
        if email_address:
            email_sent = send_violation_ticket_email(
                recipient_email=email_address,
                owner_name=owner_info.get('full_name', '') if owner_info else '',
                violation_data=violation_info,
                sms_content=sms_content
            )
        
        # 準備回應訊息
        response_message = f'罰單 (ID: {violation_id}) 已成功生成。'
        if email_sent:
            response_message += f' 電子罰單已發送至 {email_address}'
        elif email_address:
            response_message += ' 但電子郵件發送失敗。'
        else:
            response_message += ' 未提供收件人電子郵件，僅更新狀態。'
            
        return jsonify({
            'message': response_message,
            'email_sent': email_sent,
            'violation_id': violation_id
        }), 200
            
    except Exception as e:
        print(f"❌ Error in generate_ticket: {e}")
        return jsonify({'error': 'Internal Server Error', 'details': str(e)}), 500
    

# ==================================================
# 【新增】統計分析 API 
# ==================================================
@app.route('/api/analytics', methods=['GET'])
def get_analytics_data():
    """
    獲取儀表板所需的所有統計分析數據。
    支持的查詢參數:
    - time_range: 'today', 'last7days', 'last30days' (預設)
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # 1. 獲取時間範圍參數並設定 SQL 時間條件
        time_range = request.args.get('time_range', 'last30days')
        time_filter_sql = ""
        if time_range == 'today':
            time_filter_sql = "AND timestamp >= CURRENT_DATE"
        elif time_range == 'last7days':
            time_filter_sql = "AND timestamp >= NOW() - INTERVAL '7 days'"
        else: # last30days
            time_filter_sql = "AND timestamp >= NOW() - INTERVAL '30 days'"

        # --- 2. 計算 KPI 總覽數據 ---
        cur.execute(f"""
            SELECT
                COUNT(*) AS total_violations,
                COUNT(CASE WHEN status = '已開罰' THEN 1 END) AS tickets_issued,
                COALESCE(SUM(CASE WHEN status = '已開罰' THEN fine END), 0) AS total_fines
            FROM violations  -- <--- 修正點 1
            WHERE 1=1 {time_filter_sql};
        """)
        kpi = cur.fetchone()
        kpi_data = {
            'totalViolations': kpi[0],
            'confirmationRate': 0.0, # AI 準確率邏輯較複雜，暫時回傳 0
            'ticketsIssued': kpi[1],
            'totalFines': int(kpi[2]),
        }

        # --- 3. 計算違規趨勢 (依日期) ---
        cur.execute(f"""
            SELECT
                date_trunc('day', timestamp)::date AS day,
                COUNT(id)
            FROM violations  -- <--- 修正點 2
            WHERE 1=1 {time_filter_sql}
            GROUP BY day
            ORDER BY day;
        """)
        trend = cur.fetchall()
        trend_data = {
            'labels': [t[0].strftime('%m-%d') for t in trend],
            'data': [t[1] for t in trend]
        }
        
        # --- 4. 計算違規類型分布 ---
        cur.execute(f"""
            SELECT violation_type, COUNT(id)
            FROM violations  -- <--- 修正點 3
            WHERE 1=1 {time_filter_sql}
            GROUP BY violation_type
            ORDER BY COUNT(id) DESC;
        """)
        type_dist = cur.fetchall()
        type_distribution_data = {
            'labels': [t[0] for t in type_dist],
            'data': [t[1] for t in type_dist]
        }

        # --- 5. 計算高風險區域分析 (前 5 名) ---
        cur.execute(f"""
            SELECT violation_address, COUNT(id)
            FROM violations  -- <--- 修正點 4
            WHERE 1=1 {time_filter_sql}
            GROUP BY violation_address
            ORDER BY COUNT(id) DESC
            LIMIT 5;
        """)
        locations = cur.fetchall()
        location_data = {
            'labels': [l[0] for l in locations],
            'data': [l[1] for l in locations]
        }
        
        # --- 6. 執法效率分析 ---
        # 注意：此為靜態示意數據
        efficiency_data = {
            'labels': ['待審核', '已確認', '已駁回', '已開罰'],
            'data': [0, 1.3, 0.85, 2.6]
        }
        
        # --- 7. 罰款收入統計 (過去 6 個月) ---
        cur.execute("""
            SELECT
                to_char(date_trunc('month', timestamp), 'YYYY-MM') AS month,
                SUM(fine)
            FROM violations  -- <--- 修正點 5
            WHERE status = '已開罰' AND timestamp >= NOW() - INTERVAL '6 months'
            GROUP BY month
            ORDER BY month;
        """)
        revenue = cur.fetchall()
        revenue_data = {
            'labels': [r[0] for r in revenue],
            'data': [int(r[1]) if r[1] is not None else 0 for r in revenue] # 增加 None 檢查
        }

        # --- 8. 組合所有數據並回傳 ---
        response_data = {
            'kpi': kpi_data,
            'trend': trend_data,
            'typeDistribution': type_distribution_data,
            'locationAnalysis': location_data,
            'efficiencyAnalysis': efficiency_data,
            'revenue': revenue_data,
        }

        cur.close()
        conn.close()

        return jsonify(response_data)

    except Exception as e:
        print(f"❌ Error in get_analytics_data: {e}")
        # 確保在出錯時也能關閉連線
        if 'cur' in locals() and cur and not cur.closed: cur.close()
        if 'conn' in locals() and conn and not conn.closed: conn.close()
        return jsonify({'error': 'Internal Server Error', 'details': str(e)}), 500


# ==================================================
# 【新增】使用者註冊 API (適應你的 users 表)
# ==================================================
@app.route('/api/register', methods=['POST'])
@admin_required()
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    name = data.get('name')
    # 角色可以由前端傳入，或由後端指定預設值
    role = data.get('role', 'operator') 

    # --- 伺服器端驗證 ---
    if not all([username, email, password, name]):
        return jsonify({"error": "所有欄位 (username, email, password, name) 都是必填的"}), 400
    if role not in ['admin', 'operator']:
        return jsonify({"error": "無效的角色，只能是 'admin' 或 'operator'"}), 400

    # --- 密碼雜湊 ---
    # 【重要】儲存雜湊後的密碼，而不是原始密碼
    hashed_password = generate_password_hash(password)

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 檢查 username 或 email 是否已存在
        cur.execute("SELECT id FROM users WHERE username = %s OR email = %s", (username, email))
        if cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({"error": "使用者名稱或電子郵件已存在"}), 409 # 409 Conflict

        # 【修改】INSERT 語句以匹配你的資料表欄位
        # 注意：我們讓 id, status, createdAt 等欄位使用資料庫的預設值
        sql = """
            INSERT INTO users (username, email, password, name, role)
            VALUES (%s, %s, %s, %s, %s) RETURNING id;
        """
        cur.execute(sql, (username, email, hashed_password, name, role))
        
        # 獲取新建立的使用者 ID (可選)
        new_user_id = cur.fetchone()[0]
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({
            "message": f"使用者 '{username}' 註冊成功",
            "userId": new_user_id
        }), 201

    except psycopg2.Error as e:
        print(f"❌ 資料庫錯誤 in register: {e}")
        return jsonify({"error": "資料庫操作失敗"}), 500
    except Exception as e:
        print(f"❌ 未知錯誤 in register: {e}")
        return jsonify({"error": "伺服器內部錯誤"}), 500



# ==================================================
# 【使用者登入 API (最終修正版 - 加入 lastLogin 更新)】
# ==================================================
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "請提供使用者名稱和密碼"}), 400

    try:
        # 第一次連線：用來驗證使用者是否存在
        conn = get_db_connection()
        cur = conn.cursor()
        
        sql = """
            SELECT id, username, password, role, name, status 
            FROM users 
            WHERE username = %s OR email = %s
        """
        cur.execute(sql, (username, username))
        user = cur.fetchone()
        cur.close()
        conn.close()

        if user:
            db_id, db_username, db_password_hash, db_role, db_name, db_status = user
            
            if db_status != '啟用':
                return jsonify({"error": "此帳號已被停用"}), 403

            # 驗證密碼
            if check_password_hash(db_password_hash, password):
                
                # --- 【核心修改】在回傳 token 之前，更新 lastLogin 時間戳 ---
                try:
                    # 建立一個新的資料庫連線來執行 UPDATE 操作
                    update_conn = get_db_connection()
                    update_cur = update_conn.cursor()
                    
                    # 使用 UTC 時間以保持時區一致性，並更新指定 user id 的 lastLogin 欄位
                    update_cur.execute(
                        'UPDATE users SET "lastLogin" = %s WHERE id = %s',
                        (datetime.now(timezone.utc), db_id)
                    )
                    
                    update_conn.commit() # 提交變更
                    update_cur.close()
                    update_conn.close()
                except Exception as e:
                    print(f"❌ 更新 lastLogin 失敗: {e}")
                    # 注意：即使更新 lastLogin 失敗，我們仍然繼續登入流程，
                    # 因為這不是核心功能，不應該因此阻止使用者登入。
                # --------------------------------------------------------

                # 密碼正確，繼續產生 JWT Token
                identity = db_username
                additional_claims = {"role": db_role, "name": db_name}
                access_token = create_access_token(identity=identity, additional_claims=additional_claims)
                
                return jsonify(access_token=access_token)

        # 如果使用者不存在或密碼錯誤
        return jsonify({"error": "使用者名稱或密碼錯誤"}), 401

    except Exception as e:
        print(f"❌ 登入過程中發生嚴重錯誤: {e}")
        return jsonify({"error": "伺服器內部錯誤"}), 500


# ==================================================
# 【新增】一個 API 來獲取當前登入使用者的資訊
# ==================================================
@app.route('/api/profile', methods=['GET'])
@jwt_required() # <--- 確保只有登入的使用者能存取
def get_profile():
    # get_jwt_identity() 會回傳我們在 create_access_token 時放入的 identity_data
    current_user = get_jwt_identity()
    return jsonify(logged_in_as=current_user) # <-- 【修正 4】這裡回傳的 JSON key 修正了一下

# ==================================================
# 【新增】忘記密碼流程 API
# ==================================================

# --- API 1: 請求密碼重設 ---
@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get('email')
    if not email:
        return jsonify({"error": "必須提供電子郵件地址"}), 400

    # --- 【偵錯 1】檢查 Flask app 的郵件設定是否被正確載入 ---
    print("--- DEBUG: Mail Config ---")
    print(f"MAIL_SERVER: {app.config.get('MAIL_SERVER')}")
    print(f"MAIL_USERNAME: {app.config.get('MAIL_USERNAME')}")
    # 為了安全，我們不直接打印密碼，只檢查它是否存在
    print(f"MAIL_PASSWORD is set: {'Yes' if app.config.get('MAIL_PASSWORD') else 'No'}")
    print("--------------------------")
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        user = cur.fetchone()

        if user:
            token = secrets.token_urlsafe(32)
            expires = datetime.now(timezone.utc) + timedelta(hours=1)
            
            cur.execute(
                "UPDATE users SET reset_token = %s, reset_token_expires = %s WHERE email = %s",
                (token, expires, email)
            )
            conn.commit()

            reset_url = f"http://localhost:8080/reset-password?token={token}"
            msg = Message(
                subject="[Traffic AI] 密碼重設請求",
                recipients=[email]
            )
            msg.body = f"""您好，

            您已請求重設您的 Traffic AI 系統密碼。
            請點擊以下連結來設定您的新密碼：
            {reset_url}

            如果您沒有請求此操作，請忽略此郵件。
            此連結將在 1 小時後失效。

            謝謝！
            Traffic AI 系統團隊
            """
            
            mail.send(msg)

            # --- 【偵錯 2】在發送郵件前後都加上日誌 ---
            print(">>> Attempting to send email...")
            mail.send(msg)
            print(">>> mail.send(msg) executed without crashing.")

        cur.close()
        conn.close()

        return jsonify({"message": "如果該電子郵件已註冊，一封密碼重設郵件已被發送。"}), 200

    except Exception as e:
        # --- 【偵錯 3】確保任何錯誤都會被打印出來 ---
        print(f"❌❌❌ CRITICAL ERROR in forgot_password: {e}")
        import traceback
        traceback.print_exc() # 打印完整的錯誤堆疊
        return jsonify({"error": "伺服器內部錯誤"}), 500


# --- API 2: 驗證重設 Token ---
@app.route('/api/verify-reset-token', methods=['POST'])
def verify_reset_token():
    data = request.get_json()
    token = data.get('token')
    if not token:
        return jsonify({"error": "缺少 token"}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM users WHERE reset_token = %s AND reset_token_expires > %s",
            (token, datetime.now(timezone.utc))
        )
        user = cur.fetchone()
        cur.close()
        conn.close()

        if user:
            return jsonify({"message": "Token 有效"}), 200
        else:
            return jsonify({"error": "無效或已過期的 token"}), 400

    except Exception as e:
        print(f"❌ Error in verify_reset_token: {e}")
        return jsonify({"error": "伺服器內部錯誤"}), 500


# --- API 3: 重設密碼 ---
@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('password')

    if not token or not new_password:
        return jsonify({"error": "缺少 token 或新密碼"}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM users WHERE reset_token = %s AND reset_token_expires > %s",
            (token, datetime.now(timezone.utc))
        )
        user = cur.fetchone()

        if not user:
            cur.close()
            conn.close()
            return jsonify({"error": "無效或已過期的 token"}), 400
        
        # 密碼雜湊
        hashed_password = generate_password_hash(new_password)
        
        # 更新密碼，並清除 token，確保它只能用一次
        cur.execute(
            "UPDATE users SET password = %s, reset_token = NULL, reset_token_expires = NULL WHERE id = %s",
            (hashed_password, user[0])
        )
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({"message": "密碼已成功重設"}), 200

    except Exception as e:
        print(f"❌ Error in reset_password: {e}")
        return jsonify({"error": "伺服器內部錯誤"}), 500


# ==================================================
# 【新增】獲取違規圖片 API
# ==================================================
@app.route('/api/violations/<int:violation_id>/image', methods=['GET'])
def get_violation_image(violation_id):
    """
    根據違規紀錄 ID 獲取對應的 base64 編碼圖片數據
    參數: violation_id - 違規紀錄的 ID (URL 路徑參數)
    回傳: base64 編碼的圖片數據
    """
    try:
        if not violation_id:
            return jsonify({'error': '違規紀錄 ID 不能為空'}), 400

        conn = get_db_connection()
        with conn.cursor() as cur:
            # 查詢指定 ID 的違規紀錄的圖片數據
            cur.execute("""
                SELECT image_data, image_path, license_plate
                FROM violations 
                WHERE id = %s;
            """, (violation_id,))
            
            violation_data = cur.fetchone()
        conn.close()

        if not violation_data:
            return jsonify({'error': '找不到該違規紀錄'}), 404

        image_data, image_path, license_plate = violation_data

        # 如果有 base64 圖片數據，直接回傳
        if image_data:
            return jsonify({
                'success': True,
                'image_data': image_data,
                'license_plate': license_plate,
                'image_source': 'database'
            }), 200
        
        # 如果沒有 base64 數據，嘗試從檔案路徑讀取
        if image_path and os.path.exists(image_path):
            try:
                with open(image_path, 'rb') as image_file:
                    import base64
                    image_binary = image_file.read()
                    image_data_b64 = base64.b64encode(image_binary).decode('utf-8')
                    return jsonify({
                        'success': True,
                        'image_data': image_data_b64,
                        'license_plate': license_plate,
                        'image_source': 'file'
                    }), 200
            except Exception as e:
                print(f"❌ 讀取圖片檔案失敗: {e}")
                return jsonify({'error': '無法讀取圖片檔案'}), 500
        
        # 如果都沒有，回傳找不到圖片
        return jsonify({'error': '找不到對應的圖片數據'}), 404

    except Exception as e:
        print(f"❌ Error in get_violation_image: {e}")
        return jsonify({'error': 'Internal Server Error', 'details': str(e)}), 500


# ==================================================
# 【新增】使用者管理 API
# ==================================================
@app.route('/api/users', methods=['GET'])
@admin_required()
def get_users_list():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # 查询所有使用者，但不包含敏感的 password 和 refreshToken 栏位
        cur.execute("SELECT id, username, email, name, role, status, lastLogin FROM users ORDER BY createdAt DESC")
        users_raw = cur.fetchall()
        cur.close()
        conn.close()

        users = [
            {
                "id": row[0],
                "username": row[1],
                "email": row[2],
                "name": row[3],
                "role": row[4],
                "status": row[5],
                "lastLogin": row[6].isoformat() if row[6] else None,
            }
            for row in users_raw
        ]
        return jsonify(users)
    except Exception as e:
        print(f"❌ Error in get_users_list: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500

    

# ==================================================
# 主程式啟動
# ==================================================
if __name__ == "__main__":
    socketio.run(app, host='0.0.0.0', port=3002, debug=True, allow_unsafe_werkzeug=True)
