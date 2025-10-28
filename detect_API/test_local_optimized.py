# detect_API/test_local_optimized.py (完整版)

import unittest
from unittest.mock import patch, MagicMock
import json
import os
import sys
from datetime import datetime

# 為了讓測試檔案能找到主應用程式 app.py (在上一層目錄)，
# 我們需要將專案的根目錄加入到 Python 的搜尋路徑中。
# 這是 Python 專案中撰寫測試時的標準做法。
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '..'))
sys.path.insert(0, project_root)

# 現在我們可以安全地從 detect_API 目錄中引入 run_local_optimized 這個模組
# 我們將它命名為 main_app 以方便後續使用
from detect_API import run_local_optimized as main_app

class LocalDetectionAPITestCase(unittest.TestCase):
    """
    本地偵測服務 (run_local_optimized.py) 的單元測試案例。
    """

    def setUp(self):
        """在每個測試函式執行前，都會執行的設定工作。"""
        # 將 Flask app 設定為測試模式，這樣可以捕捉到更詳細的錯誤，且不會真的啟動伺服器
        main_app.app.config['TESTING'] = True
        # 建立一個測試客戶端 (Test Client)，用來模擬瀏覽器或 Postman 發送 API 請求
        self.client = main_app.app.test_client()

        # --- 設定測試用的環境變數 ---
        # 為了讓測試可以獨立運行，我們不使用真實的模型路徑，而是設定假路徑
        main_app.PERSON_MODEL_PATH = 'fake_person_model.pt'
        main_app.PLATE_MODEL_PATH = 'fake_plate_model.pt'
        
        # 建立假的 YOLO 模型檔案，以通過啟動時 os.path.exists() 的檢查
        with open(main_app.PERSON_MODEL_PATH, 'w') as f:
            f.write('fake model data')
        with open(main_app.PLATE_MODEL_PATH, 'w') as f:
            f.write('fake model data')

    def tearDown(self):
        """在每個測試函式執行後，都會執行的清理工作。"""
        # 移除在 setUp 中建立的假模型檔案，保持測試環境的乾淨
        if os.path.exists(main_app.PERSON_MODEL_PATH):
            os.remove(main_app.PERSON_MODEL_PATH)
        if os.path.exists(main_app.PLATE_MODEL_PATH):
            os.remove(main_app.PLATE_MODEL_PATH)

    # =======================================================
    # == 測試分類 1: Flask API 端點測試 ==
    # =======================================================

    # @patch 是一個強大的「裝飾器」，它會暫時用一個「模擬物件 (Mock)」取代真實的函式或類別
    # 這樣我們就可以在不實際載入耗時的模型或硬體的情況下進行測試
    @patch('detect_API.run_local_optimized.YOLO')
    @patch('detect_API.run_local_optimized.cv2.VideoCapture')
    def test_101_start_detection_success(self, mock_videocapture, mock_yolo):
        """
        測試案例 1.1: 成功啟動偵測
        驗證：使用有效的攝影機路徑，/start_detection API 應回傳成功。
        """
        print("\n[測試] 1.1: 成功啟動偵測")
        
        # 設定模擬物件的行為
        mock_videocapture.return_value.isOpened.return_value = True # 假裝攝影機已成功開啟
        mock_yolo.return_value = MagicMock() # 假裝 YOLO 模型已成功載入

        # 使用測試客戶端模擬發送一個 POST 請求到 /start_detection
        response = self.client.post('/start_detection', 
                                    data=json.dumps({'video_path': '0'}),
                                    content_type='application/json')
        
        # 斷言 (Assert) 檢查結果是否符合預期
        self.assertEqual(response.status_code, 200) # 斷言 HTTP 狀態碼為 200
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'success') # 斷言回應的 JSON 中 status 為 success
        
        # 驗證全域變數是否被正確設定
        self.assertFalse(main_app.stop_detection_flag)
        
        # 測試結束後，呼叫 /stop_detection 來清理執行緒，避免影響下一個測試
        self.client.post('/stop_detection')

    def test_102_get_status_when_stopped(self):
        """
        測試案例 1.2: 獲取停止狀態
        驗證：在未啟動偵測時，/status API 應回傳 'stopped'。
        """
        print("[測試] 1.2: 獲取停止狀態")
        response = self.client.get('/status')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'stopped')

    # =======================================================
    # == 測試分類 2: 核心邏輯函式測試 ==
    # =======================================================
    
    @patch('detect_API.run_local_optimized.call_lpr_api')
    @patch('detect_API.run_local_optimized.save_to_database')
    @patch('detect_API.run_local_optimized.notify_violation')
    @patch('detect_API.run_local_optimized.cv2.imwrite')
    def test_201_process_multiple_violations_logic(self, mock_imwrite, mock_notify, mock_save_db, mock_lpr_api):
        """
        測試案例 2.1: 處理複合式違規的邏輯
        驗證：當 process_multiple_violations 函式被呼叫時，
              是否能正確地呼叫車牌辨識、資料庫儲存和通知函式。
        """
        print("\n[測試] 2.1: 處理複合式違規邏輯")

        # --- 準備階段 (Arrange) ---
        # 1. 建立一個假的截圖影像 (MagicMock 是一個萬用的模擬物件)
        fake_crop_img = MagicMock()
        
        # 2. 建立一個假的違規列表，模擬同時偵測到「三貼超載」和「未戴安全帽」
        fake_violations_list = [
            {'type': '違規乘載人數', 'fine': 1000, 'confidence': 0.95},
            {'type': '未戴安全帽', 'fine': 800, 'confidence': 0.88}
        ]

        # 3. 設定模擬函式的回傳值
        mock_lpr_api.return_value = {'license_plate_number': 'TEST-123'}
        mock_save_db.return_value = {'id': 999, 'type': '測試違規', 'plateNumber': 'TEST-123', 'timestamp': '...'}
        
        # --- 執行階段 (Act) ---
        # 直接呼叫我們要測試的函式
        main_app.process_multiple_violations(fake_crop_img, fake_violations_list)
        
        # --- 斷言階段 (Assert) ---
        # 1. 驗證 call_lpr_api 是否剛好被呼叫了 1 次
        mock_lpr_api.assert_called_once()
        
        # 2. 驗證 cv2.imwrite (儲存圖片) 是否剛好被呼叫了 1 次
        mock_imwrite.assert_called_once()
        
        # 3. 驗證 save_to_database 是否被呼叫了 2 次 (因為有兩種違規)
        self.assertEqual(mock_save_db.call_count, 2)
        
        # 4. 驗證 notify_violation 是否也被呼叫了 2 次
        self.assertEqual(mock_notify.call_count, 2)

        # 5. [進階] 驗證呼叫 save_to_database 時的參數是否正確
        first_call_args, second_call_args = mock_save_db.call_args_list
        
        # 檢查第一次呼叫時，傳入的違規類型和信心度
        self.assertEqual(first_call_args.args[2], '違規乘載人數')
        self.assertEqual(first_call_args.args[4], 0.95)
        
        # 檢查第二次呼叫時，傳入的罰款金額和信心度
        self.assertEqual(second_call_args.args[3], 800)
        self.assertEqual(second_call_args.args[4], 0.88)

# =======================================================
# == 測試啟動器 ==
# =======================================================
if __name__ == '__main__':
    # 這段程式碼讓我們可以直接執行 `python3 test_local_optimized.py` 來啟動測試
    unittest.main()