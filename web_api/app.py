import os
import psycopg2
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO

# --- 應用程式設定 ---
load_dotenv()
app = Flask(__name__)

# 允許的前端來源，.env 裡可設定 CORS_ALLOWED_ORIGINS=http://localhost:8080
allowed_origins = os.getenv('CORS_ALLOWED_ORIGINS', '*')
CORS(app, resources={r"/*": {"origins": allowed_origins.split(',')}}, supports_credentials=True)
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
    try:
        status = request.args.get('status')
        search = request.args.get('search')
        v_type = request.args.get('type')
        location = request.args.get('location')
        date = request.args.get('date')

        base_query = """
            SELECT violation_type, license_plate, timestamp, violation_address, status
            FROM violations
            WHERE 1=1
        """
        params = []

        if status and status != '全部':
            base_query += " AND status = %s"
            params.append(status)

        if search:
            base_query += " AND (id::text ILIKE %s OR license_plate ILIKE %s)"
            search_term = f"%{search}%"
            params.extend([search_term, search_term])

        if v_type and v_type != '所有類型':
            base_query += " AND violation_type = %s"
            params.append(v_type)

        if location and location != '所有地點':
            base_query += " AND violation_address = %s"
            params.append(location)

        base_query += " ORDER BY timestamp DESC"

        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(base_query, tuple(params))
            violations_raw = cur.fetchall()
        conn.close()

        violations = [
            {
                'type': row[0],
                'plateNumber': row[1],
                'timestamp': row[2].isoformat() if row[2] else None,
                'location': row[3],
                'status': row[4]
            }
            for row in violations_raw
        ]

        return jsonify(violations)

    except Exception as e:
        print(f"❌ Error in get_violations: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500


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
# 違規狀態更新 API (修正 CORS 預檢問題)
@app.route('/violations/status', methods=['PUT', 'OPTIONS'])
def update_violations_status():
    if request.method == 'OPTIONS':
        # 處理預檢請求
        response = jsonify({'message': 'CORS preflight OK'})
        response.headers.add("Access-Control-Allow-Origin", "http://localhost:8080")
        response.headers.add("Access-Control-Allow-Methods", "PUT, OPTIONS")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        return response, 200

    try:
        data = request.get_json()
        plate_numbers = data.get('plateNumbers')
        new_status = data.get('status')

        if not plate_numbers or not isinstance(plate_numbers, list) or len(plate_numbers) == 0:
            return jsonify({'error': 'Invalid "plateNumbers" field.'}), 400

        if not new_status or new_status not in ['待審核', '已確認', '已駁回', '已開罰']:
            return jsonify({'error': 'Invalid "status" field.'}), 400

        conn = get_db_connection()
        with conn.cursor() as cur:
            placeholders = ','.join(['%s'] * len(plate_numbers))
            update_query = f"UPDATE violations SET status = %s WHERE license_plate IN ({placeholders})"
            cur.execute(update_query, [new_status] + plate_numbers)
            updated_rows = cur.rowcount

        conn.commit()
        conn.close()

        return jsonify({'message': f'Successfully updated status for {updated_rows} records.'}), 200

    except Exception as e:
        if 'conn' in locals() and conn:
            conn.rollback()
        print(f"❌ Error in update_violations_status: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500

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
# 主程式啟動
# ==================================================
if __name__ == "__main__":
    socketio.run(app, host='0.0.0.0', port=3002, debug=True, allow_unsafe_werkzeug=True)
