import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import userAdmin from '../../assets/user-admin.png';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
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

// 定義通知的介面
interface Notification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

// 定義 Header 元件將接收的 props 型別
interface HeaderProps {
  isAdmin: boolean;
}

const Header: React.FC<HeaderProps> = ({ isAdmin }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoadingNtf, setIsLoadingNtf] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const handleProfileClick = () => {
    navigate('/profile');
    setIsDropdownOpen(false);
  };

  // 獲取通知列表
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!isNotificationOpen) return;
      setIsLoadingNtf(true);
      try {
        const data = await apiService.get<Notification[]>('/api/notifications/list');
        setNotifications(data);
      } catch (error) {
        console.error("獲取通知列表失敗:", error);
      } finally {
        setIsLoadingNtf(false);
      }
    };
    fetchNotifications();
  }, [isNotificationOpen]);

  // 獲取未讀通知數量
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const data = await apiService.get<{ count: number }>('/api/notifications/unread-count');
        setUnreadCount(data.count);
      } catch (error) {
        console.error("獲取未讀通知數量失敗:", error);
      }
    };

    fetchUnreadCount();
    // 設定定時更新
    const intervalId = setInterval(fetchUnreadCount, 60000); // 每分鐘更新一次
    return () => clearInterval(intervalId);
  }, []);

  // 標記通知為已讀
  const handleMarkAllAsRead = async (notificationIds: string[]) => {
    try {
      await apiService.post('/api/notifications/mark-read', { ids: notificationIds });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) { // 【修正】補上 catch 區塊的起始大括號 {
      console.error("標記通知為已讀失敗:", error);
    }
  };

  // 處理點擊外部關閉選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 建立一個獨立的函式來渲染通知列表內容，以取代巢狀三元運算子
  const renderNotificationList = () => {
    if (isLoadingNtf) {
      return <div className="notification-loading">載入中...</div>;
    }

    if (notifications.length === 0) {
      return <div className="no-notifications">目前沒有通知</div>;
    }

    return notifications.map(notification => (
      <div 
        key={notification.id} 
        className={`notification-item ${notification.read ? '' : 'unread'}`}
      >
        <div className="notification-content">
          <div className="notification-title">{notification.title}</div>
          <div className="notification-text">{notification.message}</div>
          <div className="notification-time">
            {new Date(notification.createdAt).toLocaleString()}
          </div>
        </div>
      </div>
    ));
  };

  return (
    <header className="app-header">
      {/* --- 左側 Logo --- */}
      <div className="header-left">
        <BiShield className="logo-icon" />
        <span className="logo-text">交通違規自動檢測與罰單系統</span>
      </div>

      {/* --- 右側內容群組 (包含中間導覽和最右側使用者區塊) --- */}
      <div className="header-right-group">
        
        {/* 補上中間的主導覽列 */}
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
          <div className="notifications" ref={notificationRef}>
            <button
              className="notification-button"
              onClick={() => setIsNotificationOpen(!isNotificationOpen)}
            >
              <BiBell className="notification-icon" />
              <span className="notification-badge">{unreadCount}</span>
            </button>

            {isNotificationOpen && (
              <div className="notification-dropdown">
                <div className="notification-header">
                  <strong>通知中心</strong>
                  <button 
                    className="mark-all-read"
                    onClick={() => {
                      const unreadIds = notifications
                        .filter(n => !n.read)
                        .map(n => n.id);
                      if (unreadIds.length > 0) {
                        handleMarkAllAsRead(unreadIds);
                      }
                    }}
                  >
                    全部標記為已讀
                  </button>
                </div>
                <div className="notification-list">
                  {renderNotificationList()}
                </div>
                <div className="notification-footer">
                  <button className="view-all-notifications">查看所有通知</button>
                </div>
              </div>
            )}
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
                  <li onClick={handleProfileClick}>
                    <BiUser /> 個人資料
                  </li>
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