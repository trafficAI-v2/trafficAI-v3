// src/pages/SystemManagement.tsx (完整最終版 - 整合彈出式設定視窗)

import React, { useState, useEffect, useCallback } from 'react';
import { BiPlus, BiEdit, BiTrash, BiRefresh } from 'react-icons/bi';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/Modal';
import AddUserForm from '../components/system/AddUserForm';
import SystemSettings from '../components/system/SystemSettings'; // 引入我們建立的 SystemSettings 元件
import '../styles/SystemManagement.css'; 

// --- 型別定義 ---
interface User {
  id: number;
  username: string;
  email: string;
  name: string;
  role: 'admin' | 'operator';
  status: string;
  lastLogin: string | null;
}

const SystemManagement: React.FC = () => {
  // --- 狀態管理 ---
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 為兩個不同的 Modal 建立獨立的 state
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  const { token } = useAuth();

  // --- 資料獲取 ---
  const fetchUsers = useCallback(async () => {
    if (!token) {
      setError("驗證失敗，請重新登入。");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error('無法獲取使用者列表，請確認您是否擁有管理員權限。');
      }
      const data: User[] = await response.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // --- 事件處理 ---
  const handleAddUserSuccess = () => {
    setIsAddUserModalOpen(false); // 關閉「新增使用者」的 Modal
    fetchUsers(); // 重新整理使用者列表
  };

  // --- 渲染邏輯 ---
  const renderUserTable = () => {
    if (isLoading) return <p>正在載入使用者資料...</p>;
    if (error) return <p className="error-message">{error}</p>;
    if (users.length === 0) return <p>目前系統中沒有任何使用者。</p>;
    
    return (
      <div className="user-table-container">
        <table className="user-table">
          <thead>
            <tr>
              <th>使用者名稱</th>
              <th>姓名</th>
              <th>Email</th>
              <th>角色</th>
              <th>狀態</th>
              <th>上次登入</th>
              <th style={{ textAlign: 'center' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <span className={`role-tag ${user.role}`}>
                    {user.role === 'admin' ? '系統管理員' : '操作員'}
                  </span>
                </td>
                <td>{user.status}</td>
                <td className="last-login-cell">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleString('zh-TW') : '從未登入'}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button className="action-button edit-button" title="編輯使用者"><BiEdit /></button>
                  <button className="action-button delete-button" title="刪除使用者"><BiTrash /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>系統管理</h1>
        <span>管理使用者帳號與系統相關設定</span>
      </div>

      {/* --- 頂部功能卡片網格 --- */}
      <div className="management-cards">
        {/* 卡片 1: 系統參數設定 (加上 onClick 事件) */}
        <div 
          className="management-card placeholder clickable" 
          onClick={() => setIsSettingsModalOpen(true)}
          role="button"
          tabIndex={0}
        >
          <h3>系統參數設定</h3>
          <p>調整系統名稱、時區、語言等基本參數。</p>
          <span className="dev-status-badge">開發中</span>
        </div>

        {/* 卡片 2: 系統日誌查詢 */}
        <div className="management-card placeholder">
          <h3>系統日誌查詢</h3>
          <p>查詢、篩選並匯出系統所有操作日誌。</p>
          <span className="dev-status-badge">開發中</span>
        </div>

        {/* 卡片 3: 系統效能監控 */}
        <div className="management-card placeholder">
          <h3>系統效能監控</h3>
          <p>監控 CPU、記憶體、網路等即時效能狀況。</p>
          <span className="dev-status-badge">開發中</span>
        </div>
        
        {/* 卡片 4: 資料庫管理 */}
        <div className="management-card placeholder">
          <h3>資料庫管理</h3>
          <p>管理資料備份、還原與效能最佳化。</p>
          <span className="dev-status-badge">開發中</span>
        </div>

        {/* 卡片 5: 系統更新管理 */}
        <div className="management-card placeholder">
          <h3>系統更新管理</h3>
          <p>檢查、排程並管理系統的版本更新。</p>
          <span className="dev-status-badge">開發中</span>
        </div>

        {/* 卡片 6: 系統整合設定 */}
        <div className="management-card placeholder">
          <h3>系統整合設定</h3>
          <p>設定與外部系統 (金流、簡訊) 的 API 整合。</p>
          <span className="dev-status-badge">開發中</span>
        </div>
      </div>
      
      {/* --- 使用者管理區塊 --- */}
      <div className="system-management-content content-card">
        <div className="management-section-header">
          <h2>使用者列表</h2>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={fetchUsers}>
              <BiRefresh />
              重新整理
            </button>
            <button className="btn btn-primary" onClick={() => setIsAddUserModalOpen(true)}>
              <BiPlus />
              新增使用者
            </button>
          </div>
        </div>
        {renderUserTable()}
      </div>

      {/* --- 彈出視窗 --- */}
      {/* 「新增使用者」的 Modal */}
      <Modal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        title="新增使用者"
      >
        <AddUserForm
          onSuccess={handleAddUserSuccess}
          onCancel={() => setIsAddUserModalOpen(false)}
        />
      </Modal>

      {/* 新增的「系統設定」Modal */}
      <Modal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        title="系統參數設定"
      >
        <SystemSettings />
      </Modal>
    </div>
  );
};

export default SystemManagement;