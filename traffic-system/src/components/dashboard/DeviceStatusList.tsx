//影像設定-設備狀態列表
import React, { useState, useEffect } from 'react';
import './DeviceStatusList.css';

type DeviceStatus = 'online' | 'offline'; 

export interface Device {
  id: number | string;
  name: string;
  status: DeviceStatus;
}


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const DeviceStatusList: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!API_BASE_URL) {
      console.error("錯誤：環境變數 VITE_API_BASE_URL 未設定。請在專案根目錄建立 .env.local 檔案。");
      setError("前端設定錯誤：未找到 API 位址。");
      setLoading(false);
      return; 
    }

    const fetchDevices = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/cameras/status`);
        if (!response.ok) {
          throw new Error(`伺服器回應錯誤: ${response.status}`);
        }
        const data: Device[] = await response.json();
        setDevices(data);
      } catch (e: any) {
        setError(e.message);
        console.error("獲取設備失敗:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
    const intervalId = setInterval(fetchDevices, 30000);
    return () => clearInterval(intervalId);
  }, []); 

  // --- 輔助函式 ---
  const getStatusClass = (status: DeviceStatus): 'online' | 'offline' => {
    return status === 'online' ? 'online' : 'offline';
  };

  const getStatusText = (status: DeviceStatus): string => {
    return status === 'online' ? '運作中' : '離線';
  };

  // --- 條件渲染 ---
  if (loading) {
    return <div className="device-status-list-container status-message">正在載入設備列表...</div>;
  }

  if (error) {
    return <div className="device-status-list-container status-message error">讀取失敗: {error}</div>;
  }

  return (
    <div className="device-status-list-container">
      <ul className="device-list">
        {devices.length === 0 ? (
          <li className="no-devices-prompt">目前沒有任何設備。</li>
        ) : (
          devices.map(device => (
            <li key={device.id} className="device-list-item">
              <div className="device-info">
                <span className={`status-dot ${getStatusClass(device.status)}`}></span>
                {/* 顯示 ID 和名稱 */}
                <span className="device-id">{device.id}</span>
                <span className="device-name">({device.name})</span>
              </div>
              <span className={`status-text ${getStatusClass(device.status)}`}> 
                {getStatusText(device.status)}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default DeviceStatusList;