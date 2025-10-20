// src/components/system/IntegrationSettings.tsx

import React from 'react';
import '../../styles/SystemManagement.css';

const IntegrationSettings: React.FC = () => {
  return (
    <div className="settings-container">
      <p className="dev-note">功能開發中：所有數值均為靜態示意資料。</p>

      <div className="settings-section">
        <h3 className="section-title">整合狀態概覽</h3>
        <div className="db-stats-grid">
          <div className="stat-item"><span>總整合數</span><strong>5</strong></div>
          <div className="stat-item"><span>已啟用</span><strong>3</strong></div>
          <div className="stat-item"><span>狀態異常</span><strong style={{color: '#f5222d'}}>1</strong></div>
        </div>
      </div>
      
      <div className="settings-section">
        <h3 className="section-title">服務整合設定</h3>
        <div className="integration-list">
          <div className="integration-item">
            <span>車管所資料庫</span>
            <div className="switch-wrapper">
              <input type="checkbox" id="integ-1" className="switch" defaultChecked />
              <label htmlFor="integ-1"></label>
            </div>
            <button className="btn btn-secondary">配置</button>
          </div>
          <div className="integration-item">
            <span>金流系統 (罰單繳費)</span>
            <div className="switch-wrapper">
              <input type="checkbox" id="integ-2" className="switch" disabled />
              <label htmlFor="integ-2"></label>
            </div>
             <button className="btn btn-secondary">配置</button>
          </div>
           <div className="integration-item">
            <span>LINE 通知服務</span>
            <div className="switch-wrapper">
              <input type="checkbox" id="integ-3" className="switch" />
              <label htmlFor="integ-3"></label>
            </div>
             <button className="btn btn-secondary">配置</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationSettings;