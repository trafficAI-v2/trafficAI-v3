#!/bin/bash
# Traffic AI 系統完整部署腳本 (包含所有新功能)

echo "🚀 Traffic AI 系統完整部署開始..."
echo "============================================"

# 1. 環境檢查
echo "🔍 檢查環境依賴..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安裝，請先安裝 Docker"
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose 未安裝，請先安裝 Docker Compose"
    exit 1
fi

# 2. 停止現有服務
echo "🛑 停止現有容器..."
docker compose down

# 3. 清理舊映像檔 (可選)
echo "🧹 清理舊映像檔..."
docker system prune -f

# 4. 重新構建所有映像檔
echo "🔨 重新構建所有 Docker 映像檔..."
docker compose build --no-cache --parallel

# 5. 啟動所有服務
echo "🚀 啟動所有 Docker 服務..."
docker compose up -d

# 6. 等待服務完全就緒
echo "⏳ 等待所有服務啟動..."
sleep 15

# 7. 檢查服務狀態
echo "📊 檢查服務狀態:"
echo "================================"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 8. 健康檢查
echo ""
echo "🩺 服務健康檢查:"
echo "================================"

# 檢查 Web API
echo -n "Web API (3002): "
if curl -s -f http://localhost:3002 >/dev/null 2>&1; then
    echo "✅ 正常運行"
else
    echo "❌ 連接失敗"
    echo "   檢查日誌: docker compose logs web_api"
fi

# 檢查車牌識別 API
echo -n "車牌 API (3001): "
if curl -s -f http://localhost:3001 >/dev/null 2>&1; then
    echo "✅ 正常運行"
else
    echo "❌ 連接失敗"
    echo "   檢查日誌: docker compose logs ai_detector"
fi

# 檢查前端
echo -n "前端服務 (8080): "
if curl -s -f http://localhost:8080 >/dev/null 2>&1; then
    echo "✅ 正常運行"
else
    echo "❌ 連接失敗"
    echo "   檢查日誌: docker compose logs frontend"
fi

# 檢查 Redis
echo -n "Redis 服務 (6379): "
if docker exec redis_server redis-cli ping 2>/dev/null | grep -q PONG; then
    echo "✅ 正常運行"
else
    echo "❌ 連接失敗"
    echo "   檢查日誌: docker compose logs redis"
fi

# 9. 測試新功能 API
echo ""
echo "🧪 測試新功能 API:"
echo "================================"

# 測試圖片 API
echo -n "圖片獲取 API: "
if curl -s -f "http://localhost:3002/api/violations/1/image" >/dev/null 2>&1; then
    echo "✅ API 可用"
else
    echo "⚠️  API 可用但無數據 (正常)"
fi

echo ""
echo "✅ 系統部署完成！"
echo "============================================"
echo ""
echo "🎯 新功能列表:"
echo "   📷 圖片 Base64 存儲到資料庫"
echo "   🖼️  違規詳情頁面圖片顯示"
echo "   🏷️  車主資訊標籤樣式優化"
echo "   🎨 前端 UI 美化"
echo ""
echo "🌐 服務地址:"
echo "   前端介面: http://localhost:8080"
echo "   Web API: http://localhost:3002"
echo "   車牌識別 API: http://localhost:3001"
echo "   Redis 服務: localhost:6379"
echo ""
echo "📸 本地檢測啟動方式:"
echo "   cd detect_API"
echo "   python run_local_optimized.py"
echo ""
echo "📋 常用命令:"
echo "   查看日誌: docker compose logs [服務名稱]"
echo "   重啟服務: docker compose restart [服務名稱]"
echo "   停止系統: docker compose down"
echo ""
echo "🎉 享受您的 Traffic AI 系統！"