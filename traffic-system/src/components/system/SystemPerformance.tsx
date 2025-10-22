import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import '../../styles/SystemManagement.css';

// --- 型別定義 ---
interface PerformanceData {
  cpu: { percent: number };
  memory: { percent: number; total_gb: number };
  disk: { percent: number; total_gb: number };
  network: { sent_gb: number; recv_gb: number };
}

const SystemPerformance: React.FC = () => {
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    const fetchPerformanceData = async () => {
      if (!token) return;
      
      try {
        const data = await apiService.get<PerformanceData>('/api/system/performance');
        setPerformanceData(data);
      } catch (err) {
        setError('無法獲取效能數據，請稍後再試。');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPerformanceData(); // 立即執行一次
    const interval = setInterval(fetchPerformanceData, 5000); // 每 5 秒刷新一次
    
    return () => clearInterval(interval); // 元件卸載時清除定時器
  }, [token]);

  const getProgressBarColor = (percent: number): string => {
    if (percent > 80) return 'red';
    if (percent > 60) return 'yellow';
    return 'green';
  };

  if (isLoading) return <p>正在載入效能數據...</p>;
  if (error) return <p className="error-message">{error}</p>;
  if (!performanceData) return <p>沒有可用的效能數據。</p>;

  return (
    <div className="settings-container">
      <div className="settings-section">
        <h3 className="section-title">即時效能監控 (web_api 容器)</h3>
        <div className="performance-grid">
          {/* CPU */}
          <div className="performance-item">
            <span className="item-label">CPU 使用率</span>
            <div className={`progress-bar ${getProgressBarColor(performanceData.cpu.percent)}`}>
              <div style={{ width: `${performanceData.cpu.percent}%` }}></div>
            </div>
            <span className="item-value">{performanceData.cpu.percent.toFixed(1)}%</span>
          </div>
          {/* Memory */}
          <div className="performance-item">
            <span className="item-label">記憶體使用率</span>
            <div className={`progress-bar ${getProgressBarColor(performanceData.memory.percent)}`}>
              <div style={{ width: `${performanceData.memory.percent}%` }}></div>
            </div>
            <span className="item-value">{performanceData.memory.percent.toFixed(1)}%</span>
          </div>
          {/* Disk */}
          <div className="performance-item">
            <span className="item-label">磁碟使用率</span>
            <div className={`progress-bar ${getProgressBarColor(performanceData.disk.percent)}`}>
              <div style={{ width: `${performanceData.disk.percent}%` }}></div>
            </div>
            <span className="item-value">{performanceData.disk.percent.toFixed(1)}%</span>
          </div>
          {/* Network */}
           <div className="performance-item">
            <span className="item-label">網路總傳輸</span>
            <span>-</span>
            <span className="item-value">
              ↑ {performanceData.network.sent_gb} GB / ↓ {performanceData.network.recv_gb} GB
            </span>
          </div>
        </div>
      </div>
      {/* ... 其他警報設定等靜態區塊 ... */}
    </div>
  );
};

export default SystemPerformance;