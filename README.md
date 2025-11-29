# Traffic AI 交通違規檢測系統

本系統為一套整合雙 YOLOv8 模型的即時交通違規檢測平台，能同步偵測「未戴安全帽」與「違規乘載」等違規行為。整體架構採混合式設計，結合本地攝影機即時偵測與 Docker 容器化後端服務，有效克服 macOS 上 Docker 無法直接存取攝影機的限制。

系統由多個模組組成，包含：React 建構的前端管理介面、Flask API 後端服務、WebSocket 即時資訊推送、PostgreSQL 資料庫記錄系統，以及完善的違規事件紀錄與日誌審計功能，是一套穩定、高效、可監管的智慧交通執法平台。

## ⚡ 系統核心功能

- 🎯 **三階段即時違規檢測**：  
  (1) 車牌定位：以 YOLOv8 偵測車牌並取得其精確位置。  
  (2) ROI 區域生成：根據車牌位置動態產生感興趣區域（ROI），作為後續行為分析範圍。  
  (3) 違規行為判斷：在 ROI 中進行安全帽佩戴檢測與乘載人數計算，辨識未戴安全帽或超載等違規行為。

- 🚗 **自動車牌識別**：整合車牌識別 API，自動記錄違規車輛資訊。

- 📊 **即時數據儲存**：使用 PostgreSQL 自動儲存違規事件、車牌、時間與相關細節。

- 🔄 **即時通知**：透過 WebSocket（Socket.io）即時推送最新違規事件。

- 👨‍💼 **完整的權限管理**：基於 JWT Token 的身分驗證，支援管理員與操作員角色。

- 🐳 **容器化部署**：使用 Docker Compose 一鍵部署所有服務。

- 🔐 **系統審計日誌**：記錄所有用戶操作，支援依模塊、級別、用戶篩選。

- 📈 **數據分析儀表板**：以圖表呈現違規趨勢、違規類型分佈、罰款統計等。

- 🎫 **電子罰單系統**：自動生成並寄送 HTML 格式罰單（含違規照片與詳細資訊）。

- 🔧 **完整的系統管理**：提供使用者 CRUD、資料庫管理、系統性能監控等功能。

##  系統架構圖
![系統架構圖](https://github.com/trafficAI-v2/trafficAI-v3/blob/ef59cac8433bf8c4f061cbad82177fd5b741a2a0/%E7%B3%BB%E7%B5%B1%E6%9E%B6%E6%A7%8B%E5%9C%96.png)

## 系統demo 影片

## 專案結構
```bash
trafficAI-v2/
├── README.md                   # 專案說明文件
├── docker-compose.yml          # Docker 編排配置
├── .env                        # 環境變數配置
├── restart_system.sh           # 系統重啟腳本
├── BADGES.md                   # 徽章/品質標記
├── CLAUDE.md                   # 互動/說明文件
├── EMAIL_SETUP.md              # 郵件服務設定指南
├── sonar-project.properties    # Sonar 靜態分析設定
├── readme.txt                  # 其他說明
├── 系統架構圖.png               # 系統架構圖
│
├── docs/                       # 文件與 API 測試
├── tests/                      # 測試目錄
│
├── carplate_detect_api/        # 車牌識別服務 (Port 3001)
│   ├── Dockerfile              # 車牌識別容器配置
│   ├── requirements.txt        # Python 依賴清單
│   ├── license_plate_detector.pt # 車牌模型
│   └── run.py                  # 車牌識別 API 服務
│
├── detect_API/                 # 本地偵測服務 (Port 5001)
│   ├── requirements.txt        # Python 依賴清單
│   ├── run_local_optimized.py  # 優化版本地偵測（推薦）
│   ├── halbest.pt              # 安全帽偵測模型
│   ├── motorcycle-best.pt      # 機車偵測模型
│   ├── license_plate_detector.pt # 車牌模型（本地用）
│   └── __pycache__/            # Python 編譯快取
│
├── traffic-system/             # 前端 React (Port 8080)
│   ├── Dockerfile              # 前端容器配置
│   ├── nginx.conf              # Nginx 反向代理設定
│   ├── index.html              # 前端入口 HTML
│   ├── package.json            # 前端依賴管理
│   ├── package-lock.json
│   ├── eslint.config.js        # 程式碼規範
│   ├── postcss.config.js       # PostCSS 設定
│   ├── tailwind.config.js      # Tailwind 設定
│   ├── tsconfig.json           # TypeScript 設定
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts          # Vite 構建設定
│   ├── .env.local              # 前端本地環境變數
│   ├── env.local.txt           # 範例環境配置
│   └── src/                    # React 源碼
│       ├── App.tsx             # 路由與守衛
│       ├── main.tsx            # 入口（AuthProvider、Router）
│       ├── vite-env.d.ts       # Vite 型別宣告
│       ├── assets/             # 靜態資源
│       ├── components/         # UI 組件
│       │   ├── common/         # 通用（Modal、ErrorBoundary）
│       │   ├── layout/         # 佈局（Header、Layout）
│       │   ├── dashboard/      # 儀表板（StatusCard、ViolationPanel、CameraFeed）
│       │   ├── violations/     # 違規處理（GenerateTickets、TicketGenerationModal）
│       │   └── system/         # 系統管理（AddUserForm、SystemSettings、DatabaseManagement 等）
│       ├── pages/              # 頁面
│       │   ├── login.tsx
│       │   ├── Dashboard.tsx
│       │   ├── ViolationLog.tsx
│       │   ├── Analytics.tsx
│       │   ├── SystemManagement.tsx
│       │   └── Profile.tsx
│       ├── context/            # 全域狀態
│       │   └── AuthContext.tsx # JWT 驗證上下文
│       ├── services/           # API 服務層
│       │   └── api.ts          # ApiService 單例
│       ├── types/              # 型別定義
│       │   └── index.ts
│       └── styles/             # 樣式
│           ├── variables.css
│           ├── base.css
│           ├── main.css
│           ├── layout.css
│           ├── dashboard.css
│           ├── modal.css
│           ├── Profile.css
│           └── SystemManagement.css
│
└── web_api/                    # Flask 後端 API (Port 3002)
    ├── Dockerfile              # 後端容器配置
    ├── requirements.txt        # Python 依賴清單
    ├── .env.example            # 後端環境變數範例
    ├── app.py                  # Flask 主應用
    └── __pycache__/            # Python 編譯快取
```

## 使用流程
### 1. 環境需求
- **macOS** (推薦) 或 Linux
- **Python 3.11+**
- **Docker** 和 **Docker Compose**
- **攝影機** (內建或外接 USB 攝影機)

### 2. 下載專案
```bash
git clone https://github.com/luhan0413/trafficAI-v2.git
cd trafficAI-v2
```
### 3. 自動化啟動
```bash
./restart_system.sh
```
此腳本會自動：
- 清除舊容器
- 編譯前端
- 啟動後端
- 啟動資料庫
- 測試 WebSocket 連線

### 4. 開啟瀏覽器
open http://localhost:8080


## 模型權重檔連結
https://drive.google.com/drive/folders/1L3pdIyjDhIUJJqrf8NbRdtlb_L9Ph_Pq?usp=drive_link

## 技術支援與聯繫
如有任何問題或建議，請通過以下方式聯繫：
- 提交 GitHub Issue
- 信箱： yxxx2176@gmail.com

---
**最後更新**: 2025-11-30
**版本**: 2.0.0
**主要貢獻者**: Traffic AI 開發團隊(陳永翔、呂依涵、楊翔宇)
