import React from 'react';
import { BiCloudUpload } from 'react-icons/bi';
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

          {/* ===== 【本次修改重點 1: 修正 Switch 元件】 ===== */}
          <div className="form-group switch-group">
            {/* 移除外部多餘的 label，將 input 和 有文字的 label 放在一起 */}
            <div className="switch-wrapper">
              <input type="checkbox" id="db-backup-switch" className="switch" defaultChecked />
              {/* 將文字放入這個 label，並確保 htmlFor 正確關聯 */}
              <label htmlFor="db-backup-switch">啟用自動備份</label>
            </div>
          </div>

          {/* ===== 【本次修改重點 2: 增加其他欄位的關聯】 ===== */}
          <div className="form-group">
            <label htmlFor="backup-frequency">備份頻率</label>
            <select id="backup-frequency" defaultValue="daily">
              <option value="daily">每日</option>
              <option value="weekly">每週</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="backup-time">備份時間</label>
            <input id="backup-time" type="time" defaultValue="02:00" />
          </div>

          <div className="form-group">
            <label htmlFor="backup-retention">備份檔案保留天數</label>
            <input id="backup-retention" type="number" defaultValue="30" />
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