# Traffic AI 交通違規檢測系統

基於 YOLOv8 的企業級即時交通違規檢測系統，專門檢測未戴安全帽的違規行為。採用混合架構設計，結合 Docker 容器化後端服務與本地攝影機檢測，完美解決 macOS Docker 攝影機存取限制。系統包含完整的 React 前端管理界面、Flask API 後端、實時 WebSocket 推送、PostgreSQL 數據存儲、以及詳細的日誌審計功能。

## ⚡ 核心特性

- 🎯 **即時違規檢測**: YOLOv8 模型高精度識別未戴安全帽行為
- 🚗 **自動車牌識別**: 整合車牌識別 API 自動記錄違規車輛信息
- 📊 **即時數據儲存**: PostgreSQL 資料庫自動記錄違規詳細信息（含置信度）
- 🌐 **現代化前端**: React 18 + TypeScript + Vite 響應式管理介面
- 🔄 **即時通知**: WebSocket (Socket.io) 實時推送違規事件
- 👨‍💼 **完整的權限管理**: 基於 JWT Token 的身份驗證，支持管理員和操作員角色
- 🐳 **容器化部署**: Docker Compose 一鍵部署
- 🍎 **macOS 相容**: 混合模式完美支援 macOS 攝影機存取
- 🔐 **系統審計日誌**: 所有用戶操作記錄，支持按模塊、級別、用戶篩選
- 📈 **數據分析儀表板**: 圖表化展示違規趨勢、類型分佈、罰款收入等
- 🎫 **電子罰單系統**: 支持自動生成並發送 HTML 郵件罰單（含違規照片）
- 🔧 **完整的系統管理**: 用戶 CRUD 管理、數據庫管理、系統性能監控

## 快速開始

### 1. 環境需求

- **macOS** (推薦) 或 Linux
- **Python 3.11+**
- **Docker** 和 **Docker Compose**
- **攝影機** (內建或外接 USB 攝影機)

### 2. 下載專案

```bash
git clone https://github.com/luhan0413/trafficAI-v2.git
```

```bash
cd trafficAI-v2
```

### 4. 一鍵啟動系統

#### 方法一：自動化啟動 (推薦)
```bash
# 首次部署或重大更新
./deploy_with_features.sh
```

```bash
# 日常重啟
./restart_system.sh
```

```bash
cd detect_API
```
```bash
python run_local_optimized.py
```

#### 方法三：傳統啟動方式

```bash
# 1. 建立並啟動所有 Docker 服務
docker-compose up --build -d

# 2. 進入檢測目錄
cd detect_API

# 3. 啟動本地攝影機檢測
python run_local_optimized.py
```

### 5. 存取系統

開啟瀏覽器訪問：**http://localhost:8080**

## 🔧 安裝依賴 (如有需要)

```bash
# 進入檢測服務目錄
cd detect_API

# 安裝 Python 依賴
pip install -r requirements.txt

# 返回專案根目錄
cd ..

## 🌐 服務端口對應

| 服務名稱               | Port | 描述               | 存取方式 |
| --------------------- | ---- | ------------------ | -------- |
| traffic-system (前端)  | 8080 | React 前端介面     | http://localhost:8080 |
| detect_API (本地)      | 5001 | 安全帽違規偵測 API  | 本地攝影機檢測 |
| carplate_detect_api   | 3001 | 車牌識別 API       | Docker 容器 |
| web_api               | 3002 | 後端 Flask API     | Docker 容器 |
| Redis                 | 6379 | 快取服務           | Docker 容器 |

## 🛠 故障排除

### 常見問題

#### 1. 端口被占用
```bash
# 檢查端口使用情況
lsof -i :8080
lsof -i :3001
lsof -i :3002
lsof -i :5001

# 停止占用的進程
kill -9 <PID>
```

#### 2. Docker 服務異常
```bash
# 重啟 Docker 服務
docker compose down
# 重建容器和重啟 Docker
docker compose up -d --build
#建立 Docker 並在背景啟動
docker compose up -d
#少了 -d 啟動容器並日誌會直接輸出在終端機
docker compose up 

# 檢視容器日誌
docker logs traffic_frontend
docker logs traffic_api_web
docker logs traffic_api_carplate
```

#### 3. 攝影機無法存取 (macOS)
```bash
# 檢查攝影機權限
# 系統偏好設定 → 安全性與隱私 → 攝影機

# 測試不同攝影機索引
python3 -c "import cv2; print('Camera 0:', cv2.VideoCapture(0).isOpened())"
python3 -c "import cv2; print('Camera 1:', cv2.VideoCapture(1).isOpened())"
```

## 🔄 系統管理指令

```bash
# 檢查服務狀態
docker ps

# 查看服務日誌
docker logs -f traffic_frontend

# 重啟特定服務
docker restart traffic_api_web

# 完全重置系統
docker compose down
docker system prune -f
./restart_system.sh
```

## ⚡ 快速腳本

專案包含便利的啟動腳本：

- **`restart_system.sh`**: 完整系統重啟
- **`start_detection.py`**: 僅啟動本地檢測
- **`start_hybrid_system.py`**: 混合模式啟動器


## 📂 專案結構

```bash
trafficAI-v2/
├── README.md                   # 專案說明文件
├── docker-compose.yml          # Docker 編排配置
├── .env                        # 環境變數配置
├── restart_system.sh           # 🔄 系統重啟腳本
├── start_detection.py          # 📸 檢測啟動腳本
├── start_hybrid_system.py      # 🎯 混合模式啟動器
│
├── traffic-system/             # React 前端 (Port 8080)
│   ├── Dockerfile              # 前端容器配置
│   ├── package.json            # Node.js 依賴管理
│   ├── vite.config.ts          # Vite 構建配置
│   ├── public/                 # 靜態資源目錄
│   └── src/                    # React 源代碼 (5701 LOC)
│       ├── App.tsx             # 主應用組件 (路由定義、路由守衛)
│       ├── main.tsx            # 應用程式入口 (AuthProvider、Router)
│       ├── components/         # UI 組件目錄 (19 個組件)
│       │   ├── common/         # 通用組件 (Modal、ErrorBoundary)
│       │   ├── layout/         # 佈局組件 (Layout、Header)
│       │   ├── dashboard/      # 儀表板組件 (StatusCard、ViolationPanel、CameraFeed)
│       │   ├── violations/     # 違規處理組件 (GenerateTickets、TicketGenerationModal)
│       │   └── system/         # 系統管理組件 (AddUserForm、SystemSettings、DatabaseManagement、SystemLogs、SystemPerformance 等)
│       ├── pages/              # 頁面組件 (6 個頁面)
│       │   ├── login.tsx       # 登入頁面
│       │   ├── Dashboard.tsx   # 儀表板首頁
│       │   ├── ViolationLog.tsx # 違規日誌與詳細記錄
│       │   ├── Analytics.tsx   # 數據分析與統計圖表
│       │   ├── SystemManagement.tsx # 系統管理頁面 (管理員專用)
│       │   └── Profile.tsx     # 用戶個人資料頁面
│       ├── context/            # 全局狀態管理
│       │   └── AuthContext.tsx # JWT Token 身份驗證上下文 (useAuth Hook)
│       ├── services/           # API 服務層
│       │   └── api.ts          # ApiService 單例 (統一 HTTP 請求、自動認證)
│       ├── types/              # TypeScript 類型定義
│       │   └── index.ts        # 集中的類型定義 (Violation、Camera、ChartData 等)
│       └── styles/             # CSS 樣式文件
│           ├── variables.css   # 設計系統變量 (顏色、字體、間距)
│           ├── base.css        # 基礎樣式
│           ├── main.css        # 全局樣式
│           ├── layout.css      # 佈局樣式
│           ├── dashboard.css   # 儀表板樣式
│           ├── modal.css       # 模態框樣式
│           ├── Profile.css     # 個人資料樣式
│           └── SystemManagement.css # 系統管理樣式
│
├── detect_API/                 # 🎯 安全帽檢測服務 (Port 5001)
│   ├── Dockerfile              # 容器版檢測服務配置
│   ├── requirements.txt        # Python 依賴清單
│   ├── halbest.pt              # YOLOv8 安全帽檢測模型 (~100MB)
│   ├── helmate_detect.py       # 容器版檢測程式
│   ├── run_local.py            # 基礎本地檢測服務
│   └── run_local_optimized.py  # ⚡ 優化版本地檢測 (推薦使用)
│
├── carplate_detect_api/        # 🚗 車牌識別服務 (Port 3001)
│   ├── Dockerfile              # 車牌識別容器配置
│   ├── requirements.txt        # Python 依賴清單
│   ├── license_plate_detector.pt # 車牌識別模型檔案
│   └── run.py                  # 車牌識別 API 服務
│
└── web_api/                    # 💾 Flask 後端 API (Port 3002, 1521 LOC)
    ├── Dockerfile              # 後端容器配置
    ├── requirements.txt        # Python 依賴清單
    └── app.py                  # Flask 主應用
        ├── 身份驗證模塊        # JWT 驗證、登入/登出、密碼重設、用戶管理
        ├── 違規管理 API        # 違規查詢、狀態更新、手動標註、最新違規
        ├── 攝影機 API          # 攝影機列表、狀態查詢
        ├── 罰單生成 API        # 電子罰單生成、Email 發送 (含內嵌圖片)
        ├── 數據分析 API        # KPI、趨勢、類型分佈、地點分析、罰款收入
        ├── 系統管理 API        # 系統性能監控 (CPU、內存、磁碟、網路)
        ├── 系統日誌 API        # 審計日誌查詢、篩選、分頁
        ├── 通知系統 API        # 用戶通知、未讀計數
        └── WebSocket 實時推送  # 違規事件實時廣播
```

### 前端組件架構詳解

#### 認證與權限管理
- **AuthContext**: 全局身份驗證上下文，使用 JWT Token 管理用戶會話
- **useAuth Hook**: 所有組件可通過此 Hook 獲取當前用戶信息和角色 (admin/operator)
- **ProtectedRoute**: App.tsx 中定義，根據 Token 有效性控制訪問權限
- **角色基礎訪問控制 (RBAC)**: 某些頁面 (SystemManagement) 僅管理員可訪問

#### API 服務層
- **ApiService 單例 (services/api.ts)**:
  - 所有 HTTP 請求統一通過此服務
  - 自動在 Authorization header 中添加 JWT Token
  - 統一的錯誤處理和 401 Token 刷新邏輯
  - 支持 GET、POST、PUT、DELETE 四種 HTTP 方法

#### 數據流向
1. 用戶在 login.tsx 輸入憑證 → 調用 AuthContext.login()
2. AuthContext 調用 ApiService.post(/api/login)
3. 後端返回 JWT Token → 存儲到 localStorage
4. Token 自動解碼提取用戶信息 (使用 jwt-decode 庫)
5. 後續所有 API 請求自動帶上 Token
6. 違規面板實時監聽 Socket.io 事件 (new_violation)

## 🎯 使用流程

### 新手快速開始 (3 步驟)
```bash
# 1. 下載專案
git clone https://github.com/luhan0413/trafficAI-v2.git
cd trafficAI-v2

# 2. 一鍵啟動
./restart_system.sh

# 3. 開啟瀏覽器
open http://localhost:8080
```

### 開發者模式
```bash
# 查看系統狀態
docker ps
docker logs -f traffic_frontend

# 單獨啟動檢測服務
python3 start_detection.py

# 重啟特定容器
docker restart traffic_api_web
```

## 📈 系統架構

```
🌐 前端 (React 18)           💾 Web API (Flask)            🗄️ PostgreSQL
  - Login                    - 身份驗證 (JWT)
  - Dashboard                - 違規管理
  - ViolationLog             - 罰單生成
  - Analytics                - 系統管理
  - SystemManagement         - 審計日誌
  - Profile                  - Email (SMTP)
       ↓                           ↓
       ↔ ApiService ←──────→ /api/*** endpoints
       ↓                           ↓
 Socket.io client         Socket.io server
                               ↓
📸 本地檢測服務         ←→ 🚗 車牌 API (Docker)   ←→ 🔴 Redis
  - YOLOv8 檢測              - 車牌識別模型
  - 攝影機捕獲                - 識別結果返回
```

## 📡 API 文檔 (Flask 後端)

### 身份驗證相關

| 方法 | 端點 | 描述 | 請求體 | 返回值 |
|------|------|------|--------|-------|
| POST | `/api/register` | 註冊新用戶 (管理員專用) | `{username, email, password, name, role}` | `{message, userId}` |
| POST | `/api/login` | 用戶登入 | `{username, password}` | `{access_token}` |
| GET | `/api/profile` | 獲取當前用戶信息 (需認證) | - | `{logged_in_as}` |
| POST | `/api/forgot-password` | 發送密碼重設郵件 | `{email}` | `{message}` |
| POST | `/api/reset-password` | 重設密碼 | `{token, password}` | `{message}` |
| PUT | `/api/profile/change-password` | 修改密碼 (需認證) | `{old_password, new_password}` | `{message}` |
| POST | `/api/verify-reset-token` | 驗證重設 Token | `{token}` | `{message}` 或 `{error}` |

### 違規管理相關

| 方法 | 端點 | 描述 | 參數/請求體 | 返回值 |
|------|------|------|----------|-------|
| GET | `/api/violations` | 獲取違規記錄列表 (分頁) | `?page=1&limit=10&status=待審核&search=&type=&location=&date=` | `{data: [], pagination: {...}}` |
| GET | `/api/violations/latest` | 獲取最新 10 筆違規 | - | `[{id, type, plateNumber, timestamp, status}]` |
| PUT | `/api/violations/status` | 批量更新違規狀態 | `{ids: [], status}` | `{message, count}` |
| POST | `/api/violations/manual` | 手動標註違規 (含圖片) | `{license_plate, violation_type, violation_address, image_data, annotations}` | `{message, violation_id, fine_amount, owner_info}` |
| GET | `/api/violations/types` | 獲取所有違規類型 | - | `[{type_name}]` |
| GET | `/api/violations/manual-types` | 獲取手動標註類型及罰金 | - | `{violation_types: [...], total_types: N}` |
| GET | `/api/violations/<id>/image` | 獲取違規圖片 | - | `{success, image_data, license_plate, image_source}` |
| GET | `/api/violations/confirmed-count` | 獲取已確認違規計數 | - | `{count}` |

### 罰單相關

| 方法 | 端點 | 描述 | 參數/請求體 | 返回值 |
|------|------|------|----------|-------|
| GET | `/api/tickets/list` | 獲取罰單列表 | `?status=已確認` 或 `已開罰` | `[{id, type, plateNumber, timestamp, location}]` |
| GET | `/api/tickets/counts` | 獲取罰單統計 | - | `{pendingCount, generatedCount, totalFine}` |
| POST | `/api/violation/<id>/generate-ticket` | 生成並發送罰單 | `{ownerInfo: {...}, recipient_email}` | `{message, email_sent, violation_id}` |

### 攝影機與設備相關

| 方法 | 端點 | 描述 | 參數 | 返回值 |
|------|------|------|------|-------|
| GET | `/api/cameras/status` | 獲取攝影機狀態 | - | `[{id, name, status}]` |
| GET | `/api/cameras/list` | 獲取攝影機列表 | - | `[{camera_name}]` |
| GET | `/api/owners/<plate_number>` | 獲取車主信息 | - | `{license_plate_number, full_name, email, phone_number, address, vehicle_type, ...}` |
| GET | `/api/owners/<plate_number>/vehicle-type` | 獲取車輛類型 | - | `{license_plate_number, vehicle_type}` |

### 數據分析相關

| 方法 | 端點 | 描述 | 參數 | 返回值 |
|------|------|------|------|-------|
| GET | `/api/analytics` | 獲取分析數據 | `?time_range=last30days` (today/last7days/last30days) | `{kpi, trend, typeDistribution, locationAnalysis, efficiencyAnalysis, revenue}` |

### 系統管理相關

| 方法 | 端點 | 描述 | 參數/請求體 | 返回值 |
|------|------|------|----------|-------|
| GET | `/api/users` | 獲取用戶列表 (管理員專用) | - | `[{id, username, email, name, role, status, lastLogin}]` |
| GET | `/api/system/performance` | 獲取系統性能數據 (管理員專用) | - | `{cpu, memory, disk, network}` |
| GET | `/api/logs` | 獲取系統日誌 (管理員專用) | `?page=1&limit=20&search=&level=INFO&module=&user=&start_date=&end_date=` | `{data: [], pagination: {...}}` |

### 通知相關

| 方法 | 端點 | 描述 | 參數/請求體 | 返回值 |
|------|------|------|----------|-------|
| GET | `/api/notifications/list` | 獲取用戶通知列表 (需認證) | - | `[{id, title, message, type, priority, read, createdAt}]` |
| GET | `/api/notifications/unread-count` | 獲取未讀通知計數 (需認證) | - | `{count}` |
| POST | `/api/notifications/mark-read` | 標記通知為已讀 (需認證) | `{ids: []}` | `{message}` |

### WebSocket 事件

| 事件名 | 方向 | 描述 | 負載 |
|--------|------|------|------|
| `new_violation` | 服務器 → 客戶端 | 新違規事件廣播 | `{id, type, plateNumber, timestamp, location, status}` |
| `connect` | 連接事件 | 客戶端連接成功 | - |
| `disconnect` | 連接事件 | 客戶端斷開連接 | - |

#### 違規狀態值
- `待審核`: 初始狀態
- `已確認`: 違規確認
- `已駁回`: 違規駁回
- `已開罰`: 已生成罰單

#### 手動標註違規類型與罰金
- `違規乘載人數`: NT$1,000
- `未戴安全帽`: NT$800
- `亂丟煙蒂`: NT$600

## 📋 系統監控

系統提供詳細的性能監控功能：
- 🕐 **檢測耗時**: 實時顯示每次檢測處理時間
- 🚗 **車牌識別耗時**: API 響應時間追蹤
- 💾 **資料庫操作耗時**: 資料儲存性能監控
- 📊 **端到端處理時間**: 完整違規處理流程計時

## 🔧 進階配置

### 攝影機設定

預設使用攝影機索引 `0`，如需修改：

```python
# 在 detect_API/run_local_optimized.py 中修改
capture_source = 1  # 外接 USB 攝影機
```

### 檢測參數調整

```python
# 在 detect_API/run_local_optimized.py 中調整
CONFIDENCE_THRESHOLD = 0.65  # 違規判定信心度
VISUAL_CONFIDENCE = 0.4      # 畫面顯示信心度
DISPLAY_WIDTH = 1024         # 顯示寬度
```

### 模型權重檔連結
https://drive.google.com/drive/folders/1L3pdIyjDhIUJJqrf8NbRdtlb_L9Ph_Pq?usp=drive_link

## 🔐 安全性與認證機制

### JWT Token 認證流程

1. **登入過程**
   - 用戶提交用戶名和密碼到 `/api/login`
   - 後端驗證密碼 (使用 werkzeug 的 `check_password_hash`)
   - 生成 JWT Token（包含 username、role、name 等信息）
   - 前端接收 Token 並存儲到 localStorage

2. **Token 驗證**
   - 前端在每個 API 請求的 Authorization header 中附加 Token: `Authorization: Bearer <token>`
   - 後端使用 `@jwt_required()` 裝飾器驗證 Token 有效性
   - 無效或過期的 Token 返回 401 錯誤

3. **前端 Token 管理 (AuthContext)**
   - Token 存儲在 localStorage (key: `token`)
   - 使用 `jwt-decode` 庫解碼 Token 提取用戶信息
   - App 啟動時自動檢查 Token 有效期
   - Token 過期自動清除並重定向到登入頁面

### 權限控制

- **@admin_required() 裝飾器**: 限制某些 API 端點僅管理員可訪問
  - `/api/register` - 用戶註冊 (管理員專用)
  - `/api/users` - 用戶列表查詢 (管理員專用)
  - `/api/logs` - 系統日誌查詢 (管理員專用)
  - `/api/system/performance` - 系統性能監控 (管理員專用)

- **前端路由守衛 (ProtectedRoute)**:
  - `/system` 頁面根據 `useAuth()` 的 `isAdmin` 標誌進行訪問控制
  - 非管理員用戶訪問該頁面會被重定向

### 系統審計日誌

所有重要操作都會被記錄到 `system_logs` 表：

| 操作 | 模塊 | 級別 | 記錄的詳細信息 |
|------|------|------|-------|
| 用戶登入成功 | 使用者管理 | INFO | 用戶名、IP、時間戳 |
| 建立新用戶 | 使用者管理 | INFO | 新用戶名、角色、建立者 |
| 修改密碼 | 個人資料 | WARNING | 用戶名、修改時間 |
| 更新違規狀態 | 違規管理 | INFO | 更新的違規 ID、新狀態 |
| 手動標註違規 | 手動標註 | INFO | 車牌、違規類型、標註數量 |

日誌支持按以下條件篩選：
- 時間範圍 (start_date/end_date)
- 日誌級別 (INFO/WARNING/ERROR)
- 操作模塊
- 用戶名
- 關鍵詞搜索

## 📧 Email 罰單發送機制

### 電子罰單功能

當管理員或操作員點擊「生成罰單」按鈕時，系統執行以下步驟：

1. **數據準備**
   - 從 violations 表查詢違規記錄
   - 從 owners 表查詢車主信息
   - 從 violations 表的 image_data 字段取得違規照片

2. **HTML 罰單生成**
   - 使用 `create_email_html_body()` 函數生成 HTML 郵件
   - 包含車主基本資料、違規詳細信息、違規照片、注意事項等
   - 支援繁體中文，採用台灣時間格式 (上午/下午)

3. **郵件發送**
   - 使用 SMTP (配置在 .env) 或備用的 Flask-Mail 方式
   - 附加內嵌違規照片 (MIME multipart/related)
   - 同時包含純文字備用版本

4. **數據庫更新**
   - 將違規狀態從「已確認」更新為「已開罰」
   - 記錄到系統日誌

### 郵件設定 (.env 環境變數)

```bash
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_DEFAULT_SENDER=traffic-system@example.com
```

## 🗄️ 數據庫主要表結構

### violations 表
- `id` (PK) - 違規紀錄ID
- `violation_type` - 違規類型
- `license_plate` - 車牌號碼
- `timestamp` - 違規時間
- `violation_address` - 違規地點
- `status` - 狀態 (待審核/已確認/已駁回/已開罰)
- `confidence` - AI 識別置信度 (或「手動標注」)
- `image_data` - 違規照片 (Base64 編碼)
- `fine` - 罰金金額
- `owner_name, owner_phone, owner_email, owner_address` - 車主信息

### owners 表
- `license_plate_number` (PK) - 車牌號碼
- `full_name` - 車主姓名
- `id_number` - 身分證字號
- `gender` - 性別
- `date_of_birth` - 出生年月日
- `phone_number` - 聯絡電話
- `email` - 電子郵件
- `address` - 戶籍地址
- `vehicle_type` - 車輛類型

### users 表
- `id` (PK) - 用戶ID
- `username` - 用戶名 (唯一)
- `email` - 電子郵件 (唯一)
- `password` - 密碼雜湊值
- `name` - 用戶全名
- `role` - 角色 (admin/operator)
- `status` - 狀態 (啟用/停用)
- `lastlogin` - 最後登入時間
- `reset_token, reset_token_expires` - 密碼重設 Token

### system_logs 表
- `id` (PK) - 日誌ID
- `timestamp` - 日誌時間
- `user_id` - 用戶ID (外鍵)
- `username` - 用戶名
- `module` - 功能模塊
- `level` - 日誌級別 (INFO/WARNING/ERROR)
- `action` - 操作名稱
- `details` - 詳細描述
- `client_ip` - 請求 IP

## 🛠️ 開發指南

### 前端開發環境設置

```bash
# 進入前端目錄
cd traffic-system

# 安裝依賴
npm install

# 開發模式 (熱重載)
npm run dev

# 構建生產版本
npm run build

# 預覽生產構建
npm run preview
```

### 前端重要依賴

- **React 18** - UI 框架
- **React Router v6** - 客戶端路由
- **TypeScript** - 類型檢查
- **Vite** - 快速構建工具
- **Socket.io-client** - WebSocket 客戶端
- **jwt-decode** - JWT Token 解碼
- **Chart.js & react-chartjs-2** - 圖表繪製
- **react-icons** - 圖標庫

### 後端開發環境設置

```bash
# 進入後端目錄
cd web_api

# 創建虛擬環境
python -m venv venv
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate      # Windows

# 安裝依賴
pip install -r requirements.txt

# 運行開發服務器
python app.py
```

### 添加新的 API 端點示例

```python
from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

@app.route('/api/my-endpoint', methods=['GET', 'POST'])
@jwt_required()  # 需要認證
def my_endpoint():
    try:
        # 獲取當前用戶信息
        current_user = get_jwt_identity()

        if request.method == 'GET':
            # 查詢邏輯
            pass
        else:
            # POST 邏輯
            data = request.get_json()
            pass

        # 記錄日誌
        log_action(
            module="我的模塊",
            level="INFO",
            action="我的操作",
            details="操作詳情",
            user_identity=current_user,
            client_ip=request.remote_addr
        )

        return jsonify({'message': '成功'}), 200
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'error': '內部伺服器錯誤'}), 500
```

## 📝 已知限制與待改進項目

### 當前已知問題
1. **macOS Docker 攝影機存取** - 需要混合模式，本地運行檢測服務
2. **大規模數據集性能** - 違規列表超過 10,000 筆時可能有分頁性能問題
3. **Image Base64 編碼** - 大型照片可能導致數據庫存儲和傳輸性能下降

### 建議的改進方向
1. 實現圖片存儲優化 (使用對象存儲如 S3，而不是直接存儲 Base64)
2. 添加數據表索引優化 (timestamp, status, license_plate)
3. 實現虛擬滾動 (virtualization) 優化大列表性能
4. 添加國際化 (i18n) 支持多語言
5. 實現深色模式切換
6. 添加完整的單元測試覆蓋 (Jest、Pytest)
7. 實現更細粒度的權限控制 (RBAC)
8. 添加數據導出功能 (Excel、PDF 詳細報表)
9. 實現系統備份和恢復機制

## 🤝 貢獻指南

歡迎提交 Issue 和 Pull Request！

### 提交流程
1. Fork 本專案
2. 建立特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

### 代碼風格
- **前端**: 使用 Prettier 和 ESLint 進行代碼格式化
- **後端**: 遵循 PEP 8 Python 代碼風格
- **提交信息**: 使用中文或英文，清晰描述更改內容

## 📞 技術支援與聯繫

如有任何問題或建議，請通過以下方式聯繫：
- 提交 GitHub Issue
- 查看項目 Wiki 和文檔
- 查閱 README 中的故障排除部分

## 📄 授權條款

本專案採用 MIT License 授權。詳見 LICENSE 文件。

---

**最後更新**: 2025-11-06
**版本**: 2.0.0
**主要貢獻者**: Traffic AI 開發團隊