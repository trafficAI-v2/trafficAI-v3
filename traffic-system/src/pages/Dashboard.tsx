// src/pages/Dashboard.tsx (升級版)

import React from 'react';
import StatusCard from '../components/dashboard/StatusCard';
import CameraFeed from '../components/dashboard/CameraFeed';
import ViolationPanel from '../components/dashboard/ViolationPanel';
import { BiShield, BiGroup, BiFile, BiBarChartAlt2 } from 'react-icons/bi';
import { useAuth } from '../context/AuthContext';
import '../styles/dashboard.css';

const getRoleDisplayName = (role: 'admin' | 'operator' | undefined) => {
  switch (role) {
    case 'admin': return '系統管理員';
    case 'operator': return '操作員';
    default: return '訪客';
  }
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>交通違規自動檢測與罰單系統</h1>
        {user && (
          <span>
            {user.name} - {getRoleDisplayName(user.role)}
          </span>
        )}
      </div>
      <div className="status-overview">
        <StatusCard title="系統狀態" value="正常運行" status="ok" type="success" icon={<BiShield />} />
        <StatusCard title="線上使用者" value={1} type="info" icon={<BiGroup />} />
        <StatusCard title="今日違規" value={0} type="warning" icon={<BiFile />} />
        <StatusCard title="系統效能" value="--" type="primary" icon={<BiBarChartAlt2 />} />
      </div>
      <div className="dashboard-main-panel">
        <CameraFeed />
        <ViolationPanel />
      </div>
    </div>
  );
};

export default Dashboard;