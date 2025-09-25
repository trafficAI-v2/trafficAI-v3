// src/components/layout/Header.tsx (優化建議版)

import React from 'react';
import { NavLink } from 'react-router-dom';
import userAdmin from '../../assets/user-admin.png';
import { useAuth } from '../../context/AuthContext';
import { BiShield, BiHomeAlt, BiFile, BiBarChartAlt2, BiCog, BiBell, BiLogOut } from 'react-icons/bi';
import '../../styles/layout.css';

// 定義 Header 元件將接收的 props 型別
interface HeaderProps {
  isAdmin: boolean;
}

const Header: React.FC<HeaderProps> = ({ isAdmin }) => {
  const { user, logout } = useAuth();

  // 【調試用】在開發環境下輸出狀態
  if (import.meta.env.DEV) {
    console.log('Header - isAdmin:', isAdmin, 'user:', user);
  }

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
              <BiHomeAlt className="nav-icon" /><span>首頁</span>
            </NavLink>
            <NavLink to="/violations" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              <BiFile className="nav-icon" /><span>違規管理</span>
            </NavLink>
            <NavLink to="/analytics" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              <BiBarChartAlt2 className="nav-icon" /><span>統計分析</span>
            </NavLink>
            {isAdmin && (
              <NavLink to="/system" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                <BiCog className="nav-icon" /><span>系統管理</span>
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