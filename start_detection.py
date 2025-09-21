#!/usr/bin/env python3
"""
快速啟動本地檢測服務
適用於 Docker 後端服務已經運行的情況
"""

import os
import sys
import subprocess
from pathlib import Path

def main():
    print("🚀 啟動本地檢測服務...")
    
    # 切換到檢測腳本目錄
    detect_dir = Path(__file__).parent / "detect_API"
    detect_script = detect_dir / "run_local_optimized.py"
    
    if not detect_script.exists():
        print(f"❌ 找不到檢測腳本: {detect_script}")
        return 1
    
    try:
        # 啟動本地檢測服務
        subprocess.run([sys.executable, str(detect_script)], cwd=detect_dir)
        return 0
    except KeyboardInterrupt:
        print("\n✅ 檢測服務已停止")
        return 0
    except Exception as e:
        print(f"❌ 啟動失敗: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())