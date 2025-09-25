// src/components/layout/Layout.tsx

import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import { useAuth } from '../../context/AuthContext'; // 在 Layout 層級引入 useAuth

const Layout: React.FC = () => {
  const { user } = useAuth(); // 在這裡獲取 user 狀態

  // 在 Layout 層級進行一次性的角色判斷
  const isAdmin = user?.role === 'admin';

  return (
    <div className="app-container"> {/* 你的 CSS class */}
      {/* 將判斷結果 isAdmin 作為 prop 傳遞給 Header */}
      <Header isAdmin={isAdmin} /> 
      
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;