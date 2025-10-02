// src/pages/SystemManagement.tsx (最終版 - 整合「新增使用者」彈出視窗)

import React, { useState, useEffect, useCallback } from 'react';
import { BiPlus, BiEdit, BiTrash } from 'react-icons/bi';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/Modal'; // 引入我們建立的 Modal 元件
import AddUserForm from '../components/system/AddUserForm'; // 引入我們建立的 AddUserForm 元件
import '../styles/SystemManagement.css'; 

// 定義使用者資料的 TypeScript 型別
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
  const [isModalOpen, setIsModalOpen] = useState(false); // 新增 state 來控制 Modal 的開關
  const { token } = useAuth();

  // --- 資料獲取 ---
  // 使用 useCallback 將 fetchUsers 函式包裹起來，避免在 re-render 時重複建立
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
  }, [token]); // 這個函式的依賴是 token

  // 在元件初次載入時，呼叫 fetchUsers
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // --- 事件處理 ---
  // 當 AddUserForm 成功新增使用者後，要執行的回呼函式
  const handleAddUserSuccess = () => {
    setIsModalOpen(false); // 關閉 Modal
    fetchUsers(); // 重新整理使用者列表以顯示新成員
  };

  // --- 渲染邏輯 ---
  const renderUserTable = () => {
    if (isLoading) return <p>正在載入使用者資料...</p>;
    if (error) return <p style={{ color: 'red' }}>錯誤: {error}</p>;
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
                  {user.lastLogin ? (
                    <div className="login-time">
                      <span className="date">{new Date(user.lastLogin).toLocaleDateString('zh-TW')}</span>
                      <span className="time">{new Date(user.lastLogin).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ) : (
                    <span className="never-login">從未登入</span>
                  )}
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

      {/* 系統管理功能卡片 */}
      <div className="management-cards">
        <div className="management-card">
          <h3>使用者管理</h3>
          <p>管理系統使用者帳號、權限與狀態</p>
          <div className="card-stats">
            <span>總使用者: {users.length}</span>
            <span>線上: {users.filter(u => u.status === '線上').length}</span>
          </div>
        </div>

        <div className="management-card">
          <h3>系統監控</h3>
          <p>監控系統效能與健康狀態</p>
          <div className="card-stats">
            <span>CPU: 45%</span>
            <span>記憶體: 62%</span>
          </div>
        </div>

        <div className="management-card">
          <h3>資料備份</h3>
          <p>管理系統資料備份與還原</p>
          <div className="card-stats">
            <span>上次備份: 今日 02:00</span>
            <span>狀態: 正常</span>
          </div>
        </div>

        <div className="management-card">
          <h3>系統設定</h3>
          <p>調整系統參數與偏好設定</p>
          <div className="card-stats">
            <span>檢測閾值: 0.65</span>
            <span>自動處理: 開啟</span>
          </div>
        </div>
      </div>

      <div className="system-management-content content-card">
        <div className="management-section-header">
          <h2>使用者列表</h2>
          <div className="header-actions">
            <button className="action-btn secondary" onClick={() => fetchUsers()}>
              重新整理
            </button>
            <button className="action-btn primary" onClick={() => setIsModalOpen(true)}>
              <BiPlus />
              新增使用者
            </button>
          </div>
        </div>

        {renderUserTable()}
      </div>

      {/* 將 Modal 和 AddUserForm 渲染到頁面上 */}
      {/* 它的顯示與否，由 isModalOpen 這個 state 決定 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="新增使用者"
      >
        <AddUserForm
          onSuccess={handleAddUserSuccess}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>
    </div>
  );
};

export default SystemManagement;