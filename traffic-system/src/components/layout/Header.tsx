// 最頂部導航列
import React from 'react';
import { NavLink } from 'react-router-dom';
import userAdmin from '../../assets/user-admin.png';

import {
  BiShield, 
  BiHomeAlt,
  BiFile,
  BiBarChartAlt2,
  BiCog,
  BiBell
} from 'react-icons/bi';
import '../../styles/layout.css';

const Header: React.FC = () => {
  return (
    <header className="app-header">
      {/* ===== 左側 Logo 區塊 ===== */}
      <div className="header-left">
        {/* ----- 使用修改後的圖示 ----- */}
        <BiShield className="logo-icon" />
        <span className="logo-text">交通監控系統</span>
      </div>

      {/* ===== 中間導覽列區塊 ===== */}
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
            <NavLink to="/system" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              <BiCog className="nav-icon" />
              <span>系統管理</span>
            </NavLink>
          </nav>
        </div>

        {/* ===== 右側使用者資訊區塊 ===== */}
        <div className="header-right">
          <div className="notifications">
            <BiBell className="notification-icon" />
            <span className="notification-badge">5</span>
          </div>
          <div className="user-profile">
            <img src={userAdmin} alt="User Admin" className="user-admin" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;