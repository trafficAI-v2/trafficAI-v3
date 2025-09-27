import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { BiSearch, BiTag, BiMapPin, BiX, BiCalendar, BiDownload, BiReceipt, BiCheckCircle } from 'react-icons/bi';
import './ViolationLog.css'; 

// --- 從環境變數讀取後端 API 的 URL ---
const VIOLATIONS_URL = import.meta.env.VITE_GET_VIOLATIONS_URL;
const VIOLATION_TYPES_URL = import.meta.env.VITE_VIOLATION_TYPES_URL;
const CAMERAS_LIST_URL = import.meta.env.VITE_CAMERA_LIST_URL;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// 【新增】定義獲取已確認數量的 API URL
const CONFIRMED_COUNT_URL = `${API_BASE_URL}/api/violations/confirmed-count`;

// 【新增】定義車輛類型查詢 API URL
const VEHICLE_TYPE_URL = `${API_BASE_URL}/api/owners`;

// --- TypeScript 型別定義 ---
interface ViolationType {
  type_name: string;
}

interface Camera {
  camera_name: string;
}

// 【新增】車輛類型資訊型別定義
interface VehicleTypeInfo {
  license_plate_number: string;
  vehicle_type: string;
}

interface ViolationRecord {
  id: number; 
  type: string;
  plateNumber: string;
  vehicleType: string;
  timestamp: string;
  location: string;
  status: '待審核' | '已確認' | '已駁回' | '已開罰';
  fine?: number; // 新增罰款金額欄位
  ownerName?: string; // 車主姓名
  ownerPhone?: string; // 車主電話
  ownerEmail?: string; // 車主Email
  ownerAddress?: string; // 車主地址
}

const TABS = ['全部', '待審核', '已確認', '已駁回', '已開罰'];


// --- 違規詳情元件 ---
const ViolationDetail: React.FC<{ 
  violation: ViolationRecord; 
  onClose: () => void;
  onUpdateStatus: (id: number, status: '已確認' | '已駁回' | '已開罰') => void;
}> = ({ violation, onClose, onUpdateStatus }) => {
  // 車輛類型查詢狀態管理
  const [vehicleTypeInfo, setVehicleTypeInfo] = useState<VehicleTypeInfo | null>(null);
  const [vehicleTypeLoading, setVehicleTypeLoading] = useState<boolean>(false);
  const [vehicleTypeError, setVehicleTypeError] = useState<string | null>(null);

  // 【新增】圖片數據狀態管理
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // 使用與主列表相同的日期格式化邏輯，避免時區問題
  const formatDate = (isoString: string): string => {
    if (!isoString) return 'N/A';
    try {
      const [datePartStr] = isoString.split('T');
      return datePartStr; // 返回 YYYY-MM-DD 格式
    } catch (e) {
      console.error("無法解析時間戳字串:", isoString, e);
      return '無效日期';
    }
  };

  // 查詢車輛類型
  const fetchVehicleType = async (plateNumber: string) => {
    if (!VEHICLE_TYPE_URL || !plateNumber) return;
    
    setVehicleTypeLoading(true);
    setVehicleTypeError(null);
    
    try {
      const response = await fetch(`${VEHICLE_TYPE_URL}/${encodeURIComponent(plateNumber)}/vehicle-type`);
      if (!response.ok) {
        if (response.status === 404) {
          setVehicleTypeError('找不到該車牌的車輛類型');
          return;
        }
        throw new Error(`查詢失敗 (HTTP ${response.status})`);
      }
      const data: VehicleTypeInfo = await response.json();
      setVehicleTypeInfo(data);
    } catch (err: any) {
      console.error("查詢車輛類型失敗:", err);
      setVehicleTypeError(err.message || '查詢車輛類型時發生錯誤');
    } finally {
      setVehicleTypeLoading(false);
    }
  };

  // 【新增】獲取違規圖片
  const fetchViolationImage = async (violationId: number) => {
    if (!API_BASE_URL || !violationId) return;
    
    setImageLoading(true);
    setImageError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/violations/${violationId}/image`);
      if (!response.ok) {
        if (response.status === 404) {
          setImageError('找不到該違規紀錄的圖片');
          return;
        }
        throw new Error(`獲取圖片失敗 (HTTP ${response.status})`);
      }
      const data = await response.json();
      if (data.success && data.image_data) {
        setImageData(data.image_data);
      } else {
        setImageError('圖片數據格式錯誤');
      }
    } catch (err: any) {
      console.error("獲取違規圖片失敗:", err);
      setImageError(err.message || '獲取圖片時發生錯誤');
    } finally {
      setImageLoading(false);
    }
  };

  // 當違規記錄變更時，查詢車輛類型和圖片
  useEffect(() => {
    if (violation.plateNumber) {
      fetchVehicleType(violation.plateNumber);
    }
    if (violation.id) {
      fetchViolationImage(violation.id);
    }
  }, [violation.plateNumber, violation.id]);

  const formattedDate = formatDate(violation.timestamp);

  const handleReject = () => {
    onUpdateStatus(violation.id, '已駁回');
  };

  const handleConfirm = () => {
    onUpdateStatus(violation.id, '已確認');
  };

  return (
    <div className="violation-detail-card">
        <div className="detail-header">
            <div>
              <h3>違規詳情與罰單生成</h3>
              <p>查看違規詳情並產生電子罰單</p>
            </div>
            <button className="close-detail-btn" onClick={onClose} aria-label="關閉詳情">
                <BiX />
            </button>
        </div>

        <div className="violation-image-placeholder">
            {imageLoading ? (
                <div className="image-loading">
                    <p>載入違規照片中...</p>
                </div>
            ) : imageError ? (
                <div className="image-error">
                    <p>❌ {imageError}</p>
                    <p style={{ fontSize: '14px', opacity: '0.8' }}>請檢查網路連線或聯絡系統管理員</p>
                </div>
            ) : imageData ? (
                <div className="violation-image">
                    <img 
                        src={`data:image/jpeg;base64,${imageData}`} 
                        alt={`車牌 ${violation.plateNumber} 的違規照片`}
                        onError={() => {
                            console.error('圖片載入失敗');
                            setImageError('圖片載入失敗');
                        }}
                        onLoad={() => {
                            console.log('圖片載入成功');
                        }}
                    />
                    <p>車牌：{violation.plateNumber} | 違規類型：{violation.type}</p>
                </div>
            ) : (
                <div className="image-placeholder">
                    <p>📷</p>
                    <p>違規道路照片</p>
                    <p style={{ fontSize: '14px', color: '#000000ff' }}>暫無圖片數據</p>
                </div>
            )}
        </div>

        <div className="detail-form">
            <div className="form-row">
                <label>罰單編號</label>
                <input type="text" value={`VIO-${violation.id}`} readOnly />
            </div>
            <div className="form-row">
                <label>違規日期</label>
                <input type="text" value={formattedDate} readOnly />
            </div>
            <div className="form-row">
                <label>違規類型</label>
                <input type="text" value={violation.type} readOnly />
            </div>
            <div className="form-row">
                <label>偵測信心度</label>
                <div className="confidence-display">87% <span className="confidence-level">中高</span></div>
            </div>
            <div className="form-row">
                <label>車牌號碼</label>
                <input type="text" value={violation.plateNumber} readOnly />
            </div>
            <div className="form-row">
                <label>車輛類型</label>
                {vehicleTypeLoading ? (
                    <input type="text" value="正在查詢車輛類型..." readOnly />
                ) : vehicleTypeError ? (
                    <input type="text" value={`${violation.vehicleType || '未指定'} (${vehicleTypeError})`} readOnly />
                ) : vehicleTypeInfo ? (
                    <input type="text" value={vehicleTypeInfo.vehicle_type} readOnly />
                ) : (
                    <input type="text" value={violation.vehicleType || '未指定'} readOnly />
                )}
            </div>
            <div className="form-row">
                <label>違規地點</label>
                <input type="text" value={violation.location} readOnly />
            </div>
            <div className="form-row owner-info">
                <label>車主姓名</label>
                <input type="text" value={violation.ownerName || '未提供'} readOnly />
            </div>
            {/* 【新增】車主聯絡電話欄位 */}
            <div className="form-row owner-info">
                <label>車主電話</label>
                <input type="text" value={violation.ownerPhone || '未提供'} readOnly />
            </div>
            {/* 【新增】車主地址欄位 */}
            <div className="form-row owner-info">
                <label>車主地址</label>
                <input type="text" value={violation.ownerAddress || '未提供'} readOnly />
            </div>
             <div className="form-row">
                <label>罰單金額 (NT$)</label>
                <input 
                    type="text" 
                    value={violation.fine ? `NT$ ${violation.fine.toLocaleString()}` : 'NT$ 未設定'} 
                    readOnly 
                />
            </div>
            <div className="form-row">
                <label>開立人員</label>
                <input type="text" value="系統自動生成" readOnly />
            </div>
            <div className="form-row">
                <label>備註</label>
                <textarea placeholder="輸入額外備註..."></textarea>
            </div>
        </div>

        <div className="detail-footer-actions">
            <button className="btn-secondary" onClick={handleReject}>駁回</button>
            <button className="btn-primary" onClick={handleConfirm}>確認違規</button>
        </div>
    </div>
  );
};


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
  const [confirmedCount, setConfirmedCount] = useState<number>(0);
  const [selectedViolation, setSelectedViolation] = useState<ViolationRecord | null>(null);
  


  // --- 輔助函式 ---
  const fetchConfirmedCount = async () => {
    try {
        if (!CONFIRMED_COUNT_URL) return;
        const response = await fetch(CONFIRMED_COUNT_URL);
        if (!response.ok) return;
        const data = await response.json();
        setConfirmedCount(data.count);
    } catch (err) {
        console.error("獲取已確認違規數量失敗:", err);
    }
  };

  // --- Effects ---
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

  useEffect(() => {
    if (!VIOLATIONS_URL) {
      setError('前端設定錯誤：未找到違規紀錄 API 位址。');
      setLoading(false);
      return;
    }
    const fetchViolations = async () => {
      setLoading(true);
      setError(null);
      setSelectedIds([]);
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

  useEffect(() => {
    if (headerCheckboxRef.current) {
      const numSelected = selectedIds.length;
      const numViolations = violations.length;
      headerCheckboxRef.current.checked = numSelected === numViolations && numViolations > 0;
      headerCheckboxRef.current.indeterminate = numSelected > 0 && numSelected < numViolations;
    }
  }, [selectedIds, violations]);

  useEffect(() => {
    fetchConfirmedCount();
  }, []);

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
  const handleRowSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(violations.map(v => v.id));
    } else {
      setSelectedIds([]);
    }
  };

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
      
      // 根據當前篩選標籤決定處理方式
      if (activeTab === '全部') {
        // 在「全部」標籤下，更新選中項目的狀態，不移除
        setViolations(prev => prev.map(v => 
          selectedIds.includes(v.id) ? { ...v, status: newStatus } : v
        ));
      } else {
        // 在特定狀態標籤下，移除選中項目（因為它們不再符合當前篩選條件）
        setViolations(prev => prev.filter(v => !selectedIds.includes(v.id)));
      }
      
      fetchConfirmedCount();
    } catch (err: any) {
      console.error("批量更新失敗:", err);
      alert(`錯誤：無法更新紀錄。\n${err.message}`);
    } finally {
      setSelectedIds([]);
    }
  };

  // 【新增】處理單筆違規紀錄狀態更新
  const handleSingleUpdate = async (id: number, newStatus: '已確認' | '已駁回' | '已開罰') => {
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
          ids: [id],
          status: newStatus,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API 請求失敗`);
      }
      
      // 根據當前篩選標籤決定處理方式
      if (activeTab === '全部') {
        // 在「全部」標籤下，更新該項目的狀態，不移除
        setViolations(prev => prev.map(v => 
          v.id === id ? { ...v, status: newStatus } : v
        ));
      } else {
        // 在特定狀態標籤下，移除該項目（因為它不再符合當前篩選條件）
        setViolations(prev => prev.filter(v => v.id !== id));
      }
      
      // 關閉詳情頁面
      setSelectedViolation(null);
      // 重新獲取已確認數量
      fetchConfirmedCount();
    } catch (err: any) {
      console.error("狀態更新失敗:", err);
      alert(`錯誤：無法更新紀錄狀態。\n${err.message}`);
    }
  };
  
  // 【還原】handleRowClick 函式，不再需要 event 參數
  const handleRowClick = (violation: ViolationRecord) => {
    if (selectedViolation && selectedViolation.id === violation.id) {
      setSelectedViolation(null);
    } else {
      setSelectedViolation(violation);
    }
  };

  // --- JSX 渲染 ---
  return (
    <div className={`violation-log-page-wrapper ${selectedViolation ? 'detail-view-active' : ''}`}>
      {/* 左側列表區塊 */}
      <div className="violation-log-page">
        <div className="page-header-container">
          <div>
            <h1>違規紀錄</h1>
            <p>檢視並管理檢測到的違規行為</p>
          </div>
          {confirmedCount > 0 && (
            <Link to="/generate-tickets" className="generate-tickets-btn">
              <BiReceipt />
              <span>罰單產生區 ({confirmedCount})</span>
            </Link>
          )}
        </div>

        <div className="log-container-card">
          {confirmedCount > 0 && (
            <div className="ticket-notification-bar">
              <BiCheckCircle />
              <span>
                目前有 <strong>{confirmedCount}</strong> 筆已確認違規等待生成罰單。
                <Link to="/generate-tickets" className="notification-link">立即前往產生罰單專區</Link>
              </span>
            </div>
          )}

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

          {selectedIds.length > 0 && (
            <div className="bulk-actions-bar">
              <span>已選擇 {selectedIds.length} 筆紀錄</span>
              <div className="bulk-actions-buttons">
                {activeTab === '已確認' ? (
                  <>
                    <button onClick={() => handleBulkUpdate('已駁回')} className="bulk-action-btn reject">批量駁回</button>
                    <button onClick={() => handleBulkUpdate('已開罰')} className="bulk-action-btn issue-fine">批量開罰</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleBulkUpdate('已駁回')} className="bulk-action-btn reject">批量駁回</button>
                    <button onClick={() => handleBulkUpdate('已確認')} className="bulk-action-btn confirm">批量確認</button>
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
                  const isDetailActive = selectedViolation && selectedViolation.id === v.id;

                  return (
                    <div 
                      key={v.id} 
                      className={`violation-card ${isSelected ? 'selected' : ''} ${isDetailActive ? 'detail-active' : ''}`}
                      onClick={() => handleRowClick(v)}
                    >
                      <div className="card-cell checkbox">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleRowSelect(v.id);
                          }}
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
      
      {/* 右側詳情區塊 */}
      <div className="violation-detail-view">
        {selectedViolation && (
            <ViolationDetail 
                violation={selectedViolation} 
                onClose={() => setSelectedViolation(null)}
                onUpdateStatus={handleSingleUpdate}
            />
        )}
      </div>
    </div>
  );
};

export default ViolationLog;