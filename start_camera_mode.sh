#!/bin/bash

echo "⚡ 交通 AI 系統 - 性能優化啟動器"
echo "=" * 50

cd /Users/luyihan/Desktop/trafficAI_v2

echo "🛑 停止 Docker 檢測服務..."
docker compose stop api2

echo "✅ 確保其他服務運行中..."
docker compose up api1 api3 frontend -d

echo ""
echo "請選擇運行模式："
echo "1) 🚀 優化版 (推薦) - 減少卡頓、跳幀處理"
echo "2) 📹 原版 - 完整品質、所有幀處理"
echo ""
read -p "請輸入選項 (1 或 2): " choice

cd detect_API

case $choice in
    1)
        echo "🚀 啟動性能優化版..."
        python3 run_local_optimized.py
        ;;
    2)
        echo "📹 啟動原版..."
        python3 run_local.py
        ;;
    *)
        echo "❌ 無效選項，默認啟動優化版..."
        python3 run_local_optimized.py
        ;;
esac