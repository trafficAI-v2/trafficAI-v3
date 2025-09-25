// src/components/layout/Layout.tsx (完整修正版)

import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header'; // 引入 Header 元件
import { useAuth } from '../../context/AuthContext'; // 引入我們自訂的 useAuth Hook

// Layout 元件是所有受保護頁面的外層容器
// 它的職責是搭建頁面的基本結構（例如，頂部有 Header，中間是主要內容）
const Layout: React.FC = () => {

  // 【第 1 步：在 Layout 層級獲取使用者資訊】
  // 這裡的 user 狀態會由 AuthContext 提供，並且在登入成功後會自動更新
  const { user } = useAuth();

  // 【調試用】在開發環境下輸出使用者狀態
  if (import.meta.env.DEV) {
    console.log('Layout - Current user:', user);
  }

  // 【第 2 步：在這裡進行一次性的角色判斷】
  // 我們檢查 user 物件是否存在，並且其 role 屬性是否為 'admin'。
  // user?.role 語法中的 '?.' 稱為「可選鏈」，可以安全地存取可能不存在的物件屬性，避免錯誤。
  // 如果 user 是 null 或 undefined，整個表達式會直接回傳 undefined (也就是 false)。
  const isAdmin = user?.role === 'admin';

  return (
    // app-container 可能是你定義在全域 CSS 中的主容器 class
    <div className="app-container">
      
      {/* 
        【第 3 步：將判斷結果 isAdmin 作為一個 prop 傳遞給 Header 元件】
        這樣 Header 元件就不需要自己去判斷角色，
        而是直接接收來自父層 Layout 的明確指令 (true 或 false)，
        讓元件的職責更單純，也避免了狀態更新不及時的問題。
      */}
      <Header isAdmin={isAdmin} /> 
      
      {/* 
        <main> 標籤用來包裹頁面的主要內容。
        <Outlet /> 是 react-router-dom 的一個特殊元件，
        它會自動將符合當前 URL 的子路由頁面（例如 Dashboard, Analytics 等）渲染在這個位置。
      */}
      <main className="main-content">
        <Outlet />
      </main>

    </div>
  );
};

export default Layout;