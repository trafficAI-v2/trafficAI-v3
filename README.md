初次使用：
```bash
docker compose up --build
```
🔄 重新啟動系統的方法
1. 一般重新啟動（推薦）
這是最常用的方法，會使用已經建構好的映像檔快速啟動。
```bsh
docker compose up -d
```

3. 如果你修改了程式碼，需要重新建構
這會重新建構映像檔然後啟動，適合在修改程式碼後使用。
```bash
docker compose up --build -d
```
