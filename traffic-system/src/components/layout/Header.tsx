// src/components/layout/Header.tsx (完整最終版)

import React, { useState, useEffect, useRef } from 'react';
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
  BiLogOut,
  BiUser
} from 'react-icons/bi';
import '../../styles/layout.css';

// 定義 Header 元件將接收的 props 型別
interface HeaderProps {
  isAdmin: boolean;
}

const Header: React.FC<HeaderProps> = ({ isAdmin }) => {
  const { user, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 這個 effect 用來處理「點擊外部關閉選單」的功能
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="app-header">
      {/* --- 左側 Logo --- */}
      <div className="header-left">
        <BiShield className="logo-icon" />
        <span className="logo-text">交通違規自動檢測與罰單系統</span>
      </div>

      {/* --- 右側內容群組 (包含中間導覽和最右側使用者區塊) --- */}
      <div className="header-right-group">
        
        {/* 【關鍵】補上中間的主導覽列 */}
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
            
            {/* 根據從 Layout 傳來的 isAdmin prop 來決定是否顯示「系統管理」 */}
            {isAdmin && (
              <NavLink to="/system" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                <BiCog className="nav-icon" />
                <span>系統管理</span>
              </NavLink>
            )}
          </nav>
        </div>

        {/* --- 最右側的使用者資訊與通知 --- */}
        <div className="header-right">
          <div className="notifications">
            <BiBell className="notification-icon" />
            <span className="notification-badge">5</span>
          </div>

          {/* 使用者頭像與下拉式選單 */}
          <div className="user-profile" ref={dropdownRef}>
            <button className="user-profile-button" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
              <img src={userAdmin} alt="User Avatar" className="user-avatar" />
              <span className="user-name">{user ? user.name : '訪客'}</span>
            </button>

            {isDropdownOpen && (
              <div className="profile-dropdown">
                <div className="dropdown-header">
                  <strong>{user?.name}</strong>
                  <small>{user?.role}</small>
                </div>
                <ul className="dropdown-menu">
                  <li><BiUser /> 個人資料</li>
                  <li onClick={logout} className="logout-item">
                    <BiLogOut /> 登出
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;