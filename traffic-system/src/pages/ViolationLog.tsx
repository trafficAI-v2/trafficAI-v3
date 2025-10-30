import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { BiSearch, BiTag, BiMapPin, BiX, BiCalendar, BiDownload, BiReceipt, BiCheckCircle } from 'react-icons/bi';
import './ViolationLog.css'; 

// --- 從環境變數讀取後端 API 的 URL ---
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const VIOLATIONS_URL = `${API_BASE_URL}/api/violations`;
const VIOLATION_TYPES_URL = `${API_BASE_URL}/api/violations/types`;
const CAMERAS_LIST_URL = `${API_BASE_URL}/api/cameras/list`;
const CONFIRMED_COUNT_URL = `${API_BASE_URL}/api/violations/confirmed-count`;
const VEHICLE_TYPE_URL = `${API_BASE_URL}/api/owners`;

// --- TypeScript 型別定義 ---
type ViolationStatus = '待審核' | '已確認' | '已駁回' | '已開罰';

interface ViolationType {
  type_name: string;
}

interface Camera {
  camera_name: string;
}

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
  status: ViolationStatus;
  fine?: number;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  ownerAddress?: string;
  // 【修改】confidence 欄位支援數字和字串
  confidence?: number | string | null;
}

const TABS = ['全部', '待審核', '已確認', '已駁回', '已開罰'];


// --- 違規詳情元件 ---
const ViolationDetail: React.FC<{ 
  violation: ViolationRecord; 
  onClose: () => void;
  onUpdateStatus: (id: number, status: ViolationStatus) => void;
}> = ({ violation, onClose, onUpdateStatus }) => {
  const [vehicleTypeInfo, setVehicleTypeInfo] = useState<VehicleTypeInfo | null>(null);
  const [vehicleTypeLoading, setVehicleTypeLoading] = useState<boolean>(false);
  const [vehicleTypeError, setVehicleTypeError] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // 【新增】格式化信心度函式
  // 將小數（例如 0.8756）轉換為百分比字串（"88%"）或直接顯示字串
  const formatConfidence = (value?: number | string | null): string => {
    if (value === null || value === undefined) {
      return 'N/A'; // 如果沒有信心度資料，顯示 N/A
    }
    
    // 如果是字串，檢查是否為數字字串
    if (typeof value === 'string') {
      // 如果字串是 "手動標注" 或類似的文字，直接返回
      if (value === '手動標注' || value === '手動標註' || isNaN(parseFloat(value))) {
        return value;
      }
      // 如果是數字字串（如 "0.8756"），轉換為數字處理
      const numValue = parseFloat(value);
      return `${Math.round(numValue * 100)}%`;
    }
    
    // 如果是數字，將小數乘以 100 並四捨五入到整數
    return `${Math.round(value * 100)}%`;
  };

  // 【新增】根據信心度決定等級的函式
  const getConfidenceLevel = (value?: number | string | null): { text: string; className: string } => {
    if (value === null || value === undefined) {
      return { text: '未知', className: 'level-unknown' };
    }
    
    let numericValue: number;
    
    // 如果是字串，檢查是否為數字字串
    if (typeof value === 'string') {
      // 如果字串是 "手動標注" 或類似的文字，返回手動樣式
      if (value === '手動標注' || value === '手動標註' || isNaN(parseFloat(value))) {
        return { text: '手動', className: 'level-manual' };
      }
      // 如果是數字字串（如 "0.8756"），轉換為數字
      numericValue = parseFloat(value);
    } else {
      // 如果已經是數字
      numericValue = value;
    }
    
    // 按照數值範圍判斷等級
    if (numericValue >= 0.9) {
      return { text: '高', className: 'level-high' };
    }
    if (numericValue >= 0.75) {
      return { text: '中高', className: 'level-medium-high' };
    }
    if (numericValue >= 0.5) {
      return { text: '中等', className: 'level-medium' };
    }
    // 小於 0.5 的情況
    return { text: '低', className: 'level-low' };
  };

  const formatDate = (isoString: string): string => {
    if (!isoString) return 'N/A';
    try {
      const [datePartStr] = isoString.split('T');
      return datePartStr;
    } catch (e) {
      console.error("無法解析時間戳字串:", isoString, e);
      return '無效日期';
    }
  };

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

  useEffect(() => {
    if (violation.plateNumber) {
      fetchVehicleType(violation.plateNumber);
    }
    if (violation.id) {
      fetchViolationImage(violation.id);
    }
  }, [violation.plateNumber, violation.id]);

  const formattedDate = formatDate(violation.timestamp);
  // 【新增】呼叫函式來獲取格式化後的信心度資訊
  const confidenceText = formatConfidence(violation.confidence);
  const confidenceLevel = getConfidenceLevel(violation.confidence);

  // 【新增】渲染違規圖片的輔助函式
  const renderViolationImage = () => {
    if (imageLoading) {
      return <div className="image-loading"><p>載入違規照片中...</p></div>;
    }
    
    if (imageError) {
      return (
        <div className="image-error">
          <p>❌ {imageError}</p>
          <p style={{ fontSize: '14px', opacity: '0.8' }}>請檢查網路連線或聯絡系統管理員</p>
        </div>
      );
    }
    
    if (imageData) {
      return (
        <div className="violation-image">
          <img src={`data:image/jpeg;base64,${imageData}`} alt={`車牌 ${violation.plateNumber} 的違規照片`} />
          <p>車牌：{violation.plateNumber} | 違規類型：{violation.type}</p>
        </div>
      );
    }
    
    return (
      <div className="image-placeholder">
        <p>📷</p><p>違規道路照片</p>
        <p style={{ fontSize: '14px', color: '#000000ff' }}>暫無圖片數據</p>
      </div>
    );
  };

  // 【新增】渲染車輛類型的輔助函式
  const renderVehicleType = () => {
    if (vehicleTypeLoading) {
      return <input id="vehicle-type" type="text" value="正在查詢車輛類型..." readOnly />;
    }
    
    if (vehicleTypeError) {
      return <input id="vehicle-type" type="text" value={`${violation.vehicleType || '未指定'} (${vehicleTypeError})`} readOnly />;
    }
    
    if (vehicleTypeInfo) {
      return <input id="vehicle-type" type="text" value={vehicleTypeInfo.vehicle_type} readOnly />;
    }
    
    return <input id="vehicle-type" type="text" value={violation.vehicleType || '未指定'} readOnly />;
  };

  const handleReject = () => onUpdateStatus(violation.id, '已駁回');
  const handleConfirm = () => onUpdateStatus(violation.id, '已確認');

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
            {renderViolationImage()}
        </div>

        <div className="detail-form">
            <div className="form-row">
                <label htmlFor="ticket-number">罰單編號</label>
                <input id="ticket-number" type="text" value={`VIO-${violation.id}`} readOnly />
            </div>
            <div className="form-row">
                <label htmlFor="violation-date">違規日期</label>
                <input id="violation-date" type="text" value={formattedDate} readOnly />
            </div>
            <div className="form-row">
                <label htmlFor="violation-type">違規類型</label>
                <input id="violation-type" type="text" value={violation.type} readOnly />
            </div>
            {/* 【修改】偵測信心度欄位，使用動態數據 */}
            <div className="form-row">
                <label htmlFor="confidence-display">偵測信心度</label>
                <div id="confidence-display" className="confidence-display">
                  {confidenceText}
                  <span className={`confidence-level ${confidenceLevel.className}`}>
                    {confidenceLevel.text}
                  </span>
                </div>
            </div>
            <div className="form-row">
                <label htmlFor="plate-number">車牌號碼</label>
                <input id="plate-number" type="text" value={violation.plateNumber} readOnly />
            </div>
            <div className="form-row">
                <label htmlFor="vehicle-type">車輛類型</label>
                {renderVehicleType()}
            </div>
            <div className="form-row">
                <label htmlFor="violation-location">違規地點</label>
                <input id="violation-location" type="text" value={violation.location} readOnly />
            </div>
            <div className="form-row owner-info">
                <label htmlFor="owner-name">車主姓名</label>
                <input id="owner-name" type="text" value={violation.ownerName || '未提供'} readOnly />
            </div>
            <div className="form-row owner-info">
                <label htmlFor="owner-phone">車主電話</label>
                <input id="owner-phone" type="text" value={violation.ownerPhone || '未提供'} readOnly />
            </div>
            <div className="form-row owner-info">
                <label htmlFor="owner-address">車主地址</label>
                <input id="owner-address" type="text" value={violation.ownerAddress || '未提供'} readOnly />
            </div>
             <div className="form-row">
                <label htmlFor="fine-amount">罰單金額 (NT$)</label>
                <input id="fine-amount" type="text" value={violation.fine ? `NT$ ${violation.fine.toLocaleString()}` : 'NT$ 未設定'} readOnly />
            </div>
            <div className="form-row">
                <label htmlFor="issuer">開立人員</label>
                <input id="issuer" type="text" value="系統自動生成" readOnly />
            </div>
            <div className="form-row">
                <label htmlFor="remarks">備註</label>
                <textarea id="remarks" placeholder="輸入額外備註..."></textarea>
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
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const recordsPerPage = 10;
  
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
        params.append('page', currentPage.toString());
        params.append('limit', recordsPerPage.toString());
        
        const fetchUrl = `${VIOLATIONS_URL}?${params.toString()}`;
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error(`獲取違規紀錄失敗 (HTTP ${response.status})`);
        
        const responseData = await response.json();
        if (responseData.data && responseData.pagination) {
          setViolations(responseData.data);
          setTotalRecords(responseData.pagination.total_records);
        } else {
          setViolations(responseData);
          setTotalRecords(responseData.length);
        }
      } catch (err: any) {
        setError(err.message);
        console.error("獲取違規紀錄失敗:", err);
      } finally {
        setLoading(false);
      }
    };
    const handler = setTimeout(fetchViolations, 300);
    return () => clearTimeout(handler);
  }, [activeTab, searchTerm, filterType, filterLocation, filterDate, currentPage]);

  useEffect(() => {
    if (headerCheckboxRef.current) {
      const numSelected = selectedIds.length;
      const numViolations = violations.length;
      headerCheckboxRef.current.checked = numSelected === numViolations && numViolations > 0;
      headerCheckboxRef.current.indeterminate = numSelected > 0 && numSelected < numViolations;
    }
  }, [selectedIds, violations]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, filterType, filterLocation, filterDate]);

  useEffect(() => {
    fetchConfirmedCount();
  }, []);

  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getPaginationNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(1, currentPage - 2);
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  const formatTimestamp = (isoString: string): { date: string, time: string } => {
    if (!isoString) return { date: 'N/A', time: '' };
    try {
      const [datePartStr, timePartStrWithZone] = isoString.split('T');
      const datePart = datePartStr.replaceAll('-', '/');
      if (!timePartStrWithZone) return { date: datePart, time: '' };
      const mainTimePart = timePartStrWithZone.split('.')[0];
      const [hours, minutes, seconds] = mainTimePart.split(':').map(Number);
      if ([hours, minutes, seconds].some(Number.isNaN)) throw new Error('Invalid time');
      const ampm = hours >= 12 ? '下午' : '上午';
      let displayHours = hours % 12 || 12;
      const timePart = `${ampm} ${displayHours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      return { date: datePart, time: timePart };
    } catch (e) {
      console.error("無法解析時間戳字串:", isoString, e);
      return { date: '無效日期', time: '' };
    }
  };

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

  const handleBulkUpdate = async (newStatus: ViolationStatus) => {
    if (selectedIds.length === 0) return;
    if (!API_BASE_URL) {
      alert('錯誤：未在 .env.local 中設定 VITE_API_BASE_URL');
      return;
    }
    const updateUrl = `${API_BASE_URL}/api/violations/status`;
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
      
      if (activeTab === '全部') {
        setViolations(prev => prev.map(v => 
          selectedIds.includes(v.id) ? { ...v, status: newStatus } : v
        ));
      } else {
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

  const handleSingleUpdate = async (id: number, newStatus: ViolationStatus) => {
    if (!API_BASE_URL) {
      alert('錯誤：未在 .env.local 中設定 VITE_API_BASE_URL');
      return;
    }
    const updateUrl = `${API_BASE_URL}/api/violations/status`;
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
      
      if (activeTab === '全部') {
        setViolations(prev => prev.map(v => 
          v.id === id ? { ...v, status: newStatus } : v
        ));
      } else {
        setViolations(prev => prev.filter(v => v.id !== id));
      }
      
      setSelectedViolation(null);
      fetchConfirmedCount();
    } catch (err: any) {
      console.error("狀態更新失敗:", err);
      alert(`錯誤：無法更新紀錄狀態。\n${err.message}`);
    }
  };
  
  const handleRowClick = (violation: ViolationRecord) => {
    if (selectedViolation && selectedViolation.id === violation.id) {
      setSelectedViolation(null);
    } else {
      setSelectedViolation(violation);
    }
  };

  // 【新增】渲染列表內容的輔助函式
  const renderListContent = () => {
    if (loading) {
      return <div className="table-message">正在載入紀錄...</div>;
    }
    
    if (error) {
      return <div className="table-message error">{error}</div>;
    }
    
    if (violations.length === 0) {
      return <div className="table-message">沒有符合條件的違規紀錄</div>;
    }
    
    return violations.map(v => {
      const { date, time } = formatTimestamp(v.timestamp);
      const isSelected = selectedIds.includes(v.id);
      const isDetailActive = selectedViolation && selectedViolation.id === v.id;

      return (
        <button 
          key={v.id} 
          className={`violation-card ${isSelected ? 'selected' : ''} ${isDetailActive ? 'detail-active' : ''}`}
          onClick={() => handleRowClick(v)}
          type="button"
          aria-label={`查看違規紀錄 ${v.plateNumber} 的詳細資訊`}
        >
          <div className="card-cell checkbox">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => { e.stopPropagation(); handleRowSelect(v.id); }}
              aria-label={`選取違規紀錄 ${v.plateNumber}`}
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
        </button>
      );
    });
  };

  return (
    <div className={`violation-log-page-wrapper ${selectedViolation ? 'detail-view-active' : ''}`}>
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
                  <label htmlFor="filter-type">違規類型</label>
                  <select id="filter-type" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                    <option value="所有類型">所有類型</option>
                    {violationTypes.map((vType) => (
                      <option key={vType.type_name} value={vType.type_name}>{vType.type_name}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label htmlFor="filter-location">違規地點</label>
                  <select id="filter-location" value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
                    <option value="所有地點">所有地點</option>
                    {locations.map((loc) => (
                      <option key={loc.camera_name} value={loc.camera_name}>{loc.camera_name}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label htmlFor="filter-date">時間範圍</label>
                  <div className="date-picker-input">
                    <BiCalendar className="date-picker-icon"/>
                    <input 
                      id="filter-date"
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
                <input type="checkbox" ref={headerCheckboxRef} onChange={handleSelectAll} /> 違規類型
              </div>
              <div className="header-cell plate">車牌號碼</div>
              <div className="header-cell time">時間</div>
              <div className="header-cell location">地點</div>
              <div className="header-cell status">狀態</div>
            </div>
            
            <div className="list-body">
              {renderListContent()}
            </div>
          </div>

          <div className="log-footer">
            <div className="pagination-info">
              <span>顯示第 {((currentPage - 1) * recordsPerPage) + 1} - {Math.min(currentPage * recordsPerPage, totalRecords)} 筆，共 {totalRecords} 筆紀錄</span>
            </div>
            
            {totalPages > 1 && (
              <div className="pagination-controls">
                <button className="pagination-btn" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>上一頁</button>
                {getPaginationNumbers().map(page => (
                  <button key={page} className={`pagination-btn ${page === currentPage ? 'active' : ''}`} onClick={() => handlePageChange(page)}>{page}</button>
                ))}
                <button className="pagination-btn" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>下一頁</button>
              </div>
            )}
            
            <button className="export-button"><BiDownload />匯出紀錄</button>
          </div>
        </div>
      </div>
      
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