// src/pages/Dashboard.tsx (完整升級版)

import React from 'react';
import StatusCard from '../components/dashboard/StatusCard';
import CameraFeed from '../components/dashboard/CameraFeed';
import ViolationPanel from '../components/dashboard/ViolationPanel';
import { BiShield, BiGroup, BiFile, BiBarChartAlt2 } from 'react-icons/bi';
import { useAuth } from '../context/AuthContext'; // 【第 1 步：引入 useAuth】
import '../styles/dashboard.css';

// 建立一個輔助函式，將 'admin' 或 'operator' 這樣的角色 ID，轉換成使用者看得懂的中文名稱
// 這樣做的好處是，如果未來要增加新角色或修改顯示名稱，只需要改這裡就好
const getRoleDisplayName = (role: 'admin' | 'operator' | undefined) => {
  switch (role) {
    case 'admin':
      return '系統管理員';
    case 'operator':
      return '操作員';
    default:
      return '訪客'; // 提供一個預設值以防萬一
  }
};

const Dashboard: React.FC = () => {
  // 【第 2 步：從 AuthContext 中獲取當前登入的 user 物件】
  const { user } = useAuth();

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>交通違規自動檢測與罰單系統</h1>
        
        {/* 【第 3 步：動態地渲染使用者資訊】 */}
        {/* 我們用 user 物件來動態產生問候語。 */}
        {/* 使用 user && (...) 是一個安全檢查，確保只有在 user 物件存在 (已登入) 的情況下才渲染。 */}
        {user && (
          <span>
            {/* 從 user 物件中讀取姓名 (name) 和角色 (role) */}
            {user.name} - {getRoleDisplayName(user.role)}
          </span>
        )}
      </div>

      {/* --- 下方的內容保持不變 --- */}
      <div className="status-overview">
        <StatusCard 
          title="系統狀態" 
          value="正常運行" 
          status="ok" 
          type="success" 
          icon={<BiShield />} 
        />
        <StatusCard 
          title="線上使用者" 
          value={1} /* 我們可以先把這裡改成 1，因為至少有你自己登入了 */
          type="info" 
          icon={<BiGroup />} 
        />
        <StatusCard 
          title="今日違規" 
          value={0} 
          type="warning" 
          icon={<BiFile />} 
        />
        <StatusCard 
          title="系統效能" 
          value="--" 
          type="primary" 
          icon={<BiBarChartAlt2 />} 
        />
      </div>
      
      <div className="dashboard-main-panel">
        <CameraFeed />
        <ViolationPanel />
      </div>
    </div>
  );
};

export default Dashboard;