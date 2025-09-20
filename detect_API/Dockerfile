# 使用官方 Python 基礎映像
FROM python:3.11-slim

# 安裝必要的系統套件（如 OpenCV 依賴）
RUN apt-get update && apt-get install -y libgl1 libglib2.0-0 curl && rm -rf /var/lib/apt/lists/*

# 設定工作目錄
WORKDIR /app

# 複製 requirements.txt
COPY requirements.txt .

# 安裝 Python 套件
RUN pip install --no-cache-dir -r requirements.txt

# 複製所有程式碼到容器
COPY . .

# 開放 5001 port
EXPOSE 5001

# 啟動 Flask API（假設主程式為 helmate_detect.py）
CMD ["python", "helmate_detect.py"]