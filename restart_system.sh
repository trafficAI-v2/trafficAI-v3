#!/bin/bash
# Traffic AI 系統重啟腳本

echo "🔄 Traffic AI 系統重啟中..."
echo "================================"

# 1. 停止所有容器
echo "🛑 停止現有容器..."
docker compose down

# 2. 重新啟動容器
echo "🚀 重新啟動 Docker 服務..."
docker compose up -d

# 3. 等待服務就緒
echo "⏳ 等待服務啟動..."
sleep 5

# 4. 檢查服務狀態
echo "📊 檢查服務狀態:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "✅ 系統重啟完成！"
echo ""
echo "🌐 前端介面: http://localhost:8080"
echo "📸 本地檢測: 使用 'python3 start_detection.py' 啟動"
echo "🚗 車牌識別: http://localhost:3001"
echo "💾 Web API: http://localhost:3002"
