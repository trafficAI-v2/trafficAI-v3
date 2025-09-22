import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  BiArrowBack, BiSearch, BiDownload, BiReceipt, BiErrorCircle, BiCheckCircle 
} from 'react-icons/bi';
import { FaExclamationTriangle, FaFileInvoiceDollar } from 'react-icons/fa';
import './GenerateTickets.css';

// --- API Endpoints ---
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
// 這是唯一需要從後端 "GET" 的資料列表
const CONFIRMED_VIOLATIONS_URL = `${API_BASE_URL}/api/violations/confirmed`;

// --- 型別定義 ---
interface Violation {
  id: number;
  type: string;
  plateNumber: string;
  timestamp: string;
  location: string;
  confidence: number;
}

const GenerateTickets: React.FC = () => {
  // --- 狀態管理 ---
  const [activeTab, setActiveTab] = useState<'pending' | 'generated'>('pending');
  const [pendingList, setPendingList] = useState<Violation[]>([]);
  const [generatedList, setGeneratedList] = useState<Violation[]>([]); // 在本地客戶端維護已生成的列表
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- 資料獲取邏輯 (只獲取待處理列表) ---
  const fetchPendingViolations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(CONFIRMED_VIOLATIONS_URL);
      if (!response.ok) {
        throw new Error('無法獲取待處理罰單列表');
      }
      const data: Violation[] = await response.json();
      setPendingList(data);
    } catch (err: any) {
      setError(err.message);
      console.error("獲取資料失敗:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (isoString: string): { date: string, time: string } => {
    if (!isoString) return { date: 'N/A', time: '' };
    try {
      const dateObj = new Date(isoString);
      const date = `${dateObj.getFullYear()}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')}`;
      const hours = dateObj.getHours();
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      const seconds = String(dateObj.getSeconds()).padStart(2, '0');
      const ampm = hours >= 12 ? '下午' : '上午';
      const displayHours = hours % 12 || 12;
      const time = `${ampm} ${displayHours}:${minutes}:${seconds}`;
      return { date, time };
    } catch (e) {
      console.error("無法解析時間戳字串:", isoString, e);
      return { date: '無效日期', time: '' };
    }
  };

  useEffect(() => {
    fetchPendingViolations();
  }, []);

  // --- 【核心修改】事件處理函式 ---
  const handleGenerateTicket = async (violationToGenerate: Violation) => {
    try {
      // 1. 呼叫後端 API，真正執行生成動作
      const response = await fetch(`${API_BASE_URL}/api/violation/${violationToGenerate.id}/generate-ticket`, {
        method: 'POST',
      });

      // 2. 檢查後端是否回報成功
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '後端生成罰單失敗');
      }

      // 3. 後端成功後，才更新前端的狀態
      alert(`VIO-${violationToGenerate.id} 的罰單已成功在伺服器生成！`);
      
      // 從「待生成」列表中移除
      setPendingList(prevList => prevList.filter(v => v.id !== violationToGenerate.id));
      
      // 將該項目加入到「已生成」列表
      setGeneratedList(prevList => [violationToGenerate, ...prevList]);

    } catch (err: any) {
      // 如果過程中發生任何錯誤，顯示錯誤訊息，UI 不會變動
      alert(`操作失敗: ${err.message}`);
      console.error("生成罰單時發生錯誤:", err);
    }
  };
  
  // --- 根據當前頁籤決定要顯示哪個列表 ---
  const sourceList = activeTab === 'pending' ? pendingList : generatedList;
  const filteredList = sourceList.filter(v => 
    `VIO-${v.id}`.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.plateNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const pendingCount = pendingList.length;
  const generatedCount = generatedList.length;
  const estimatedFine = pendingCount * 2400;

  return (
    <div className="generate-tickets-page">
      <div className="page-header-container">
        <div>
            <h1>產生罰單專區</h1>
            <p>統一管理已確認違規，單獨生成罰單並發送通知</p>
        </div>
        <Link to="/violations" className="back-link">
          <BiArrowBack /> 返回違規管理
        </Link>
      </div>

      <div className="stats-grid">
        <div className="stat-box pending">
          <div className="stat-content">
            <span className="stat-label">待生成罰單</span>
            <span className="stat-value">{pendingCount}</span>
          </div>
          <FaExclamationTriangle className="stat-icon" />
        </div>
        <div className="stat-box generated">
          <div className="stat-content">
            <span className="stat-label">已生成罰單</span>
            <span className="stat-value">{generatedCount}</span>
          </div>
          <BiCheckCircle className="stat-icon" />
        </div>
        <div className="stat-box fine">
          <div className="stat-content">
            <span className="stat-label">預估罰鍰</span>
            <span className="stat-value">NT$ {estimatedFine.toLocaleString()}</span>
          </div>
          <FaFileInvoiceDollar className="stat-icon" />
        </div>
      </div>

      <div className="log-container-card">
        <div className="toolbar">
            <div className="search-bar-container">
                <BiSearch className="search-icon"/>
                <input 
                    type="text" 
                    placeholder="搜尋違規ID或車牌號碼"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>
        <div className="log-tabs">
            <button 
              className={`log-tab-button ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
                <FaExclamationTriangle /> 待生成的罰單 ({pendingCount})
            </button>
            <button 
              className={`log-tab-button ${activeTab === 'generated' ? 'active' : ''}`}
              onClick={() => setActiveTab('generated')}
            >
                <BiCheckCircle /> 已生成的罰單 ({generatedCount})
            </button>
        </div>

        <div className="violation-list-container">
          <div className="list-header">
            <div className="header-cell h-id">違規ID</div>
            <div className="header-cell h-plate">車牌號碼</div>
            <div className="header-cell h-type">違規類型</div>
            <div className="header-cell h-time">時間</div>
            <div className="header-cell h-location">地點</div>
            <div className="header-cell h-action">操作</div>
          </div>
          <div className="list-body">
            {loading ? <div className="table-message">正在載入...</div> :
             error ? <div className="table-message error">{error}</div> :
             filteredList.length === 0 ? <div className="table-message">沒有資料</div> :
             filteredList.map(v => {
               const { date, time } = formatTimestamp(v.timestamp);
               return (
                <div key={v.id} className="violation-card">
                  <div className="card-cell c-id"><div className="cell-content-vertical"><span className="main-info">VIO-{v.id}</span><span className="sub-info confidence">{v.confidence}%</span></div></div>
                  <div className="card-cell c-plate"><div className="cell-content-vertical"><span className="main-info">{v.plateNumber}</span><span className="sub-info">小客車</span></div></div>
                  <div className="card-cell c-type"><span className="type-tag">{v.type}</span></div>
                  <div className="card-cell c-time"><div className="cell-content-vertical"><span className="main-info">{date}</span><span className="sub-info">{time}</span></div></div>
                  <div className="card-cell c-location">{v.location}</div>
                  
                  <div className="card-cell c-action">
                    {activeTab === 'pending' ? (
                      <button className="generate-btn" onClick={() => handleGenerateTicket(v)}>
                        <BiReceipt /> 生成罰單
                      </button>
                    ) : (
                      <span className="status-pill issued">已開罰</span>
                    )}
                  </div>
                </div>
               );
             })
            }
          </div>
        </div>

        <div className="log-footer">
            <span>顯示 {filteredList.length} 筆紀錄</span>
            <button className="export-button">
                <BiDownload /> 匯出紀錄
            </button>
        </div>
      </div>
    </div>
  );
};

export default GenerateTickets;