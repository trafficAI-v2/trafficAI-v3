// src/components/system/SystemLogs.tsx (完整、真實資料串接版)

import React, { useState, useEffect, useCallback } from 'react';
import { BiSearch, BiRefresh, BiExport } from 'react-icons/bi';
import { useAuth } from '../../context/AuthContext';
import '../../styles/SystemManagement.css'; 

// --- 型別定義 ---
interface Log {
  id: number;
  timestamp: string;
  username: string;
  module: string;
  level: 'INFO' | 'WARNING' | 'ERROR';
  action: string;
  details: string;
}

const SystemLogs: React.FC = () => {
  // --- 狀態管理 ---
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  // --- 篩選條件的狀態管理 ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // --- 資料獲取 ---
  const fetchLogs = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      
      // 動態組合查詢參數
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterLevel) params.append('level', filterLevel);
      if (filterModule) params.append('module', filterModule);
      if (filterUser) params.append('user', filterUser);
      if (filterDate) params.append('start_date', filterDate); // 假設只篩選單日
      
      const response = await fetch(`${API_BASE_URL}/api/logs?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('無法獲取系統日誌');
      }
      const data = await response.json();
      setLogs(data.data); // 後端 API 回傳的資料在 'data' 欄位中
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token, searchTerm, filterLevel, filterModule, filterUser, filterDate]);

  useEffect(() => {
    const debounce = setTimeout(() => {
        fetchLogs();
    }, 500); // 在使用者停止輸入 500ms 後才發送請求，避免過於頻繁的 API 呼叫
    
    return () => clearTimeout(debounce);
  }, [fetchLogs]);

  return (
    <div className="logs-container">
      {/* --- 區塊 1: 篩選與工具列 --- */}
      <div className="filter-toolbar">
        <div className="search-bar">
          <BiSearch />
          <input 
            type="text" 
            placeholder="搜尋日誌ID、使用者、操作..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-options">
          <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}>
            <option value="">所有等級</option>
            <option value="INFO">資訊 (INFO)</option>
            <option value="WARNING">警告 (WARNING)</option>
            <option value="ERROR">錯誤 (ERROR)</option>
          </select>
          <select value={filterModule} onChange={(e) => setFilterModule(e.target.value)}>
            <option value="">所有模組</option>
            <option value="使用者管理">使用者管理</option>
            <option value="使用者認證">使用者認證</option>
            <option value="違規管理">違規管理</option>
            <option value="個人資料">個人資料</option>
          </select>
          <input
            type="text"
            placeholder="使用者名稱"
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
          />
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          <button className="btn btn-secondary" onClick={fetchLogs}><BiRefresh /> 重新整理</button>
          <button className="btn btn-primary"><BiExport /> 匯出 CSV</button>
        </div>
      </div>

      {/* --- 區塊 2: 日誌列表 --- */}
      <div className="log-table-container">
        {isLoading ? (
          <p>正在載入日誌...</p>
        ) : error ? (
          <p className="error-message">{error}</p>
        ) : (
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
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td className="log-time">{new Date(log.timestamp).toLocaleString('zh-TW')}</td>
                      <td>{log.username}</td>
                      <td>{log.module}</td>
                      <td>
                        <span className={`log-level-tag level-${log.level.toLowerCase()}`}>{log.level}</span>
                      </td>
                      <td>{log.action}</td>
                      <td className="log-details" title={log.details}>{log.details}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>沒有符合條件的日誌記錄</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemLogs;