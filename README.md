1. 建立docker並啟動所有服務
   ```bash
   docker-compose up --build -d
   ```
3. cd 到 detect_API
   ```bash
   cd detect_API
   ```
4. 開啟攝影機偵測 => 打開Terminal 輸入：
   ```bash
   python run_local_optimized.py
   ```

運作網址：
```bash
http://localhost:8080/
```

**Port 對應**
```bash
| 服務名稱               | Port | 描述               |
| --------------------- -| ---- | ------------------|
| traffic-system (前端)  | 8080 | React 前端介面    |
| detect\_API           | 5001 | 安全帽違規偵測 API  |
| carplate\_detect\_api | 3001 | 車牌識別 API       |
| web\_api              | 3002 | 後端 Flask API     |

```


## 📂 專案結構

```bash
trafficAI_v2/
├── README.md                 # 專案說明
├── docker-compose.yml        # Docker 編排
├── .env                      # 環境變數
├── start_local_mode.sh       # 本地模式啟動
├── start_camera_mode.sh      # 攝影機模式啟動
│
├── traffic-system/           # React 前端 (Port 8080)
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── public/
│   └── src/                  # React 程式碼
│       ├── App.tsx
│       ├── main.tsx
│       ├── components/       # 組件
│       ├── pages/            # 頁面
│       ├── styles/           # 樣式
│       └── types/            # 類型定義
│
├── detect_API/               # 安全帽偵測 API (Port 5001)
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── halbest.pt
│   ├── helmate_detect.py
│   ├── run_local.py
│   └── run_local_optimized.py
│
├── carplate_detect_api/      # 車牌識別 API (Port 3001)
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── license_plate_detector.pt
│   └── run.py
│
└── web_api/                  # Flask Web 後端 API (Port 3002) 所有有關違規資料的處理API都寫在app.py裡
    ├── Dockerfile
    ├── requirements.txt
    └── app.py


   
