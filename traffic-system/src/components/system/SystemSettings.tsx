// src/components/system/SystemSettings.tsx

import React from 'react';
import { BiSave, BiReset } from 'react-icons/bi';
import '../../styles/SystemManagement.css'; // 我們可以繼續共用這個 CSS 檔案的樣式

const SystemSettings: React.FC = () => {
  return (
    <div className="settings-container">
      {/* --- 區塊 1: 系統基本資訊設定 --- */}
      <div className="settings-section">
        <h3 className="section-title">1. 系統基本資訊</h3>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="system-name">系統名稱</label>
            <input id="system-name" type="text" defaultValue="Traffic AI 智慧交通執法系統" />
          </div>
          <div className="form-group">
            <label htmlFor="system-version">系統版本</label>
            <input id="system-version" type="text" value="v2.1.0 (開發中)" readOnly />
          </div>
          <div className="form-group">
            <label htmlFor="system-language">系統語言</label>
            <select id="system-language" defaultValue="zh-TW">
              <option value="zh-TW">繁體中文</option>
              <option value="en-US">English (開發中)</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="system-timezone">系統時區</label>
            <select id="system-timezone" defaultValue="Asia/Taipei">
              <option value="Asia/Taipei">Asia/Taipei (GMT+8)</option>
              <option value="UTC">UTC (開發中)</option>
            </select>
          </div>
          <div className="form-group switch-group">
            <label htmlFor="maintenance-switch">維護模式</label>
            <div className="switch-wrapper">
              <input type="checkbox" id="maintenance-switch" className="switch" />
              <label htmlFor="maintenance-switch" className="switch-label"></label>
              <span>啟用後將暫時關閉系統，僅管理員可登入。</span>
            </div>
          </div>
          <div className="form-group switch-group">
            <label htmlFor="debug-switch">除錯模式</label>
            <div className="switch-wrapper">
              <input type="checkbox" id="debug-switch" className="switch" defaultChecked />
              <label htmlFor="debug-switch" className="switch-label"></label>
              <span>啟用後將記錄更詳細的系統日誌。</span>
            </div>
          </div>
          <div className="form-group slider-group">
            <label htmlFor="max-connections">最大同時連線數: 100</label>
            <input id="max-connections" type="range" min="10" max="500" defaultValue="100" />
          </div>
          <div className="form-group slider-group">
            <label htmlFor="session-timeout">工作階段逾時 (分鐘): 30</label>
            <input id="session-timeout" type="range" min="5" max="120" defaultValue="30" />
          </div>
        </div>
      </div>

      {/* --- 區塊 2: 資料管理設定 --- */}
      <div className="settings-section">
        <h3 className="section-title">2. 資料管理設定</h3>
        <div className="form-grid">
            <div className="form-group">
                <label htmlFor="retention-period">違規紀錄保留期限</label>
                <select id="retention-period" defaultValue="365">
                    <option value="90">90 天</option>
                    <option value="180">180 天</option>
                    <option value="365">1 年</option>
                    <option value="0">永久保留</option>
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="cleanup-schedule">自動清理排程</label>
                <select id="cleanup-schedule" defaultValue="daily">
                    <option value="daily">每日</option>
                    <option value="weekly">每週</option>
                    <option value="monthly">每月</option>
                </select>
            </div>
            <div className="form-group switch-group">
                <label htmlFor="cleanup-switch">自動清理過期資料</label>
                <div className="switch-wrapper">
                    <input type="checkbox" id="cleanup-switch" className="switch" defaultChecked />
                    <label htmlFor="cleanup-switch" className="switch-label"></label>
                </div>
            </div>
            <div className="form-group switch-group">
                <label htmlFor="archive-switch">刪除前先封存</label>
                <div className="switch-wrapper">
                    <input type="checkbox" id="archive-switch" className="switch" defaultChecked />
                    <label htmlFor="archive-switch" className="switch-label"></label>
                </div>
            </div>
        </div>
        {/* 資料使用統計的部分先用文字表示 */}
        <div className="data-usage-placeholder">
          <p><b>資料使用統計：</b>違規紀錄 (XXX 筆, XX GB) / 罰單紀錄 (XXX 筆, XX GB)</p>
        </div>
      </div>
      
      {/* --- 區塊 3: 通知設定 --- */}
      <div className="settings-section">
        <h3 className="section-title">3. 通知設定 (開發中)</h3>
        <p className="dev-note">此區塊功能正在開發中，以下為功能示意。</p>
        <div className="form-grid">
          <div className="form-group switch-group">
            <label htmlFor="email-switch">電子郵件通知總開關</label>
            <div className="switch-wrapper"><input type="checkbox" id="email-switch" className="switch" defaultChecked /><label htmlFor="email-switch" className="switch-label"></label></div>
          </div>
          <div className="form-group switch-group">
            <label htmlFor="sms-switch">簡訊通知總開關</label>
            <div className="switch-wrapper"><input type="checkbox" id="sms-switch" className="switch" disabled /><label htmlFor="sms-switch" className="switch-label"></label></div>
          </div>
          <div className="form-group switch-group">
            <label htmlFor="line-switch">LINE 通知總開關</label>
            <div className="switch-wrapper"><input type="checkbox" id="line-switch" className="switch" disabled /><label htmlFor="line-switch" className="switch-label"></label></div>
          </div>
          {/* 其他子開關可以未來再加入 */}
        </div>
      </div>

      {/* --- 儲存與重設按鈕 --- */}
      <div className="settings-footer">
        <button className="btn btn-secondary"><BiReset /> 重設為預設值</button>
        <button className="btn btn-primary"><BiSave /> 儲存所有設定</button>
      </div>
    </div>
  );
};

export default SystemSettings;