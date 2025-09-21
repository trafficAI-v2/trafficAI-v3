import React, { useState, useEffect, useRef } from 'react';
import { BiSearch, BiTag, BiMapPin, BiX, BiCalendar, BiDownload } from 'react-icons/bi';
import './ViolationLog.css'; 

// --- 從環境變數讀取後端 API 的 URL ---
const VIOLATIONS_URL = import.meta.env.VITE_GET_VIOLATIONS_URL;
const VIOLATION_TYPES_URL = import.meta.env.VITE_VIOLATION_TYPES_URL;
const CAMERAS_LIST_URL = import.meta.env.VITE_CAMERA_LIST_URL;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// --- TypeScript 型別定義 ---
interface ViolationType {
  type_name: string;
}

interface Camera {
  camera_name: string;
}

interface ViolationRecord {
  id: number; 
  type: string;
  plateNumber: string;
  vehicleType: string;
  timestamp: string;
  location: string;
  status: '待審核' | '已確認' | '已駁回' | '已開罰';
}

const TABS = ['全部', '待審核', '已確認', '已駁回', '已開罰'];

// --- React 元件主體 ---
const ViolationLog: React.FC = () => {
  // --- 狀態管理 (State) ---
  const [activeTab, setActiveTab] = useState<string>('全部');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [violations, setViolations] = useState<ViolationRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [violationTypes, setViolationTypes] = useState<ViolationType[]>([]);
  const [locations, setLocations] = useState<Camera[]>([]);
  const [filterType, setFilterType] = useState<string>('所有類型');
  const [filterLocation, setFilterLocation] = useState<string>('所有地點');
  const [filterDate, setFilterDate] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // --- Effects ---

  // Effect 1: 元件初次載入時，獲取篩選器選項
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
        if (!typesResponse.ok || !locationsResponse.ok) throw new Error('無法獲取篩選器選項');
        const typesData = await typesResponse.json();
        const locationsData = await locationsResponse.json();
        setViolationTypes(typesData);
        setLocations(locationsData);
      } catch (err: any) {
        console.error("獲取篩選資料失敗:", err);
        setError("無法載入篩選器選項，請檢查後端 API 是否正常運作。");
      }
    };
    fetchFiltersData();
  }, []);

  // Effect 2: 當任何篩選條件改變時，重新向後端請求違規紀錄
  useEffect(() => {
    if (!VIOLATIONS_URL) {
      setError('前端設定錯誤：未找到違規紀錄 API 位址。');
      setLoading(false);
      return;
    }
    const fetchViolations = async () => {
      setLoading(true);
      setError(null);
      setSelectedIds([]); // 每次重新載入資料時，清空勾選
      try {
        const params = new URLSearchParams();
        if (activeTab !== '全部') params.append('status', activeTab);
        if (searchTerm) params.append('search', searchTerm);
        if (filterType !== '所有類型') params.append('type', filterType);
        if (filterLocation !== '所有地點') params.append('location', filterLocation);
        if (filterDate) params.append('date', filterDate);
        const fetchUrl = `${VIOLATIONS_URL}?${params.toString()}`;
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error(`獲取違規紀錄失敗 (HTTP ${response.status})`);
        const data: ViolationRecord[] = await response.json();
        setViolations(data);
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

  // Effect 3: 控制表頭 checkbox 的 indeterminate 狀態
  useEffect(() => {
    if (headerCheckboxRef.current) {
      const numSelected = selectedIds.length;
      const numViolations = violations.length;
      headerCheckboxRef.current.checked = numSelected === numViolations && numViolations > 0;
      headerCheckboxRef.current.indeterminate = numSelected > 0 && numSelected < numViolations;
    }
  }, [selectedIds, violations]);

  // --- 輔助函式 ---
  const formatTimestamp = (isoString: string): { date: string, time: string } => {
    if (!isoString) return { date: 'N/A', time: '' };
    try {
      const [datePartStr, timePartStrWithZone] = isoString.split('T');
      const datePart = datePartStr.replace(/-/g, '/');
      if (!timePartStrWithZone) return { date: datePart, time: '' };
      const mainTimePart = timePartStrWithZone.split('.')[0];
      const [hours, minutes, seconds] = mainTimePart.split(':').map(Number);
      if ([hours, minutes, seconds].some(isNaN)) throw new Error('Invalid time');
      const ampm = hours >= 12 ? '下午' : '上午';
      let displayHours = hours % 12 || 12;
      const timePart = `${ampm} ${displayHours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      return { date: datePart, time: timePart };
    } catch (e) {
      console.error("無法解析時間戳字串:", isoString, e);
      return { date: '無效日期', time: '' };
    }
  };

  // --- 事件處理函式 ---

  // 處理單筆紀錄的勾選
  const handleRowSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]
    );
  };

  // 處理全選
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(violations.map(v => v.id));
    } else {
      setSelectedIds([]);
    }
  };

  // 處理批量更新 API 請求
  const handleBulkUpdate = async (newStatus: '已確認' | '已駁回' | '已開罰') => {
    if (selectedIds.length === 0) return;
    if (!API_BASE_URL) {
      alert('錯誤：未在 .env.local 中設定 VITE_API_BASE_URL');
      return;
    }
    const updateUrl = `${API_BASE_URL}/violations/status`;
    try {
      const response = await fetch(updateUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedIds,
          status: newStatus,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API 請求失敗`);
      }
      // 前端樂觀更新：從當前列表中移除已處理的項目
      setViolations(prev => prev.filter(v => !selectedIds.includes(v.id)));
      
    } catch (err: any) {
      console.error("批量更新失敗:", err);
      alert(`錯誤：無法更新紀錄。\n${err.message}`);
    } finally {
      setSelectedIds([]); // 無論成功或失敗都清空選項
    }
  };

  // --- JSX 渲染 ---
  return (
    <div className="violation-log-page">
      <div className="page-header-container">
        <h1>違規紀錄</h1>
        <p>檢視並管理檢測到的違規行為</p>
      </div>

      <div className="log-container-card">
        <div className="search-bar-container">
          <BiSearch className="search-icon" />
          <input
            type="text"
            placeholder="搜尋車牌號碼"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
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

        {/* 批量操作列，根據 activeTab 條件渲染不同的按鈕 */}
        {selectedIds.length > 0 && (
          <div className="bulk-actions-bar">
            <span>已選擇 {selectedIds.length} 筆紀錄</span>
            <div className="bulk-actions-buttons">
              {activeTab === '已確認' ? (
                // 如果在「已確認」頁面
                <>
                  <button onClick={() => handleBulkUpdate('已駁回')} className="bulk-action-btn reject">
                    批量駁回
                  </button>
                  <button onClick={() => handleBulkUpdate('已開罰')} className="bulk-action-btn issue-fine">
                    批量開罰
                  </button>
                </>
              ) : (
                // 在其他所有頁面
                <>
                  <button onClick={() => handleBulkUpdate('已駁回')} className="bulk-action-btn reject">
                    批量駁回
                  </button>
                  <button onClick={() => handleBulkUpdate('已確認')} className="bulk-action-btn confirm">
                    批量確認
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <div className="filters-container">
            <div className="active-filters">
              <span className="filter-tag">
                <BiTag /> {filterType} <BiX className="remove-tag-icon" onClick={() => setFilterType('所有類型')} />
              </span>
              <span className="filter-tag">
                <BiMapPin /> {filterLocation} <BiX className="remove-tag-icon" onClick={() => setFilterLocation('所有地點')} />
              </span>
            </div>
    
            <div className="filters-grid">
              <div className="filter-group">
                <label>違規類型</label>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="所有類型">所有類型</option>
                  {violationTypes.map((vType, index) => (
                    <option key={index} value={vType.type_name}>{vType.type_name}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>違規地點</label>
                <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
                  <option value="所有地點">所有地點</option>
                  {locations.map((loc, index) => (
                    <option key={index} value={loc.camera_name}>{loc.camera_name}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>時間範圍</label>
                <div className="date-picker-input">
                  <BiCalendar className="date-picker-icon"/>
                  <input 
                    type="text" 
                    placeholder="選擇日期範圍"
                    onFocus={(e) => (e.target.type = 'date')}
                    onBlur={(e) => (e.target.type = 'text')}
                    onChange={(e) => setFilterDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
        </div>
        
        <div className="violation-list-container">
          <div className="list-header">
            <div className="header-cell checkbox">
              <input
                type="checkbox"
                ref={headerCheckboxRef}
                onChange={handleSelectAll}
              /> 違規類型
            </div>
            <div className="header-cell plate">車牌號碼</div>
            <div className="header-cell time">時間</div>
            <div className="header-cell location">地點</div>
            <div className="header-cell status">狀態</div>
          </div>
          
          <div className="list-body">
            {loading ? (
              <div className="table-message">正在載入紀錄...</div>
            ) : error ? (
              <div className="table-message error">{error}</div>
            ) : violations.length === 0 ? (
              <div className="table-message">沒有符合條件的違規紀錄</div>
            ) : (
              violations.map(v => {
                const { date, time } = formatTimestamp(v.timestamp);
                const isSelected = selectedIds.includes(v.id);
                return (
                  <div key={v.id} className={`violation-card ${isSelected ? 'selected' : ''}`}>
                    <div className="card-cell checkbox">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleRowSelect(v.id)}
                      />
                      <div className="cell-content-vertical">
                        <span className="type-main">{v.type}</span>
                        <span className="plate-sub">VIO-{v.id}</span>
                      </div>
                    </div>
                    <div className="card-cell plate">
                       <div className="cell-content-vertical">
                        <span className="plate-main">{v.plateNumber}</span>
                        <span className="plate-sub">{v.vehicleType}</span> 
                      </div>
                    </div>
                    <div className="card-cell time">
                      <div className="cell-content-vertical">
                        <span className="date-main">{date}</span>
                        <span className="time-sub">{time}</span>
                      </div>
                    </div>
                    <div className="card-cell location">{v.location}</div>
                    <div className="card-cell status">
                      <span className={`status-tag status-${v.status}`}>{v.status}</span>
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