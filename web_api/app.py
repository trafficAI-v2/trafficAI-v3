import os
import psycopg2
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt, JWTManager
from functools import wraps

# --- 應用程式設定 ---
load_dotenv()
app = Flask(__name__)

# 允許的前端來源，.env 裡可設定 CORS_ALLOWED_ORIGINS=http://localhost:8080
allowed_origins = os.getenv('CORS_ALLOWED_ORIGINS', '*')
CORS(app)
socketio = SocketIO(app, cors_allowed_origins=allowed_origins)

# --- 資料庫連線 ---
def get_db_connection():
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise ValueError("DATABASE_URL not set in .env file")
    conn = psycopg2.connect(db_url)
    return conn


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
    """
    try:
        # 1. 從請求的 URL 中獲取所有可能的查詢參數
        status = request.args.get('status')
        search = request.args.get('search')
        v_type = request.args.get('type')
        location = request.args.get('location')
        date = request.args.get('date')

        # 2. 建立基礎 SQL 查詢語句和一個空的參數列表
        # 【修改】在 SELECT 查詢的最前面加上 id
        base_query = """
            SELECT id, violation_type, license_plate, timestamp, violation_address, status
            FROM violations
            WHERE 1=1
        """
        params = [] # 參數列表，用於安全地傳遞值，防止 SQL Injection

        # 3. 根據傳入的參數，動態地建立 SQL 的 WHERE 條件
        # (這部分的 if 判斷邏輯完全不需要變動)
        if status and status != '全部':
            base_query += " AND status = %s"
            params.append(status)
        if search:
            base_query += " AND license_plate ILIKE %s"
            search_term = f"%{search}%"
            params.append(search_term)
        if v_type and v_type != '所有類型':
            base_query += " AND violation_type = %s"
            params.append(v_type)
        if location and location != '所有地點':
            base_query += " AND violation_address = %s"
            params.append(location)
        if date:
            base_query += " AND timestamp::date = %s"
            params.append(date)

        # 4. 加入排序，讓最新的紀錄顯示在最上面
        base_query += " ORDER BY timestamp DESC"

        # 5. 連接資料庫並執行查詢
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(base_query, tuple(params))
            violations_raw = cur.fetchall()
        conn.close()

        # 6. 將從資料庫取出的原始資料 (tuple) 格式化為前端需要的 JSON 格式
        # 【修改】將 id 加入回傳的 JSON 中，並更新所有欄位的索引
        violations = [
            {
                'id': row[0],           # id 現在是第 0 個欄位
                'type': row[1],         # violation_type 現在是第 1 個欄位
                'plateNumber': row[2],  # license_plate 現在是第 2 個欄位
                'vehicleType': '',
                'timestamp': row[3].isoformat() if row[3] else None, # timestamp 是第 3 個
                'location': row[4],     # violation_address 是第 4 個
                'status': row[5]        # status 是第 5 個
            }
            for row in violations_raw
        ]

        # 7. 回傳 JSON 格式的結果
        return jsonify(violations)

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
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # 將指定 id 的紀錄狀態從 '已確認' 更新為 '已開罰'
            cur.execute(
                "UPDATE violations SET status = '已開罰' WHERE id = %s AND status = '已確認';", 
                (violation_id,)
            )
            updated_rows = cur.rowcount
        conn.commit()
        conn.close()

        if updated_rows > 0:
            return jsonify({'message': f'罰單 (ID: {violation_id}) 已成功生成。'}), 200
        else:
            # 如果找不到對應的 ID 或狀態不符，回傳 404 是合理的
            return jsonify({'error': '找不到對應的待處理紀錄，或狀態不符。'}), 404
            
    except Exception as e:
        print(f"❌ Error in generate_ticket: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500
    

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
# 主程式啟動
# ==================================================
if __name__ == "__main__":
    socketio.run(app, host='0.0.0.0', port=3002, debug=True, allow_unsafe_werkzeug=True)
