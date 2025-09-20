# 使用官方 Python 基礎映像
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 設定工作目錄
WORKDIR /app

# 複製 requirements.txt
COPY requirements.txt .

# 安裝 Python 套件
RUN pip install --timeout=600 --no-cache-dir -r requirements.txt

# 複製所有程式碼到容器
COPY . .

# 設定 Flask 執行環境
ENV FLASK_APP=app.py
ENV FLASK_RUN_HOST=0.0.0.0
ENV FLASK_RUN_PORT=3001

# 開放 3001 port
EXPOSE 3001

# 啟動 Flask API
CMD ["python", "run.py"]