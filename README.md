# Traffic AI 交通違規檢測系統

基於 YOLO 的即時交通違規檢測系統，專門檢測未戴安全帽的違規行為。採用混合架構設計，結合 Docker 容器化後端服務與本地攝影機檢測，完美解決 macOS Docker 攝影機存取限制。

## ⚡ 核心特性

- 🎯 **即時違規檢測**: YOLOv8 模型高精度識別未戴安全帽
- 🚗 **自動車牌識別**: 整合車牌識別 API 自動記錄違規車輛
- 📊 **即時數據儲存**: PostgreSQL 資料庫自動記錄違規資訊
- 🌐 **現代化前端**: React + TypeScript 響應式管理介面
- 🔄 **即時通知**: WebSocket 即時推送違規事件
- 🐳 **容器化部署**: Docker Compose 一鍵部署
- 🍎 **macOS 相容**: 混合模式完美支援 macOS 攝影機存取

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
# 完整系統重啟
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
docker compose up -d

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
trafficAI_v2/
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
│   └── src/                    # React 源代碼
│       ├── App.tsx             # 主應用組件
│       ├── main.tsx            # 應用程式入口
│       ├── components/         # UI 組件目錄
│       │   ├── analytics/      # 數據分析組件
│       │   ├── dashboard/      # 儀表板組件
│       │   └── layout/         # 版面配置組件
│       ├── pages/              # 頁面組件
│       ├── styles/             # 樣式文件
│       └── types/              # TypeScript 類型定義
│
├── detect_API/                 # 🎯 安全帽檢測服務 (Port 5001)
│   ├── Dockerfile              # 容器版檢測服務配置
│   ├── requirements.txt        # Python 依賴清單
│   ├── halbest.pt              # YOLOv8 安全帽檢測模型
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
└── web_api/                    # 💾 Flask 後端 API (Port 3002)
    ├── Dockerfile              # 後端容器配置
    ├── requirements.txt        # Python 依賴清單
    └── app.py                  # Flask 主應用 (處理所有違規資料 API)
```

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
🌐 前端 (React)     ←→ 💾 Web API (Flask)     ←→ 🗄️ PostgreSQL
    ↓                      ↓                        
📸 本地檢測服務     ←→ 🚗 車牌 API (Docker)   ←→ ⚡ Redis
```

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

   
