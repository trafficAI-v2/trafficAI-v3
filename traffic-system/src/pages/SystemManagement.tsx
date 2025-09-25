//系統管理頁面
// src/pages/SystemManagement.tsx

import React from 'react';
// 我們稍後會在這裡建立和引入使用者管理的元件
// import UserManagement from '../components/system/UserManagement';
import '../styles/systemManagement.css';

const SystemManagement: React.FC = () => {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1>系統管理</h1>
        <span>管理使用者帳號與系統相關設定</span>
      </div>
      
      <div className="system-management-content">
        {/* 在這裡我們會放置使用者管理的主要功能 */}
        <h2>使用者管理</h2>
        <p>功能開發中...</p>
      </div>
    </div>
  );
};

export default SystemManagement;