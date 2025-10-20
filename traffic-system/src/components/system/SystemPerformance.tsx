// src/components/system/SystemPerformance.tsx

import React from 'react';
import '../../styles/SystemManagement.css'; // 我們繼續共用這個 CSS

const SystemPerformance: React.FC = () => {
  return (
    <div className="settings-container">
      <p className="dev-note">功能開發中：所有數值均為靜態示意資料。</p>
      
      {/* 效能圖表分頁 */}
      <div className="settings-section">
        <h3 className="section-title">即時效能監控</h3>
        <div className="performance-grid">
          {/* CPU */}
          <div className="performance-item">
            <span className="item-label">CPU 使用率</span>
            <div className="progress-bar yellow"><div style={{ width: '45%' }}></div></div>
            <span className="item-value">45%</span>
          </div>
          {/* Memory */}
          <div className="performance-item">
            <span className="item-label">記憶體使用率</span>
            <div className="progress-bar green"><div style={{ width: '62%' }}></div></div>
            <span className="item-value">62%</span>
          </div>
          {/* Disk */}
          <div className="performance-item">
            <span className="item-label">磁碟使用率</span>
            <div className="progress-bar red"><div style={{ width: '85%' }}></div></div>
            <span className="item-value">85%</span>
          </div>
          {/* Network */}
          <div className="performance-item">
            <span className="item-label">網路流量</span>
            <div className="progress-bar green"><div style={{ width: '20%' }}></div></div>
            <span className="item-value">20 Mbps</span>
          </div>
        </div>
      </div>

      {/* 警報設定分頁 */}
      <div className="settings-section">
        <h3 className="section-title">警報設定</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>CPU 警告閾值 (%)</label>
            <input type="number" defaultValue="80" />
          </div>
          <div className="form-group">
            <label>記憶體警告閾值 (%)</label>
            <input type="number" defaultValue="85" />
          </div>
          <div className="form-group">
            <label>磁碟警告閾值 (%)</label>
            <input type="number" defaultValue="90" />
          </div>
          <div className="form-group">
            <label>網路流量警告閾值 (Mbps)</label>
            <input type="number" defaultValue="100" />
          </div>
        </div>
      </div>

      <div className="settings-footer">
        <button className="btn btn-primary">儲存警報設定</button>
      </div>
    </div>
  );
};

export default SystemPerformance;