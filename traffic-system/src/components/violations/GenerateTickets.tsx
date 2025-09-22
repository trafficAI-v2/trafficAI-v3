import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  BiArrowBack, BiSearch, BiDownload, BiReceipt, BiErrorCircle, BiCheckCircle 
} from 'react-icons/bi';
import { FaExclamationTriangle, FaFileInvoiceDollar } from 'react-icons/fa';
import './GenerateTickets.css';

// --- API Endpoints ---
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// 指向新的「罰單列表」專用 API
const getViolationsByStatusURL = (status: string) => 
  `${API_BASE_URL}/api/tickets/list?status=${encodeURIComponent(status)}`;

// 指向新的「罰單統計」專用 API
const GET_COUNTS_URL = `${API_BASE_URL}/api/tickets/counts`;


// --- 型別定義 ---
interface Violation {
  id: number;
  type: string;
  plateNumber: string;
  timestamp: string;
  location: string;
}

interface ViolationCounts {
  pendingCount: number;
  generatedCount: number;
  totalFine: number;
}

const GenerateTickets: React.FC = () => {
  // --- 狀態管理 (State) ---
  const [activeTab, setActiveTab] = useState<'pending' | 'generated'>('pending');
  const [violations, setViolations] = useState<Violation[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [totalFine, setTotalFine] = useState(0);
  
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- 資料獲取邏輯 ---

  const fetchCounts = async () => {
    try {
      const response = await fetch(GET_COUNTS_URL);
      if (!response.ok) return; // 靜默失敗
      const data: ViolationCounts = await response.json();
      setPendingCount(data.pendingCount);
      setGeneratedCount(data.generatedCount);
      setTotalFine(data.totalFine); 
    } catch (err) {
      console.error("獲取統計數量失敗:", err);
    }
  };

  const fetchViolations = async (tab: 'pending' | 'generated') => {
    setLoading(true);
    setError(null);
    setViolations([]);
    
    const status = tab === 'pending' ? '已確認' : '已開罰';
    const url = getViolationsByStatusURL(status);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`無法獲取狀態為 "${status}" 的列表`);
      }
      const data: Violation[] = await response.json();
      setViolations(data);
    } catch (err: any) {
      setError(err.message);
      console.error("獲取資料失敗:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchViolations(activeTab);
  }, [activeTab]);

  useEffect(() => {
    fetchCounts();
  }, []);
  
  // --- 輔助函式 ---
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

  // --- 事件處理函式 ---
  const handleGenerateTicket = async (violationToGenerate: Violation) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/violation/${violationToGenerate.id}/generate-ticket`, {
        method: 'POST',
      });

      // 【建議修改】更強壯的錯誤處理
      if (!response.ok) {
        let errorMessage = `後端伺服器發生錯誤 (HTTP ${response.status})`;
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          console.error("無法將錯誤回應解析為 JSON:", jsonError);
        }
        throw new Error(errorMessage);
      }
      
      fetchViolations(activeTab);
      fetchCounts();

    } catch (err: any) {
      alert(`操作失敗: ${err.message}`);
      console.error("生成罰單時發生錯誤:", err);
    }
  };
  
  const filteredList = violations.filter(v => 
    `VIO-${v.id}`.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.plateNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <span className="stat-label">總罰鍰金額</span>
            <span className="stat-value">NT$ {(totalFine || 0).toLocaleString()}</span>
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
                    id="ticket-search"
                    name="ticket-search"
                    placeholder="車牌號碼"
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
             filteredList.length === 0 ? <div className="table-message">沒有符合條件的紀錄</div> :
             filteredList.map(v => {
               const { date, time } = formatTimestamp(v.timestamp);
               return (
                <div key={v.id} className="violation-card">
                  <div className="card-cell c-id"><div className="cell-content-vertical"><span className="main-info">VIO-{v.id}</span></div></div>
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