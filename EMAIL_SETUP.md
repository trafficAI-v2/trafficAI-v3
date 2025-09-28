# Email功能設定指南

## 環境變數設定

請在 `web_api/` 目錄下創建 `.env` 檔案，並設定以下環境變數：

```env
# Mail設定 - Gmail範例
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_DEFAULT_SENDER=your-email@gmail.com
```

## Gmail設定步驟

1. **啟用二階段驗證**：
   - 前往 Google帳戶設定
   - 啟用二階段驗證

2. **產生應用程式密碼**：
   - 前往 Google帳戶 → 安全性 → 應用程式密碼
   - 選擇「郵件」和你的裝置
   - 複製產生的16位數密碼
   - 將此密碼設定為 `MAIL_PASSWORD`

3. **其他郵件服務設定**：

### Outlook/Hotmail
```env
MAIL_SERVER=smtp-mail.outlook.com
MAIL_PORT=587
MAIL_USE_TLS=True
```

### Yahoo Mail
```env
MAIL_SERVER=smtp.mail.yahoo.com
MAIL_PORT=587
MAIL_USE_TLS=True
```

## 測試email功能

設定完成後，重啟後端服務：
```bash
cd web_api
python3 app.py
```

當按下「確認發送」時，系統會：
1. 更新違規狀態為「已開罰」
2. 發送電子罰單到車主email
3. 顯示發送結果訊息