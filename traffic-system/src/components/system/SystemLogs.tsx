// src/components/system/SystemLogs.tsx

import React from 'react';
import { BiSearch, BiRefresh, BiExport } from 'react-icons/bi';
import '../../styles/SystemManagement.css'; // 繼續共用樣式

// --- 假資料，用於展示 UI ---
const fakeLogs = [
  { id: 1024, timestamp: '2025-10-08 10:30:15', username: 'bronny', module: '使用者管理', level: 'INFO', action: '建立新使用者', details: '成功建立使用者 op02' },
  { id: 1023, timestamp: '2025-10-08 10:28:45', username: 'op01', module: '違規管理', level: 'INFO', action: '更新違規狀態', details: '將違規 VIO-82 的狀態更新為 "已確認"' },
  { id: 1022, timestamp: '2025-10-08 10:25:02', username: 'bronny', module: '系統設定', level: 'WARNING', action: '更新系統參數', details: '將 AI 信心度閾值調整為 0.70' },
  { id: 1021, timestamp: '2025-10-08 09:15:11', username: '系統', module: '資料庫', level: 'ERROR', action: '備份失敗', details: '無法連線至遠端儲存空間' },
];

const SystemLogs: React.FC = () => {
  return (
    <div className="logs-container">
      {/* --- 區塊 1: 篩選與工具列 --- */}
      <div className="filter-toolbar">
        <div className="search-bar">
          <BiSearch />
          <input type="text" placeholder="搜尋日誌ID、使用者、操作..." />
        </div>
        <div className="filter-options">
          <select defaultValue="">
            <option value="">所有等級</option>
            <option value="INFO">資訊 (INFO)</option>
            <option value="WARNING">警告 (WARNING)</option>
            <option value="ERROR">錯誤 (ERROR)</option>
          </select>
          <select defaultValue="">
            <option value="">所有模組</option>
            <option value="使用者管理">使用者管理</option>
            <option value="違規管理">違規管理</option>
            <option value="系統設定">系統設定</option>
          </select>
          <input type="date" />
          <button className="btn btn-secondary"><BiRefresh /> 重新整理</button>
          <button className="btn btn-primary"><BiExport /> 匯出 CSV</button>
        </div>
      </div>

      {/* --- 區塊 2: 日誌列表 --- */}
      <div className="log-table-container">
        <p className="dev-note" style={{ margin: '0 0 16px' }}>功能開發中：以下為日誌顯示樣式與篩選功能示意</p>
        <div className="user-table-container">
          <table className="user-table">
            <thead>
              <tr>
                <th>時間</th>
                <th>使用者</th>
                <th>模組</th>
                <th>等級</th>
                <th>操作</th>
                <th>詳細資訊</th>
              </tr>
            </thead>
            <tbody>
              {fakeLogs.map((log) => (
                <tr key={log.id}>
                  <td className="log-time">{log.timestamp}</td>
                  <td>{log.username}</td>
                  <td>{log.module}</td>
                  <td>
                    <span className={`log-level-tag level-${log.level.toLowerCase()}`}>{log.level}</span>
                  </td>
                  <td>{log.action}</td>
                  <td className="log-details">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SystemLogs;