# 使用與其他 API 相同的基礎映像
FROM python:3.11-slim

# 設定工作目錄
WORKDIR /app

# 安裝可能需要的作業系統依賴 (先保留以防萬一)
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 複製套件需求檔案
COPY requirements.txt .

# 安裝 Python 套件
RUN pip install --no-cache-dir -r requirements.txt

# 複製所有程式碼到容器中
COPY . .

# 假設這個 API 在 3002 port 上執行
EXPOSE 3002


CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", "--bind", "0.0.0.0:3002", "app:app"]