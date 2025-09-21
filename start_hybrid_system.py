#!/usr/bin/env python3
"""
混合模式啟動腳本
- 確保 Docker 後端服務正常運行
- 啟動本地優化的檢測服務
- 提供統一的系統管理介面
"""

import os
import sys
import time
import subprocess
import requests
import threading
from pathlib import Path

def check_docker_services():
    """檢查 Docker 服務狀態"""
    print("🔍 檢查 Docker 服務狀態...")
    
    services = {
        "前端服務": "http://localhost:8080",
        "車牌 API": "http://localhost:3001", 
        "Web API": "http://localhost:3002",
        "Redis": "localhost:6379"
    }
    
    all_healthy = True
    for name, url in services.items():
        try:
            if name == "Redis":
                # Redis 需要特殊檢查
                result = subprocess.run(['docker', 'exec', 'redis_server', 'redis-cli', 'ping'], 
                                      capture_output=True, text=True, timeout=5)
                if 'PONG' in result.stdout:
                    print(f"✅ {name}: 健康")
                else:
                    print(f"❌ {name}: 無回應")
                    all_healthy = False
            else:
                response = requests.get(url, timeout=3)
                print(f"✅ {name}: 運行中 (狀態: {response.status_code})")
        except Exception as e:
            print(f"❌ {name}: 連接失敗 - {e}")
            all_healthy = False
    
    return all_healthy

def start_local_detection():
    """啟動本地檢測服務"""
    print("\n🚀 啟動本地檢測服務...")
    detect_script = Path(__file__).parent / "detect_API" / "run_local_optimized.py"
    
    if not detect_script.exists():
        print(f"❌ 找不到檢測腳本: {detect_script}")
        return None
    
    try:
        # 在背景啟動本地檢測服務
        process = subprocess.Popen([
            sys.executable, str(detect_script)
        ], cwd=detect_script.parent)
        
        print(f"✅ 本地檢測服務已啟動 (PID: {process.pid})")
        return process
    except Exception as e:
        print(f"❌ 啟動本地檢測服務失敗: {e}")
        return None

def main():
    print("🎯 Traffic AI 混合模式啟動器")
    print("=" * 50)
    
    # 檢查 Docker 服務
    if not check_docker_services():
        print("\n❌ Docker 服務未完全就緒，請檢查容器狀態")
        print("   可以執行: docker compose up -d")
        return 1
    
    print("\n✅ 所有 Docker 服務正常運行")
    
    # 啟動本地檢測
    detection_process = start_local_detection()
    if not detection_process:
        return 1
    
    print("\n🎉 混合模式系統啟動完成！")
    print("\n📋 服務狀態:")
    print("   🌐 前端介面: http://localhost:8080")
    print("   📸 本地檢測: http://localhost:5001")
    print("   🚗 車牌識別: http://localhost:3001") 
    print("   💾 Web API: http://localhost:3002")
    
    print("\n💡 使用說明:")
    print("   1. 開啟瀏覽器訪問 http://localhost:8080")
    print("   2. 在儀表板中啟動攝影機檢測")
    print("   3. 系統會自動處理違規並即時通知")
    print("   4. 按 Ctrl+C 停止所有服務")
    
    try:
        # 保持腳本運行
        detection_process.wait()
    except KeyboardInterrupt:
        print("\n\n🛑 正在停止服務...")
        detection_process.terminate()
        detection_process.wait()
        print("✅ 服務已停止")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())