# web_api/Dockerfile (開發模式優化版)

# 使用標準的 Python 3.11 映像
FROM python:3.11-slim

# --- 環境變數 ---
# 告訴 Flask 框架我們的應用程式入口和運行環境
# FLASK_ENV=development 會啟用偵錯模式和自動重載
ENV FLASK_APP=app.py
ENV FLASK_ENV=development
# 讓 Python 的輸出直接打印到終端，而不是緩存起來
ENV PYTHONUNBUFFERED=1

# --- 系統依賴 ---
# 安裝 OpenCV 等圖形函式庫可能需要的系統級依賴
# 保留此部分以支持未來可能的擴充
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# --- Python 依賴安裝 (Docker 快取優化) ---
# 1. 設定工作目錄
WORKDIR /app
# 2. 僅複製依賴清單檔案
COPY requirements.txt .
# 3. 安裝依賴。由於 requirements.txt 不常變動，這一步會被 Docker 快取，
#    從而極大地加速後續僅修改程式碼時的建置速度。
RUN pip install --no-cache-dir -r requirements.txt

# --- 程式碼複製與啟動 ---
# 複製專案中的所有程式碼到工作目錄
COPY . .

# 聲明容器將會監聽的端口
EXPOSE 3002

# 【核心】使用 Flask 內建的開發伺服器啟動應用程式
# --host=0.0.0.0 讓容器外部可以訪問
# --port=3002 指定端口
# --debug 啟用自動重載和詳細的錯誤頁面，極大提升開發效率
CMD ["flask", "run", "--host=0.0.0.0", "--port=3002", "--debug"]