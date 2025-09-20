// 違規管理頁面
import React, { useState, useEffect } from 'react';
import { BiSearch, BiTag, BiMapPin, BiX, BiCalendar, BiDownload, BiCheck } from 'react-icons/bi';
import './ViolationLog.css';

// --- 從環境變數讀取 API URL ---
const VIOLATION_TYPES_URL = import.meta.env.VITE_VIOLATION_TYPES_URL;
const CAMERAS_LIST_URL = import.meta.env.VITE_CAMERA_LIST_URL;
const VIOLATIONS_URL = import.meta.env.VITE_GET_VIOLATIONS_URL;


// --- 型別定義 ---
interface ViolationType {
  type_name: string;
}

interface Camera {
  camera_name: string;
}

interface ViolationRecord {
  type: string;
  plateNumber: string;
  timestamp: string;
  location: string;
  status: string;
}

const TABS = ['全部', '待審核', '已確認', '已駁回', '已開罰'];

const ViolationLog: React.FC = () => {
  // --- 狀態管理 ---
  const [activeTab, setActiveTab] = useState<string>(TABS[0]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [violations, setViolations] = useState<ViolationRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [violationTypes, setViolationTypes] = useState<ViolationType[]>([]);
  const [locations, setLocations] = useState<Camera[]>([]);

  const [filterType, setFilterType] = useState<string>('所有類型');
  const [filterLocation, setFilterLocation] = useState<string>('所有地點');
  const [filterDate, setFilterDate] = useState<string>('');

  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  // Effect 1: 只在初次載入時獲取篩選器的選項
  useEffect(() => {
    if (!VIOLATION_TYPES_URL || !CAMERAS_LIST_URL) {
      setError('前端設定錯誤：未找到篩選器 API 位址。');
      return;
    }
    const fetchFiltersData = async () => {
      try {
        const [typesResponse, locationsResponse] = await Promise.all([
          fetch(VIOLATION_TYPES_URL),
          fetch(CAMERAS_LIST_URL)
        ]);
        if (!typesResponse.ok || !locationsResponse.ok) {
          throw new Error('無法獲取篩選器選項');
        }
        const typesData = await typesResponse.json();
        const locationsData = await locationsResponse.json();
        setViolationTypes(typesData);
        setLocations(locationsData);
      } catch (err: any) {
        console.error("獲取篩選資料失敗:", err);
        setError(err.message);
      }
    };
    fetchFiltersData();
  }, []);

  // Effect 2: 在任何篩選條件改變時，重新獲取違規紀錄
  useEffect(() => {
    if (!VIOLATIONS_URL) {
      setError('前端設定錯誤：未找到違規紀錄 API 位址。');
      setLoading(false);
      return;
    }

    const fetchViolations = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (activeTab !== '全部') params.append('status', activeTab);
        if (searchTerm) params.append('search', searchTerm);
        if (filterType !== '所有類型') params.append('type', filterType);
        if (filterLocation !== '所有地點') params.append('location', filterLocation);
        if (filterDate) params.append('date', filterDate);

        const queryString = params.toString();
        const fetchUrl = `${VIOLATIONS_URL}${queryString ? `?${queryString}` : ''}`;

        const response = await fetch(fetchUrl);
        if (!response.ok) {
          throw new Error(`獲取違規紀錄失敗: ${response.status}`);
        }

        const data: ViolationRecord[] = await response.json();
        setViolations(data);
        setSelectedRows([]); // 清空選項

      } catch (err: any) {
        setError(err.message);
        console.error("獲取違規紀錄失敗:", err);
      } finally {
        setLoading(false);
      }
    };

    const handler = setTimeout(fetchViolations, 300);
    return () => clearTimeout(handler);

  }, [activeTab, searchTerm, filterType, filterLocation, filterDate]);

  // 格式化時間戳的輔助函式
  const formatTimestamp = (isoString: string) => {
    if (!isoString) return { date: 'N/A', time: '' };
    const date = new Date(isoString);
    const datePart = date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
    const timePart = date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Taipei' });
    return { date: datePart, time: timePart.replace(/上午|下午/, (match) => match === '上午' ? '上午' : '下午') };
  };

  // 處理單行選擇
  const handleRowSelect = (plateNumber: string) => {
    setSelectedRows(prev =>
      prev.includes(plateNumber)
        ? prev.filter(pn => pn !== plateNumber)
        : [...prev, plateNumber]
    );
  };

  // 處理全選
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRows(violations.map(v => v.plateNumber));
    } else {
      setSelectedRows([]);
    }
  };

  // 處理批量更新
  const handleBulkUpdate = async (newStatus: '已確認' | '已駁回') => {
    if (selectedRows.length === 0) {
      console.warn("No rows selected for bulk update.");
      return;
    }

    const API_URL = import.meta.env.VITE_API_BASE_URL || '';
    const updateUrl = `${API_URL}/violations/status`;

    try {
      const response = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plateNumbers: selectedRows,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }
      
      const result = await response.json();
      console.log(result.message);

      setViolations(prevViolations =>
        prevViolations.map(v =>
          selectedRows.includes(v.plateNumber)
            ? { ...v, status: newStatus }
            : v
        )
      );

    } catch (err: any) {
      console.error("Failed to bulk update violations:", err);
      alert(`錯誤：無法更新紀錄。\n${err.message}`);
    } finally {
      // 無論成功或失敗，最後都清空選項
      setSelectedRows([]);
    }
  };

  return (
    <div className="violation-log-page">
      <div className="page-header-container">
        <h1>違規紀錄</h1>
        <p>檢視並管理檢測到的違規行為</p>
      </div>

      <div className="log-container-card">
        <div className="search-bar-container">
          <input
            type="text"
            placeholder="搜尋違規 ID 或車牌號碼"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <BiSearch className="search-icon" />
        </div>

        <div className="log-tabs">
          {TABS.map(tab => (
            <button
              key={tab}
              className={`log-tab-button ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {selectedRows.length > 0 && (
          <div className="bulk-actions-bar">
            <span>已選擇 {selectedRows.length} 筆紀錄</span>
            <div className="bulk-actions-buttons">
              <button onClick={() => handleBulkUpdate('已確認')} className="bulk-confirm-btn">
                批量確認
              </button>
              <button onClick={() => handleBulkUpdate('已駁回')} className="bulk-reject-btn">
                批量駁回
              </button>
            </div>
          </div>
        )}

        <div className="active-filters">
          <span className="filter-tag">
            <BiTag /> {filterType} <BiX className="remove-tag-icon" onClick={() => setFilterType('所有類型')} />
          </span>
          <span className="filter-tag">
            <BiMapPin /> {filterLocation} <BiX className="remove-tag-icon" onClick={() => setFilterLocation('所有地點')} />
          </span>
        </div>

        <div className="filters-grid">
          {/* Filters grid content */}
        </div>

        <div className="violation-card-list">
          <div className="card-list-header">
            <div className="header-cell checkbox">
              <input
                type="checkbox"
                onChange={handleSelectAll}
                checked={violations.length > 0 && selectedRows.length === violations.length}
              /> 違規類型
            </div>
            <div className="header-cell">車牌號碼</div>
            <div className="header-cell">時間</div>
            <div className="header-cell">地點</div>
            <div className="header-cell status">狀態</div>
          </div>

          <div className="card-list-body">
            {loading ? (
              <div className="table-message">正在載入紀錄...</div>
            ) : error ? (
              <div className="table-message error">{error}</div>
            ) : violations.length === 0 ? (
              <div className="table-message">沒有符合條件的違規紀錄</div>
            ) : (
              violations.map((v, index) => {
                const { date, time } = formatTimestamp(v.timestamp);
                return (
                  <div key={index} className={`violation-card ${selectedRows.includes(v.plateNumber) ? 'selected' : ''}`}>
                    <div className="card-cell checkbox">
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(v.plateNumber)}
                        onChange={() => handleRowSelect(v.plateNumber)}
                      />
                      <span className="type">{v.type}</span>
                    </div>
                    <div className="card-cell">
                      <span className="plate-number">{v.plateNumber}</span>
                    </div>
                    <div className="card-cell">
                      <div className="cell-content">
                        <span className="date">{date}</span>
                        <span className="time">{time}</span>
                      </div>
                    </div>
                    <div className="card-cell location">
                      {v.location}
                    </div>
                    <div className="card-cell status">
                      <span className="status-tag" data-status={v.status}>
                        {v.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="log-footer">
          <span>顯示 {violations.length} 筆，共 {violations.length} 筆紀錄</span>
          <button className="export-button">
            <BiDownload />
            匯出紀錄
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViolationLog;