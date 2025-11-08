// src/pages/SystemManagement.tsx (完整最終版 - 整合所有 Modal)

import React, { useState, useEffect, useCallback } from 'react';
import {
  BiCog, BiHistory, BiBarChartAlt2, BiData, BiCloudUpload, BiNetworkChart,
  BiEdit, BiTrash, BiPlus, BiRefresh
} from 'react-icons/bi';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/Modal';
import AddUserForm from '../components/system/AddUserForm';

// --- 引入我們所有的新元件 ---
import SystemSettings from '../components/system/SystemSettings';
import SystemLogs from '../components/system/SystemLogs';
import SystemPerformance from '../components/system/SystemPerformance';
import DatabaseManagement from '../components/system/DatabaseManagement';
import UpdateManagement from '../components/system/UpdateManagement';
import IntegrationSettings from '../components/system/IntegrationSettings';

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
  const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  
  // --- 資料獲取 (使用者列表) ---
  const fetchUsers = useCallback(async () => {
    if (!token) {
      setError("驗證失敗，請重新登入。");
      setIsLoadingUsers(false);
      return;
    }
    setIsLoadingUsers(true);
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
      setIsLoadingUsers(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);
  
  // --- 事件處理 ---
  const openModal = (type: string) => {
    switch (type) {
      case 'addUser':
        setModalTitle('新增使用者');
        setModalContent(<AddUserForm onSuccess={() => { setModalContent(null); fetchUsers(); }} onCancel={() => setModalContent(null)} />);
        break;
      case 'settings':
        setModalTitle('系統參數設定');
        setModalContent(<SystemSettings />);
        break;
      case 'logs':
        setModalTitle('系統日誌查詢');
        setModalContent(<SystemLogs />);
        break;
      case 'performance':
        setModalTitle('系統效能監控');
        setModalContent(<SystemPerformance />);
        break;
      case 'database':
        setModalTitle('資料庫管理');
        setModalContent(<DatabaseManagement />);
        break;
      case 'update':
        setModalTitle('系統更新管理');
        setModalContent(<UpdateManagement />);
        break;
      case 'integration':
        setModalTitle('系統整合設定');
        setModalContent(<IntegrationSettings />);
        break;
    }
  };

  // --- 渲染邏輯 ---
  const renderUserTable = () => {
    if (isLoadingUsers) return <p>正在載入使用者資料...</p>;
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
        <span>點選下方卡片以開啟各項管理功能</span>
      </div>

      {/* --- 功能總覽卡片 --- */}
      <div className="management-cards">
        <button className="management-card clickable" onClick={() => openModal('settings')} type="button">
          <BiCog /><h3>系統參數設定</h3><p>調整系統名稱、時區、語言等基本參數。</p>
        </button>
        <button className="management-card clickable" onClick={() => openModal('logs')} type="button">
          <BiHistory /><h3>系統日誌查詢</h3><p>查詢、篩選並匯出系統所有操作日誌。</p>
        </button>
        <button className="management-card clickable" onClick={() => openModal('performance')} type="button">
          <BiBarChartAlt2 /><h3>系統效能監控</h3><p>監控 CPU、記憶體、網路等即時效能狀況。</p>
        </button>
        <button className="management-card clickable" onClick={() => openModal('database')} type="button">
          <BiData /><h3>資料庫管理</h3><p>管理資料備份、還原與效能最佳化。</p>
        </button>
        <button className="management-card clickable" onClick={() => openModal('update')} type="button">
          <BiCloudUpload /><h3>系統更新管理</h3><p>檢查、排程並管理系統版本更新。</p>
        </button>
        <button className="management-card clickable" onClick={() => openModal('integration')} type="button">
          <BiNetworkChart /><h3>系統整合設定</h3><p>設定與外部系統的 API 整合。</p>
        </button>
      </div>
      
      {/* --- 使用者列表 --- */}
      <div className="system-management-content content-card">
        <div className="management-section-header">
          <h2>使用者列表</h2>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={fetchUsers}><BiRefresh /> 重新整理</button>
            <button className="btn btn-primary" onClick={() => openModal('addUser')}><BiPlus /> 新增使用者</button>
          </div>
        </div>
        {renderUserTable()}
      </div>

      {/* --- 單一、動態內容的 Modal --- */}
      <Modal
        isOpen={!!modalContent}
        onClose={() => setModalContent(null)}
        title={modalTitle}
      >
        {modalContent}
      </Modal>
    </div>
  );
};

export default SystemManagement;