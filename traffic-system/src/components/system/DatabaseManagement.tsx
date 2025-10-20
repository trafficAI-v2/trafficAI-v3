// src/components/system/DatabaseManagement.tsx

import React from 'react';
import {BiCloudUpload } from 'react-icons/bi';
import '../../styles/SystemManagement.css';

const DatabaseManagement: React.FC = () => {
  return (
    <div className="settings-container">
      <p className="dev-note">功能開發中：所有數值均為靜態示意資料。</p>
      
      <div className="settings-section">
        <h3 className="section-title">資料庫狀態概覽</h3>
        <div className="db-stats-grid">
          <div className="stat-item"><span>狀態</span><strong>運行中</strong></div>
          <div className="stat-item"><span>總大小</span><strong>2.5 GB</strong></div>
          <div className="stat-item"><span>連線數</span><strong>15 / 100</strong></div>
          <div className="stat-item"><span>版本</span><strong>PostgreSQL 15</strong></div>
        </div>
        <div className="header-actions" style={{ marginTop: '16px' }}>
          <button className="btn btn-primary"><BiCloudUpload /> 立即完整備份</button>
          <button className="btn btn-secondary">效能最佳化</button>
        </div>
      </div>
      
      <div className="settings-section">
        <h3 className="section-title">自動備份設定</h3>
        <div className="form-grid">
          <div className="form-group switch-group">
            <label>啟用自動備份</label>
            <div className="switch-wrapper">
              <input type="checkbox" id="db-backup-switch" className="switch" defaultChecked />
              <label htmlFor="db-backup-switch"></label>
            </div>
          </div>
          <div className="form-group">
            <label>備份頻率</label>
            <select defaultValue="daily">
              <option value="daily">每日</option>
              <option value="weekly">每週</option>
            </select>
          </div>
          <div className="form-group">
            <label>備份時間</label>
            <input type="time" defaultValue="02:00" />
          </div>
           <div className="form-group">
            <label>備份檔案保留天數</label>
            <input type="number" defaultValue="30" />
          </div>
        </div>
      </div>

      <div className="settings-footer">
        <button className="btn btn-primary">儲存備份設定</button>
      </div>
    </div>
  );
};

export default DatabaseManagement;