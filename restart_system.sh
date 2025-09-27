#!/bin/bash
# Traffic AI 系統重啟腳本 (包含圖片存儲功能)

echo "🔄 Traffic AI 系統重啟中..."
echo "================================"

# 1. 停止所有容器
echo "🛑 停止現有容器..."
docker compose down

# 2. 重新構建並啟動容器 (確保新功能生效)
echo "� 重新構建 Docker 映像檔..."
docker compose build --no-cache

echo "�🚀 重新啟動 Docker 服務..."
docker compose up -d

# 3. 等待服務就緒
echo "⏳ 等待服務啟動..."
sleep 10

# 4. 檢查服務狀態
echo "📊 檢查服務狀態:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 5. 檢查網路連通性
echo ""
echo "🔍 檢查 API 服務連通性:"
echo -n "Web API (3002): "
if curl -s -f http://localhost:3002 >/dev/null 2>&1; then
    echo "✅ 正常"
else
    echo "❌ 連接失敗"
fi

echo -n "車牌 API (3001): "
if curl -s -f http://localhost:3001 >/dev/null 2>&1; then
    echo "✅ 正常"
else
    echo "❌ 連接失敗"
fi

echo ""
echo "✅ 系統重啟完成！"
echo ""
echo "🎯 新功能已部署:"
echo "   � 圖片 Base64 存儲功能"
echo "   🎨 違規詳情頁面圖片顯示"
echo "   🏷️  車主資訊標籤樣式優化"
echo ""
echo "🌐 服務地址:"
echo "   前端介面: http://localhost:8080"
echo "   Web API: http://localhost:3002"
echo "   車牌識別 API: http://localhost:3001"
echo "   Redis 服務: localhost:6379"
echo ""
echo "📸 本地檢測啟動方式:"
echo "   cd detect_API && python run_local_optimized.py"
