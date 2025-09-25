// src/pages/SystemManagement.tsx (升級版 - 顯示使用者列表)

import React, { useState, useEffect } from 'react';
import { BiPlus, BiEdit, BiTrash } from 'react-icons/bi'; // 引入更多圖示
import { useAuth } from '../context/AuthContext';
import '../styles/SystemManagement.css'; 

// 定義從後端 API 收到的使用者資料的 TypeScript 型別
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
  const [users, setUsers] = useState<User[]>([]); // 儲存從 API 獲取的使用者列表
  const [isLoading, setIsLoading] = useState(true); // 管理載入狀態
  const [error, setError] = useState<string | null>(null); // 管理錯誤訊息
  const { token } = useAuth(); // 從 AuthContext 獲取 token，用於 API 請求的授權

  // --- 資料獲取 ---
  // 使用 useEffect Hook，在元件初次載入時執行一次 API 請求
  useEffect(() => {
    const fetchUsers = async () => {
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
          headers: {
            'Authorization': `Bearer ${token}`
          }
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
    };

    fetchUsers();
  }, [token]); // 這個 Effect 的依賴是 token，當 token 變化時會重新執行

  // --- 渲染函式 ---
  // 將表格的渲染邏輯封裝成一個函式，讓主 return 區塊更乾淨
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
                <td>{user.lastLogin ? new Date(user.lastLogin).toLocaleString('zh-TW') : '從未登入'}</td>
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
      
      <div className="system-management-content content-card">
        <div className="management-section-header">
          <h2>使用者列表</h2>
          <button className="add-user-button">
            <BiPlus />
            新增使用者
          </button>
        </div>
        
        {/* 呼叫渲染函式來顯示表格 */}
        {renderUserTable()}
      </div>
    </div>
  );
};

export default SystemManagement;