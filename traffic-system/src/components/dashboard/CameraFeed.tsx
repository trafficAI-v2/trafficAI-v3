import React, { useState, useEffect } from 'react';
// 确保 Camera 类型中有 id 和 name
import type { Camera, ViolationType } from '../../types'; 
import { BiPlay, BiStop } from 'react-icons/bi';
import DeviceStatusList from './DeviceStatusList'; 
import ManualAnnotationTab from './ManualAnnotationTab';

const TABS = ['即時監控', '影像設定', '手動標註'];

// 从环境变数读取 API 的基础 URL (例如 http://localhost:5001)
const DETECT_BASE_URL = import.meta.env.VITE_DETECT_API_URL || 'http://localhost:5001';

const CameraFeed: React.FC = () => {
  // --- 所有状态都将被保留 ---
  const [activeTab, setActiveTab] = useState<string>(TABS[0]);
  const [confidence, setConfidence] = useState<number>(70);
  const [brightness, setBrightness] = useState<number>(50);
  const [contrast, setContrast] = useState<number>(50);
  const [zoom, setZoom] = useState<number>(50); 
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('0'); // (修改) 预设选中 '0'
  const [loading, setLoading] = useState<boolean>(false); // (修改) 初始 loading 可以是 false
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // (新增) 侦测相关状态
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [detectionStatus, setDetectionStatus] = useState<string>('已停止');
  const [videoStreamUrl, setVideoStreamUrl] = useState<string | null>(null);

  // --- 副作用 ---
  
  // (修改) 这个 useEffect 现在只用来设定预设的摄影机选项
  useEffect(() => {
    // 我们可以直接设定内建和外接镜头的选项
    const defaultCameras: Camera[] = [
      { id: '0', name: '內建鏡頭 (0)' },
      { id: '1', name: '外接鏡頭 (1)' }
    ];
    setCameras(defaultCameras);
    setSelectedCameraId(defaultCameras[0].id); // 预设选中第一个
  }, []);

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timerId);
  }, []);
  
  // --- (新增) API 互动函式 ---
  const handleStartDetection = async () => {
    if (isDetecting) return;
    setDetectionStatus('正在啟動...');
    setError(null);

    try {
      if (!DETECT_BASE_URL) throw new Error("API 位址未設定 (VITE_DETECT_API_URL)");

      const response = await fetch(`${DETECT_BASE_URL}/start_detection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_path: selectedCameraId })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || '啟動偵測失敗');
      }

      const data = await response.json();
      if (data.status === 'success') {
        // 加上时间戳参数来防止快取
        setVideoStreamUrl(`${DETECT_BASE_URL}/video_feed?t=${new Date().getTime()}`);
        setIsDetecting(true);
        setDetectionStatus('運行中');
      } else {
        throw new Error(data.message || '後端返回成功狀態失敗');
      }
    } catch (err: any) {
      console.error('啟動偵測時發生錯誤:', err);
      setError(err.message);
      setDetectionStatus('錯誤');
    }
  };

  const handleStopDetection = async () => {
    if (!isDetecting) return;
    setDetectionStatus('正在停止...');

    try {
      if (!DETECT_BASE_URL) throw new Error("API 位址未設定 (VITE_DETECT_API_URL)");

      const response = await fetch(`${DETECT_BASE_URL}/stop_detection`, { method: 'POST' });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || '停止偵測失敗');
      }
      const data = await response.json();
      if (data.status === 'success') {
        setVideoStreamUrl(null);
        setIsDetecting(false);
        setDetectionStatus('已停止');
      } else {
        throw new Error(data.message || '後端返回成功狀態失敗');
      }
    } catch (err: any) {
      console.error('停止偵測時發生錯誤:', err);
      setError(err.message);
      setDetectionStatus('錯誤');
    }
  };

  // --- 条件渲染 (如果需要的话) ---
  if (loading) {
    return <div className="panel camera-feed-panel"><p>正在載入資料...</p></div>;
  }

  return (
    <div className="panel camera-feed-panel">
      <div className="panel-header">
        <h2>即時攝影機串流</h2>
        <span>自動檢測交通違規行為</span>
      </div>

      <div className="segmented-control">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      
      <div className="tab-content">
        {activeTab === '即時監控' && (
          <>
            <div className="controls-bar">
              <select 
                value={selectedCameraId} 
                onChange={(e) => setSelectedCameraId(e.target.value)} 
                disabled={isDetecting || cameras.length === 0}
              >
                {cameras.map(cam => (
                  <option key={cam.id} value={cam.id}>{cam.name}</option>
                ))}
              </select>
              <button className="start-button" onClick={handleStartDetection} disabled={isDetecting}>
                <BiPlay />
                <span>開始偵測</span>
              </button>
              <button className="stop-button" onClick={handleStopDetection} disabled={!isDetecting}>
                <BiStop />
                <span>停止偵測</span>
              </button>
            </div>
            
            <div className="detection-status-bar">
              <strong>狀態: </strong>
              <span className={`status-${isDetecting ? 'running' : 'stopped'}`}>
                {detectionStatus}
              </span>
              {error && <span className="error-message"> | 錯誤: {error}</span>}
            </div>

            <div className="video-container">
              {isDetecting && videoStreamUrl ? (
                <img 
                  src={videoStreamUrl} 
                  alt="即時影像串流" 
                  className="live-stream-image"
                  onError={() => { // (新增) 错误处理，防止图片损坏图示
                      setError('影像串流載入失敗，請檢查後端日誌。');
                      setIsDetecting(false);
                      setDetectionStatus('錯誤');
                      setVideoStreamUrl(null);
                  }}
                />
              ) : (
                <div className="mock-video-stream">
                  <p className="stream-placeholder-text">點擊「開始偵測」以顯示即時影像</p>
                </div>
              )}
              
              <div className="video-overlay-header">
                <div className="video-overlay-top">
                  <span>{cameras.find(c => c.id === selectedCameraId)?.name || '未選擇攝影機'}</span>
                  <span className={`camera-status-dot ${isDetecting ? 'online' : 'offline'}`}></span>
                </div>
                <div className="video-overlay-timestamp">
                  <span>
                    {currentTime.toLocaleString('zh-TW', {
                      year: 'numeric', month: 'numeric', day: '2-digit',
                      hour: '2-digit', minute: '2-digit', second: '2-digit',
                      hour12: false
                    }).replace(/\//g, '-')}
                  </span>
                </div>
              </div>
            </div>

            <div className="confidence-slider-container">
               <div className="slider-header">
                <label htmlFor="confidence">信心度篩選:</label>
                <span className="slider-value">{confidence}%</span>
              </div>
              <input
                id="confidence"
                type="range"
                min="0"
                max="100"
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
                className="custom-slider"
                style={{
                  background: `linear-gradient(to right, #333 ${confidence}%, #e9e9e9 ${confidence}%)`
                }}
              />
              <p className="slider-description">僅顯示信心度高於閾值的檢測結果</p>
            </div>
          </>
        )}

        {activeTab === '影像設定' && (
          <>
            <div className="video-adjustment-panel">
              <p className='video-adjust'>影像參數設定</p>
              <div className="slider-header">
                <label htmlFor="brightness">亮度</label>
                <span className="slider-value">{brightness}%</span>
              </div>
              <input
                id="brightness"
                type="range"
                min="0"
                max="100"
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="custom-slider"
                style={{
                  background: `linear-gradient(to right, #333 ${brightness}%, #e9e9e9 ${brightness}%)`
                }}
              />
              <div className="slider-header">
                <label htmlFor="contrast">對比度</label>
                <span className="slider-value">{contrast}%</span>
              </div>
              <input
                id="contrast"
                type="range"
                min="0"
                max="100"
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="custom-slider"
                style={{
                  background: `linear-gradient(to right, #333 ${contrast}%, #e9e9e9 ${contrast}%)`
                }}
              />
              <div className="slider-header">
                <label htmlFor="zoom">放大倍率</label>
                <span className="slider-value">{zoom}%</span>
              </div>
              <input
                id="zoom"
                type="range"
                min="0"
                max="100"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="custom-slider"
                style={{
                  background: `linear-gradient(to right, #333 ${zoom}%, #e9e9e9 ${zoom}%)`
                }}
              />
            </div>
            <div className="device-status-wrapper">
              <p className="video-devices-list">影像設備狀態列表</p>
              <DeviceStatusList />
            </div>
          </>
        )}
        
        {activeTab === '手動標註' && (
          <ManualAnnotationTab />
        )}
      </div>

      <div className="ai-status-footer">
        <p><strong>AI 輔-助檢測中</strong></p>
        <p>系統正在自動檢測交通違規行為，檢測到的違規將顯示在右側面板中。</p>
      </div>
    </div>
  );
};

export default CameraFeed;