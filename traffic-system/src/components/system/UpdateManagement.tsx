// src/components/system/UpdateManagement.tsx

import React from 'react';
import '../../styles/SystemManagement.css';

const UpdateManagement: React.FC = () => {
  return (
    <div className="settings-container">
      <p className="dev-note">功能開發中：所有數值均為靜態示意資料。</p>

      <div className="settings-section">
        <h3 className="section-title">版本資訊</h3>
        <div className="db-stats-grid">
          <div className="stat-item"><span>目前版本</span><strong>v2.1.0</strong></div>
          <div className="stat-item"><span>狀態</span><strong style={{color: '#52c41a'}}>已是最新版本</strong></div>
          <div className="stat-item"><span>上次檢查時間</span><strong>剛剛</strong></div>
        </div>
         <div className="header-actions" style={{ marginTop: '16px' }}>
          <button className="btn btn-primary">立即檢查更新</button>
        </div>
      </div>
      
      <div className="settings-section">
        <h3 className="section-title">更新設定</h3>
        <div className="form-grid">
          <div className="form-group switch-group">
            <label htmlFor="auto-update-switch">自動下載並安裝更新</label>
            <div className="switch-wrapper">
              <input type="checkbox" id="auto-update-switch" className="switch" defaultChecked />
              <label htmlFor="auto-update-switch" className="switch-label"></label>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="update-channel">更新頻道</label>
            <select id="update-channel" defaultValue="stable">
              <option value="stable">穩定版 (Stable)</option>
              <option value="beta">測試版 (Beta)</option>
            </select>
          </div>
           <div className="form-group switch-group">
            <label htmlFor="backup-before-update-switch">更新前自動備份</label>
            <div className="switch-wrapper">
              <input type="checkbox" id="backup-before-update-switch" className="switch" defaultChecked />
              <label htmlFor="backup-before-update-switch" className="switch-label"></label>
            </div>
          </div>
        </div>
      </div>
      
       <div className="settings-footer">
        <button className="btn btn-primary">儲存更新設定</button>
      </div>
    </div>
  );
};

export default UpdateManagement;