/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React, { useState, useEffect } from 'react';
import { BiX, BiCheck, BiUser, BiReceipt, BiCamera, BiMapPin, BiTime, BiCar } from 'react-icons/bi';
import './TicketGenerationModal.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// 型別定義
interface Violation {
  id: number;
  type: string;
  plateNumber: string;
  timestamp: string;
  location: string;
}

interface OwnerInfo {
  full_name: string;
  id_number: string;
  email: string;
  phone_number: string;
  address: string;
  gender: string;
  date_of_birth: string;
  vehicle_type: string;
}

interface TicketGenerationModalProps {
  violation: Violation | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TicketGenerationModal: React.FC<TicketGenerationModalProps> = ({
  violation,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [ownerInfo, setOwnerInfo] = useState<OwnerInfo | null>(null);
  const [violationImage, setViolationImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // 重置狀態當模態開啟時
  useEffect(() => {
    if (isOpen && violation) {
      setCurrentStep(1);
      setOwnerInfo(null);
      setViolationImage(null);
      setImageLoading(false);
      setImageError(null);
      setError(null);
      setShowPdfPreview(false);
      setPdfLoading(false);
      fetchViolationImage();
    }
  }, [isOpen, violation]);

  // 獲取違規照片
  const fetchViolationImage = async () => {
    if (!violation) return;
    
    setImageLoading(true);
    setImageError(null);
    setViolationImage(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/violations/${violation.id}/image`);
      if (!response.ok) {
        if (response.status === 404) {
          setImageError('找不到該違規紀錄的圖片');
          return;
        }
        throw new Error(`獲取圖片失敗 (HTTP ${response.status})`);
      }
      const data = await response.json();
      if (data.success && data.image_data) {
        setViolationImage(data.image_data);
      } else {
        setImageError('圖片數據格式錯誤');
      }
    } catch (err: any) {
      console.error('獲取違規照片失敗:', err);
      setImageError(err.message || '獲取圖片時發生錯誤');
    } finally {
      setImageLoading(false);
    }
  };

  // 查詢車主資料
  const fetchOwnerInfo = async () => {
    if (!violation) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/owners/${encodeURIComponent(violation.plateNumber)}`);
      if (!response.ok) {
        throw new Error('無法找到該車牌的車主資料');
      }
      const data: OwnerInfo = await response.json();
      setOwnerInfo(data);
      // 移除自動跳轉，讓使用者手動點擊下一步
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 生成PDF預覽 (暫時使用模擬數據)
  const generatePdfPreview = async () => {
    console.log('generatePdfPreview clicked!', { violation, ownerInfo });
    if (!violation || !ownerInfo) {
      console.log('Missing violation or ownerInfo');
      return;
    }

    setPdfLoading(true);
    setError(null);

    // 模擬載入時間
    setTimeout(() => {
      console.log('Opening PDF preview');
      setShowPdfPreview(true);
      setPdfLoading(false);
    }, 500);
  };

  // 生成模擬PDF內容 (HTML版本預覽)
  const generateMockPdfContent = () => {
    const { date, time } = formatTimestamp(violation!.timestamp);
    
    return `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>交通違規電子罰單</title>
          <style>
            body { 
              font-family: 'Microsoft JhengHei', 'SimHei', Arial, sans-serif; 
              margin: 0;
              padding: 20px; 
              line-height: 1.4;
              background-color: #f5f5f5;
            }
            .document-container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              border: 2px solid #ddd;
              box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
              color: white;
              text-align: center; 
              padding: 25px 20px;
              margin: 0;
            }
            .header h1 {
              font-size: 26px;
              font-weight: bold;
              margin: 0 0 8px 0;
              letter-spacing: 1px;
            }
            .header .ticket-info {
              font-size: 16px;
              margin: 5px 0;
              opacity: 0.95;
            }
            .content { 
              padding: 30px; 
            }
            .section { 
              margin: 25px 0; 
              border: 1px solid #e0e0e0;
              background: #fafafa;
            }
            .section-title { 
              background: #f0f0f0;
              border-bottom: 2px solid #1e3a8a;
              font-size: 18px; 
              font-weight: bold; 
              color: #1e3a8a; 
              margin: 0;
              padding: 12px 20px;
              letter-spacing: 0.5px;
            }
            .section-content {
              padding: 20px;
              background: white;
            }
            .field-row { 
              display: flex;
              align-items: center;
              margin: 12px 0; 
              min-height: 28px;
              border-bottom: 1px solid #f0f0f0;
              padding-bottom: 8px;
            }
            .field-row:last-child {
              border-bottom: none;
            }
            .label { 
              font-weight: 600; 
              color: #374151; 
              min-width: 140px;
              font-size: 14px;
            }
            .value { 
              color: #1f2937;
              font-size: 14px;
              font-weight: 500;
            }
            .two-column {
              display: flex;
              gap: 30px;
            }
            .column {
              flex: 1;
            }
            .violation-details-section {
              background: #fff3cd;
              border: 1px solid #ffeaa7;
            }
            .violation-details-section .section-title {
              background: #fff3cd;
              color: #856404;
              border-bottom: 2px solid #856404;
            }
            .violation-image {
              max-width: 280px;
              max-height: 200px;
              border: 2px solid #ddd;
              border-radius: 6px;
              margin: 10px 0;
              object-fit: contain;
            }
            .image-container {
              text-align: center;
              padding: 15px;
              background: #f8f9fa;
              border-radius: 6px;
              border: 1px solid #dee2e6;
            }
            .image-placeholder {
              color: #666;
              font-style: italic;
              padding: 20px;
            }
            .notice-section {
              background: #f8d7da;
              border: 1px solid #f5c6cb;
            }
            .notice-section .section-title {
              background: #f8d7da;
              color: #721c24;
              border-bottom: 2px solid #721c24;
            }
            .notice-content {
              color: #721c24;
              font-size: 13px;
              line-height: 1.6;
            }
            .notice-content p {
              margin: 12px 0;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 2px solid #e0e0e0;
              color: #666;
              font-size: 13px;
            }
            .footer-highlight {
              color: #dc2626;
              font-weight: bold;
              margin-top: 10px;
            }
            .violation-type-highlight {
              color: #dc2626;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="document-container">
            <div class="header">
              <h1>交通違規電子罰單</h1>
              <div class="ticket-info">罰單編號: VIO-${violation!.id}</div>
              <div class="ticket-info">開立日期: ${new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', '/')}</div>
            </div>
            
            <div class="content">
              <div class="section">
                <div class="section-title">車主基本資料</div>
                <div class="section-content">
                  <div class="two-column">
                    <div class="column">
                      <div class="field-row">
                        <span class="label">車主姓名:</span>
                        <span class="value">${ownerInfo!.full_name}</span>
                      </div>
                      <div class="field-row">
                        <span class="label">身分證字號:</span>
                        <span class="value">${ownerInfo!.id_number}</span>
                      </div>
                      <div class="field-row">
                        <span class="label">性別:</span>
                        <span class="value">${ownerInfo!.gender || '未提供'}</span>
                      </div>
                      <div class="field-row">
                        <span class="label">出生年月日（YYYY/MM/DD）:</span>
                        <span class="value">${formatDateOfBirth(ownerInfo!.date_of_birth)}</span>
                      </div>
                    </div>
                    <div class="column">
                      <div class="field-row">
                        <span class="label">聯絡電話:</span>
                        <span class="value">${ownerInfo!.phone_number}</span>
                      </div>
                      <div class="field-row">
                        <span class="label">電子郵件:</span>
                        <span class="value">${ownerInfo!.email || '未提供'}</span>
                      </div>
                      <div class="field-row">
                        <span class="label">戶籍地址:</span>
                        <span class="value">${ownerInfo!.address}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="section violation-details-section">
                <div class="section-title">違規詳細資訊</div>
                <div class="section-content">
                  <div class="two-column">
                    <div class="column">
                      <div class="field-row">
                        <span class="label">車牌號碼:</span>
                        <span class="value">${violation!.plateNumber}</span>
                      </div>
                      <div class="field-row">
                        <span class="label">車輛類型:</span>
                        <span class="value">${ownerInfo!.vehicle_type}</span>
                      </div>
                      <div class="field-row">
                        <span class="label">違規類型:</span>
                        <span class="value violation-type-highlight">${violation!.type}</span>
                      </div>
                      <div class="field-row">
                        <span class="label">違規時間:</span>
                        <span class="value">${date} ${time}</span>
                      </div>
                      <div class="field-row">
                        <span class="label">違規地點:</span>
                        <span class="value">${violation!.location}</span>
                      </div>
                    </div>
                    <div class="column">
                      <div class="field-row">
                        <span class="label" style="width: 100%; text-align: center; margin-bottom: 10px;">違規照片</span>
                      </div>
                      <div class="image-container">
                        ${violationImage ? 
                          `<img src="data:image/jpeg;base64,${violationImage}" alt="違規照片" class="violation-image" />` : 
                          '<div class="image-placeholder">違規照片請參考系統內紀錄</div>'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="section notice-section">
                <div class="section-title">注意事項</div>
                <div class="section-content">
                  <div class="notice-content">
                    <p>接獲違反道路交通管理事件電子通知單後，依所記載「應到案日期」前往監理所、站接受裁處或以郵繳即時銷案、電話語音轉帳、網路方式繳納罰鍰。並請於「應到案日期」前，以電話查詢該交通違規案件是否已由舉發單位移送至應到案處所，避免徒勞往返。</p>
                    
                    <p>如發現接獲之違反道路交通管理事件通知單上所填載之車牌號碼或被通知人姓名有疑問，請於應到案日期前向原舉發單位或監理所、站提出書面申請要求更正，以免逾越繳納期限，受加重處罰。</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="footer">
              <p><strong>智慧交通監控系統</strong></p>
              <p>自動發送時間: ${new Date().toLocaleDateString('zh-TW')} ${new Date().toLocaleTimeString('zh-TW', { hour12: false })}</p>
              <div class="footer-highlight">本郵件為系統自動發送，請勿直接回覆</div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  // 關閉PDF預覽
  const closePdfPreview = () => {
    setShowPdfPreview(false);
  };

  // 格式化時間
  const formatTimestamp = (isoString: string): { date: string, time: string } => {
    if (!isoString) return { date: 'N/A', time: '' };
    try {
      // 使用與 ViolationLog.tsx 和 GenerateTickets.tsx 相同的時間解析邏輯
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

  // 格式化出生年月日
  const formatDateOfBirth = (dateString: string): string => {
    if (!dateString) return '未提供';
    try {
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return '未提供';
      
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      
      return `${year}/${month}/${day}`;
    } catch (e) {
      console.error("無法解析出生年月日:", dateString, e);
      return '未提供';
    }
  };

  // 生成簡訊內容
  const generateSMSContent = () => {
    if (!violation || !ownerInfo) return '';

    const { date, time } = formatTimestamp(violation.timestamp);
    
    // 根據性別決定稱謂
    let genderSuffix = '先生/女士';
    if (ownerInfo.gender) {
      if (ownerInfo.gender === '男' || ownerInfo.gender === 'M' || ownerInfo.gender === 'Male') {
        genderSuffix = '先生';
      } else if (ownerInfo.gender === '女' || ownerInfo.gender === 'F' || ownerInfo.gender === 'Female') {
        genderSuffix = '女士';
      }
    }
    
    return `[交通違規通知]\n\n${ownerInfo.full_name}${genderSuffix}您好，您的車輛(車牌: ${violation.plateNumber})於 ${date} ${time} 在 ${violation.location} 有一筆 ${violation.type} 違規。詳情請見罰單內容。`;
  };

  // 確認發送罰單
  const handleConfirmSend = async () => {
    if (!violation) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/violation/${violation.id}/generate-ticket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ownerInfo,
          smsContent: generateSMSContent(),
        }),
      });

      if (!response.ok) {
        throw new Error('罰單生成失敗');
      }

      const result = await response.json();
      
      // 顯示成功訊息，包含email發送結果
      console.log('罰單生成結果:', result);
      alert(result.message); // 顯示包含email發送狀態的訊息

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 渲染圖片組件
  const renderViolationImage = () => {
    if (imageLoading) {
      return (
        <div className="image-placeholder">
          <BiCamera />
          <span>載入中...</span>
        </div>
      );
    }
    
    if (imageError) {
      return (
        <div className="image-placeholder">
          <BiCamera />
          <span>❌ {imageError}</span>
        </div>
      );
    }
    
    if (violationImage) {
      return (
        <img 
          src={`data:image/jpeg;base64,${violationImage}`} 
          alt={`車牌 ${violation?.plateNumber} 的違規照片`}
          onError={() => {
            console.error('圖片載入失敗');
            setImageError('圖片載入失敗');
          }}
        />
      );
    }
    
    return (
      <div className="image-placeholder">
        <BiCamera />
        <span>無圖片</span>
      </div>
    );
  };

  // 渲染車主查詢狀態
  const renderOwnerQueryStatus = () => {
    if (loading) {
      return (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>正在查詢車主資料...</p>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="error-state">
          <BiX className="error-icon" />
          <p>{error}</p>
          <button className="retry-btn" onClick={fetchOwnerInfo}>
            重新查詢
          </button>
        </div>
      );
    }
    
    if (ownerInfo) {
      return (
        <div className="owner-info">
          <h4>車主查詢結果</h4>
          <div className="owner-details">
            <div className="owner-field">
              <label htmlFor="owner-name">姓名</label>
              <input id="owner-name" type="text" value={ownerInfo.full_name} readOnly />
            </div>
            <div className="owner-field">
              <label htmlFor="owner-id">身分證字號</label>
              <input id="owner-id" type="text" value={ownerInfo.id_number} readOnly />
            </div>
            <div className="owner-field">
              <label htmlFor="owner-gender">性別</label>
              <input id="owner-gender" type="text" value={ownerInfo.gender || '未提供'} readOnly />
            </div>
            <div className="owner-field">
              <label htmlFor="owner-dob">出生年月日（YYYY/MM/DD ）</label>
              <input id="owner-dob" type="text" value={formatDateOfBirth(ownerInfo.date_of_birth)} readOnly />
            </div>
            <div className="owner-field">
              <label htmlFor="owner-phone">手機號碼</label>
              <input id="owner-phone" type="text" value={ownerInfo.phone_number} readOnly />
            </div>
            <div className="owner-field">
              <label htmlFor="owner-email">電子郵件</label>
              <input id="owner-email" type="text" value={ownerInfo.email || '未提供'} readOnly />
            </div>
            <div className="owner-field">
              <label htmlFor="owner-address">戶籍地址</label>
              <input id="owner-address" type="text" value={ownerInfo.address} readOnly />
            </div>
            <div className="owner-field">
              <label htmlFor="owner-vehicle-type">車輛類型</label>
              <input id="owner-vehicle-type" type="text" value={ownerInfo.vehicle_type} readOnly />
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="query-prompt">
        <BiUser className="prompt-icon" />
        <p>點擊下方按鈕查詢車牌 <strong>{violation?.plateNumber}</strong> 的車主資料</p>
        <button className="query-btn" onClick={fetchOwnerInfo}>
          開始查詢
        </button>
      </div>
    );
  };

  // 渲染步驟按鈕
  const renderStepButtons = () => {
    if (currentStep === 1) {
      return (
        <>
          <button className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" onClick={() => setCurrentStep(2)}>
            下一步
          </button>
        </>
      );
    }
    
    if (currentStep === 2) {
      return (
        <>
          <button className="btn-secondary" onClick={() => setCurrentStep(1)}>
            上一步
          </button>
          {ownerInfo && (
            <button className="btn-primary" onClick={() => setCurrentStep(3)}>
              下一步
            </button>
          )}
        </>
      );
    }
    
    if (currentStep === 3) {
      return (
        <>
          <button className="btn-secondary" onClick={() => setCurrentStep(2)}>
            上一步
          </button>
          <button 
            className="btn-success" 
            onClick={handleConfirmSend}
            disabled={loading}
          >
            <BiCheck />
            {loading ? '發送中...' : '確認發送'}
          </button>
        </>
      );
    }
    
    return null;
  };

  if (!isOpen || !violation) return null;

  const { date, time } = formatTimestamp(violation.timestamp);

  return (
    <dialog 
      open={isOpen}
      className="ticket-modal-overlay" 
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
      aria-labelledby="ticket-modal-title"
    >
      <div 
        className="ticket-modal"
      >
        <div className="ticket-modal-header">
          <h2 id="ticket-modal-title">罰單開立作業 - 違規編號：VIO-{violation.id} | 車牌：{violation.plateNumber}</h2>
          <button className="close-btn" onClick={onClose}>
            <BiX />
          </button>
        </div>

        {/* 步驟指示器 */}
        <div className="step-indicators">
          <div className={`step-indicator ${currentStep >= 1 ? 'active' : ''}`}>
            <div className="step-number">
              <BiCamera />
            </div>
            <span>違規確認</span>
          </div>
          <div className={`step-indicator ${currentStep >= 2 ? 'active' : ''}`}>
            <div className="step-number">
              <BiUser />
            </div>
            <span>車主與車輛資訊查詢</span>
          </div>
          <div className={`step-indicator ${currentStep >= 3 ? 'active' : ''}`}>
            <div className="step-number">
              <BiReceipt />
            </div>
            <span>罰單內容預覽</span>
          </div>
        </div>

        <div className="ticket-modal-content">
          {/* 步驟 1: 違規確認 */}
          {currentStep === 1 && (
            <div className="step-content">
              <h3>1. 違規確認</h3>
              
              <div className="violation-images">
                <div className="image-section">
                  <h4>違規照片</h4>
                  <div className="image-container">
                    {renderViolationImage()}
                  </div>
                </div>
              </div>

              <div className="violation-details">
                <h4>違規詳細資訊</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <BiTime />
                    <span className="label">違規時間：</span>
                    <span className="value">{date} {time}</span>
                  </div>
                  <div className="detail-item">
                    <BiMapPin />
                    <span className="label">違規地點：</span>
                    <span className="value">{violation.location}</span>
                  </div>
                  <div className="detail-item">
                    <BiCar />
                    <span className="label">違規類型：</span>
                    <span className="value">{violation.type}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 步驟 2: 車主查詢 */}
          {currentStep === 2 && (
            <div className="step-content">
              <h3>2. 車主資料</h3>
              {renderOwnerQueryStatus()}
            </div>
          )}

          {/* 步驟 3: 罰單內容預覽 */}
          {currentStep === 3 && ownerInfo && (
            <div className="step-content">
              <h3>3. 罰單內容預覽</h3>
              
              <div className="preview-sections">
                <div className="preview-section">
                  <h4>簡訊內容預覽</h4>
                  <div className="sms-preview">
                    <pre>{generateSMSContent()}</pre>
                  </div>
                </div>
                
                <div className="preview-section">
                  <h4>罰單附件預覽 (PDF)</h4>
                  <button 
                    className="pdf-preview" 
                    onClick={generatePdfPreview} 
                    aria-label="點擊查看PDF預覽"
                    style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0, width: '100%' }}
                  >
                    <div className="pdf-icon">
                      <BiReceipt />
                    </div>
                    <div className="pdf-info">
                      <span className="filename">違規罰單_VIO-{violation.id}.pdf</span>
                      <span className="file-status">
                        {pdfLoading ? '正在生成預覽...' : '點擊查看PDF預覽'}
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 模態底部按鈕 */}
        <div className="ticket-modal-footer">
          {renderStepButtons()}
        </div>
      </div>
      
      {/* PDF預覽模態 */}
      {showPdfPreview && ownerInfo && violation && (
        <dialog 
          open={showPdfPreview}
          className="pdf-preview-overlay" 
          onClick={closePdfPreview}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              closePdfPreview();
            }
          }}
          aria-labelledby="pdf-preview-title"
        >
          <div 
            className="pdf-preview-modal"
          >
            <div className="pdf-preview-header">
              <h3 id="pdf-preview-title">電子罰單PDF預覽</h3>
              <button className="close-pdf-btn" onClick={closePdfPreview}>
                <BiX />
              </button>
            </div>
            <div className="pdf-viewer">
              <iframe
                srcDoc={generateMockPdfContent()}
                width="100%"
                height="600px"
                title="PDF預覽"
                style={{ border: 'none', backgroundColor: 'white' }}
              />
            </div>
            <div className="pdf-preview-footer">
              <button className="btn-secondary" onClick={closePdfPreview}>
                關閉預覽
              </button>
            </div>
          </div>
        </dialog>
      )}
    </dialog>
  );
};

export default TicketGenerationModal;