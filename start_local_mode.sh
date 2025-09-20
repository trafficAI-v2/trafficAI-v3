#!/bin/bash

echo "🎬 交通 AI 系統 - 本地運行模式設置"
echo "=" * 50

# 檢查是否有 Python 3
if ! command -v python3 &> /dev/null; then
    echo "❌ 錯誤：未找到 Python 3"
    echo "請先安裝 Python 3：brew install python"
    exit 1
fi

echo "✅ Python 3 已安裝: $(python3 --version)"

# 檢查是否有 pip
if ! command -v pip3 &> /dev/null; then
    echo "❌ 錯誤：未找到 pip3"
    echo "請先安裝 pip3"
    exit 1
fi

echo "✅ pip3 已安裝"

# 安裝必要的套件
echo "📦 正在安裝必要的 Python 套件..."
echo "這可能需要幾分鐘時間..."

pip3 install opencv-python ultralytics flask flask-cors python-dotenv requests psycopg2-binary

if [ $? -eq 0 ]; then
    echo "✅ 所有套件安裝完成"
else
    echo "❌ 套件安裝失敗"
    echo "請手動執行：pip3 install opencv-python ultralytics flask flask-cors python-dotenv requests psycopg2-binary"
    exit 1
fi

# 檢查模型檔案
if [ ! -f "halbest.pt" ]; then
    echo "❌ 錯誤：找不到模型檔案 halbest.pt"
    echo "請確保 halbest.pt 檔案在當前目錄中"
    exit 1
fi

echo "✅ 模型檔案存在"

# 停止 Docker 中的 api2 容器以避免端口衝突
echo "🛑 停止 Docker 中的檢測 API 以避免端口衝突..."
cd ..
docker compose stop api2

echo ""
echo "🚀 準備啟動本地模式..."
echo "📱 前端仍可訪問: http://localhost:8080"
echo "🔧 檢測 API 將在本地運行: http://localhost:5001"
echo ""
echo "按 Enter 鍵啟動，或 Ctrl+C 取消..."
read

cd detect_API
python3 run_local.py