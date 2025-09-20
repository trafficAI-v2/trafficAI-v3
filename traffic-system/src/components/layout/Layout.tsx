// 這個元件會包含 Header 和一個 Outlet。Outlet 是 react-router-dom 提供的一個元件，它會根據當前的路由，將對應的頁面元件渲染在這個位置。
import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';

const Layout: React.FC = () => {
  return (
    <div className="app-container bg-blue-100 min-h-screen">
      <Header />
      <main className="main-content p-4">
        <Outlet /> {/* 子頁面將會被渲染在這裡 */}
      </main>
    </div>
  );
};

export default Layout;