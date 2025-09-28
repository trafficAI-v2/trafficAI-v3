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
              font-family: 'Microsoft JhengHei', sans-serif; 
              padding: 20px; 
              line-height: 1.6;
            }
            .header { 
              text-align: center; 
              border-bottom: 2px solid #333; 
              padding-bottom: 10px; 
              margin-bottom: 20px;
            }
            .content { margin: 20px 0; }
            .section { margin: 20px 0; border: 1px solid #ddd; padding: 15px; }
            .section-title { 
              font-size: 18px; 
              font-weight: bold; 
              color: #333; 
              margin-bottom: 10px;
              border-bottom: 1px solid #eee;
              padding-bottom: 5px;
            }
            .field { 
              margin: 8px 0; 
              display: flex; 
              align-items: center;
            }
            .label { 
              font-weight: bold; 
              color: #333; 
              min-width: 120px;
              display: inline-block;
            }
            .value { margin-left: 10px; }
            .violation-image {
              max-width: 300px;
              max-height: 200px;
              border: 1px solid #ddd;
              border-radius: 4px;
              margin: 10px 0;
            }
            .two-column {
              display: flex;
              gap: 20px;
            }
            .column {
              flex: 1;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>交通違規電子罰單</h1>
            <p>罰單編號: VIO-${violation!.id}</p>
            <p>開立日期: ${new Date().toLocaleDateString('zh-TW')}</p>
          </div>
          
          <div class="content">
            <div class="section">
              <div class="section-title">車主基本資料</div>
              <div class="two-column">
                <div class="column">
                  <div class="field">
                    <span class="label">車主姓名:</span>
                    <span class="value">${ownerInfo!.full_name}</span>
                  </div>
                  <div class="field">
                    <span class="label">身分證字號:</span>
                    <span class="value">${ownerInfo!.id_number}</span>
                  </div>
                  <div class="field">
                    <span class="label">性別:</span>
                    <span class="value">${ownerInfo!.gender || '未提供'}</span>
                  </div>
                  <div class="field">
                    <span class="label">出生年月日（YYYY/MM/DD ）:</span>
                    <span class="value">${formatDateOfBirth(ownerInfo!.date_of_birth)}</span>
                  </div>
                </div>
                <div class="column">
                  <div class="field">
                    <span class="label">聯絡電話:</span>
                    <span class="value">${ownerInfo!.phone_number}</span>
                  </div>
                  <div class="field">
                    <span class="label">電子郵件:</span>
                    <span class="value">${ownerInfo!.email || '未提供'}</span>
                  </div>
                  <div class="field">
                    <span class="label">戶籍地址:</span>
                    <span class="value">${ownerInfo!.address}</span>
                  </div>
                  <div class="field">
                    <span class="label">車輛類型:</span>
                    <span class="value">${ownerInfo!.vehicle_type}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">違規詳細資訊</div>
              <div class="two-column">
                <div class="column">
                  <div class="field">
                    <span class="label">車牌號碼:</span>
                    <span class="value">${violation!.plateNumber}</span>
                  </div>
                  <div class="field">
                    <span class="label">違規類型:</span>
                    <span class="value">${violation!.type}</span>
                  </div>
                  <div class="field">
                    <span class="label">違規時間:</span>
                    <span class="value">${date} ${time}</span>
                  </div>
                  <div class="field">
                    <span class="label">違規地點:</span>
                    <span class="value">${violation!.location}</span>
                  </div>
                </div>
                <div class="column">
                  <div class="section-title">違規照片</div>
                  ${violationImage ? 
                    `<img src="data:image/jpeg;base64,${violationImage}" alt="違規照片" class="violation-image" />` : 
                    '<p style="color: #666; font-style: italic;">無法載入違規照片</p>'
                  }
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">注意事項</div>
              <p>接獲違反道路交通管理事件電子通知單後，依所記載「應到案日期」前往監理所、站接受裁處或以郵繳即時銷案、電話語音轉帳、網路方式繳納罰鍰。並請於「應到案日期」前，以電話查詢該交通違規案件是否已由舉發單位移送至應到案處所，避免徒勞往返。

如發現接獲之違反道路交通管理事件通知單上所填載之車牌號碼或被通知人姓名有疑問，請於應到案日期前向原舉發單位或監理所、站提出書面申請要求更正，以免逾越繳納期限，受加重處罰。</p>
              
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

  // 格式化出生年月日
  const formatDateOfBirth = (dateString: string): string => {
    if (!dateString) return '未提供';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '未提供';
      
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

  if (!isOpen || !violation) return null;

  const { date, time } = formatTimestamp(violation.timestamp);

  return (
    <div className="ticket-modal-overlay" onClick={onClose}>
      <div className="ticket-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ticket-modal-header">
          <h2>罰單開立作業 - 違規編號：VIO-{violation.id} | 車牌：{violation.plateNumber}</h2>
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
                    {imageLoading ? (
                      <div className="image-placeholder">
                        <BiCamera />
                        <span>載入中...</span>
                      </div>
                    ) : imageError ? (
                      <div className="image-placeholder">
                        <BiCamera />
                        <span>❌ {imageError}</span>
                      </div>
                    ) : violationImage ? (
                      <img 
                        src={`data:image/jpeg;base64,${violationImage}`} 
                        alt={`車牌 ${violation.plateNumber} 的違規照片`}
                        onError={() => {
                          console.error('圖片載入失敗');
                          setImageError('圖片載入失敗');
                        }}
                      />
                    ) : (
                      <div className="image-placeholder">
                        <BiCamera />
                        <span>無圖片</span>
                      </div>
                    )}
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
              
              {loading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>正在查詢車主資料...</p>
                </div>
              ) : error ? (
                <div className="error-state">
                  <BiX className="error-icon" />
                  <p>{error}</p>
                  <button className="retry-btn" onClick={fetchOwnerInfo}>
                    重新查詢
                  </button>
                </div>
              ) : ownerInfo ? (
                <div className="owner-info">
                  <h4>車主查詢結果</h4>
                  <div className="owner-details">
                    <div className="owner-field">
                      <label>姓名</label>
                      <input type="text" value={ownerInfo.full_name} readOnly />
                    </div>
                    <div className="owner-field">
                      <label>身分證字號</label>
                      <input type="text" value={ownerInfo.id_number} readOnly />
                    </div>
                    <div className="owner-field">
                      <label>性別</label>
                      <input type="text" value={ownerInfo.gender || '未提供'} readOnly />
                    </div>
                    <div className="owner-field">
                      <label>出生年月日（YYYY/MM/DD ）</label>
                      <input type="text" value={formatDateOfBirth(ownerInfo.date_of_birth)} readOnly />
                    </div>
                    <div className="owner-field">
                      <label>手機號碼</label>
                      <input type="text" value={ownerInfo.phone_number} readOnly />
                    </div>
                    <div className="owner-field">
                      <label>電子郵件</label>
                      <input type="text" value={ownerInfo.email || '未提供'} readOnly />
                    </div>
                    <div className="owner-field">
                      <label>戶籍地址</label>
                      <input type="text" value={ownerInfo.address} readOnly />
                    </div>
                    <div className="owner-field">
                      <label>車輛類型</label>
                      <input type="text" value={ownerInfo.vehicle_type} readOnly />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="query-prompt">
                  <BiUser className="prompt-icon" />
                  <p>點擊下方按鈕查詢車牌 <strong>{violation.plateNumber}</strong> 的車主資料</p>
                  <button className="query-btn" onClick={fetchOwnerInfo}>
                    開始查詢
                  </button>
                </div>
              )}
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
                  <div className="pdf-preview" onClick={generatePdfPreview} style={{ cursor: 'pointer' }}>
                    <div className="pdf-icon">
                      <BiReceipt />
                    </div>
                    <div className="pdf-info">
                      <span className="filename">違規罰單_VIO-{violation.id}.pdf</span>
                      <span className="file-status">
                        {pdfLoading ? '正在生成預覽...' : '點擊查看PDF預覽'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 模態底部按鈕 */}
        <div className="ticket-modal-footer">
          {currentStep === 1 && (
            <>
              <button className="btn-secondary" onClick={onClose}>
                取消
              </button>
              <button className="btn-primary" onClick={() => setCurrentStep(2)}>
                下一步
              </button>
            </>
          )}
          
          {currentStep === 2 && (
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
          )}
          
          {currentStep === 3 && (
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
          )}
        </div>
      </div>
      
      {/* PDF預覽模態 */}
      {showPdfPreview && ownerInfo && violation && (
        <div className="pdf-preview-overlay" onClick={closePdfPreview}>
          <div className="pdf-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pdf-preview-header">
              <h3>電子罰單PDF預覽</h3>
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
        </div>
      )}
    </div>
  );
};

export default TicketGenerationModal;