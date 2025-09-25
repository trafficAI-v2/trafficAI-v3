// src/components/layout/Header.tsx (完整優化建議版)

import React from 'react';
import { NavLink } from 'react-router-dom';
import userAdmin from '../../assets/user-admin.png';
import { useAuth } from '../../context/AuthContext';
import {
  BiShield, 
  BiHomeAlt,
  BiFile,
  BiBarChartAlt2,
  BiCog,
  BiBell,
  BiLogOut
} from 'react-icons/bi';
import '../../styles/layout.css';

// 【第 1 步：定義 Header 元件將接收的 props 型別】
// 我們告訴 TypeScript，這個元件會收到一個叫做 'isAdmin' 的屬性，它的值必須是布林值 (true/false)
interface HeaderProps {
  isAdmin: boolean;
}

// 【第 2 步：讓 Header 元件使用這個型別定義】
// React.FC<HeaderProps> 表示這是一個遵循 HeaderProps 型別的功能性元件
// 並從 props 中解構出 isAdmin
const Header: React.FC<HeaderProps> = ({ isAdmin }) => {
  // 我們仍然需要 useAuth 來獲取 user 的姓名和 logout 函式
  const { user, logout } = useAuth();

  return (
    <header className="app-header">
      <div className="header-left">
        <BiShield className="logo-icon" />
        <span className="logo-text">交通監控系統</span>
      </div>

      <div className="header-right-group">
        <div className="header-center">
          <nav className="main-nav">
            <NavLink to="/" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              <BiHomeAlt className="nav-icon" />
              <span>首頁</span>
            </NavLink>
            <NavLink to="/violations" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              <BiFile className="nav-icon" />
              <span>違規管理</span>
            </NavLink>
            <NavLink to="/analytics" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              <BiBarChartAlt2 className="nav-icon" />
              <span>統計分析</span>
            </NavLink>
            
            {/* 【第 3 步：直接使用從父層 (Layout) 傳來的 isAdmin 進行判斷】 */}
            {isAdmin && (
              <NavLink to="/system" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                <BiCog className="nav-icon" />
                <span>系統管理</span>
              </NavLink>
            )}
          </nav>
        </div>

        <div className="header-right">
          <div className="notifications">
            <BiBell className="notification-icon" />
            <span className="notification-badge">5</span>
          </div>
          <div className="user-profile">
            <img src={userAdmin} alt="User Admin" className="user-admin" />
            <span className="user-name">{user ? user.name : '訪客'}</span> 
            <button onClick={logout} className="logout-button" title="登出">
              <BiLogOut />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;