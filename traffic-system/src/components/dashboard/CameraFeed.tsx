import React, { useState, useEffect } from 'react';
// 確保 Camera 類型中有 id 和 name
import type { Camera } from '../../types'; 
import { BiPlay, BiStop } from 'react-icons/bi';
import DeviceStatusList from './DeviceStatusList'; 
import ManualAnnotationTab from './ManualAnnotationTab';

const TABS = ['即時監控', '影像設定', '手動標註'];

// 假設 Camera 類型的定義，根據您的註解和修正，它應該看起來像這樣：
// export interface Camera {
//   id: number | string; // 新增唯一的 ID
//   name: string;
// }

const CameraFeed: React.FC = () => {
  // --- 所有状态都将被保留 ---
  const [activeTab, setActiveTab] = useState<string>(TABS[0]);
  const [confidence, setConfidence] = useState<number>(70);
  const [brightness, setBrightness] = useState<number>(50);
  const [contrast, setContrast] = useState<number>(50);
  const [zoom, setZoom] = useState<number>(50); 
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- 副作用 ---
  useEffect(() => {
    const API_BASE_URL = import.meta.env.VITE_CAMERA_LIST_URL;
    
    // --- 錯誤修正 1：使用 AbortController 來清理非同步操作 ---
    const controller = new AbortController();
    const signal = controller.signal;

    if (!API_BASE_URL) {
      console.error("錯誤：環境變數 VITE_API_BASE_URL 未設定。");
      setError("前端設定錯誤：未找到 API 位址。");
      setLoading(false);
      return;
    }

    const fetchCameras = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}`, { signal }); // 將 signal 傳入 fetch
        if (!response.ok) {
          throw new Error(`獲取攝影機列表失敗: ${response.status}`);
        }
        
        const rawData: { camera_name: string }[] = await response.json();

        // --- 錯誤修正 2：在轉換資料時，為每個項目添加唯一的 id ---
        const formattedData: Camera[] = rawData.map((item, index) => ({
          id: index.toString(), // 將索引轉換為字串作為唯一的 key
          name: item.camera_name,
        }));

        setCameras(formattedData);

        if (formattedData.length > 0) {
          setSelectedCamera(formattedData[0].name);
        }

      } catch (err: any) {
        // 如果錯誤是因請求被中止而引起的，則不要更新狀態
        if (err.name === 'AbortError') {
          console.log('Fetch aborted');
        } else {
          setError(err.message);
          console.error("Failed to fetch cameras:", err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCameras();
    
    // 返回一個清理函式，當組件卸載時，它會被呼叫
    return () => {
      controller.abort();
    };
  }, []); // 空依賴陣列確保此 effect 只在掛載和卸載時運行一次

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timerId);
  }, []);

  // --- 条件渲染 ---
  if (loading) {
    return <div className="panel camera-feed-panel"><p>正在載入攝影機資料...</p></div>;
  }
  if (error) {
    return <div className="panel camera-feed-panel"><p className="text-red-500">錯誤: {error}</p></div>;
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
                value={selectedCamera} 
                onChange={(e) => setSelectedCamera(e.target.value)} 
                disabled={cameras.length === 0}
              >
                {cameras.length === 0 ? (
                  <option>無可用攝影機</option>
                ) : (
                  // --- 錯誤修正 2：使用 cam.id 作為 key ---
                  cameras.map(cam => (
                    <option key={cam.id} value={cam.name}>{cam.name}</option>
                  ))
                )}
              </select>
              <button className="start-button">
                <BiPlay />
                <span>開始偵測</span>
              </button>
              <button className="stop-button">
                <BiStop />
                <span>停止偵測</span>
              </button>
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

            <div className="video-container">
              <div className="mock-video-stream">
                <div className="video-overlay-header">
                  <div className="video-overlay-top">
                    <span>{selectedCamera || '未選擇攝影機'}</span>
                    <span className="camera-status-dot"></span>
                  </div>
                  <div className="video-overlay-timestamp">
                    <span>
                      {currentTime.toLocaleString('zh-TW', {
                        year: 'numeric', month: 'numeric', day: 'numeric',
                        hour: 'numeric', minute: 'numeric', second: 'numeric',
                        hour12: true,
                      })}
                    </span>
                  </div>
                </div>
              </div>
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