// src/pages/Dashboard.tsx (完整、最終繁體中文版)

import React, { useState, useEffect, useCallback } from 'react';
import StatusCard from '../components/dashboard/StatusCard';
import CameraFeed from '../components/dashboard/CameraFeed';
import ViolationPanel from '../components/dashboard/ViolationPanel';
import { BiShield, BiGroup, BiFile, BiBarChartAlt2 } from 'react-icons/bi';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api'; // 引入我們統一的 apiService
import '../styles/dashboard.css';

// --- 型別定義 ---
// 定義儀表板最終需要的資料格式，現在包含了 onlineUsers
interface DashboardData {
  totalUsers: number;
  onlineUsers: number;
  todayViolations: number;
  cpuUsage: string;
}

// 輔助函式：將角色 ID 轉換為中文名稱
const getRoleDisplayName = (role: 'admin' | 'operator' | undefined) => {
  switch (role) {
    case 'admin': return '系統管理員';
    case 'operator': return '操作員';
    default: return '訪客';
  }
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  
  // --- 統一的狀態管理 ---
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- 統一的資料獲取函式 ---
  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 使用 Promise.all 來「同時」發送所有需要的 API 請求，以提升載入速度
      const [analyticsRes, usersRes, performanceRes] = await Promise.all([
        apiService.get<any>('/api/analytics?time_range=today'),
        apiService.get<any[]>('/api/users'), // usersRes 將會是一個包含所有使用者物件的陣列
        apiService.get<any>('/api/system/performance')
      ]);

      // --- 計算線上人數的邏輯 ---
      // 定義「線上」的標準：5 分鐘內曾有登入活動
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000); 
      
      // 使用 .filter() 來篩選出符合條件的「線上使用者」
      const onlineUsers = usersRes.filter(user => 
        user.lastLogin && new Date(user.lastLogin) > fiveMinutesAgo
      );
      // -----------------------------

      // 將從不同 API 獲取的資料，組合成我們需要的單一物件
      const dashboardData: DashboardData = {
        todayViolations: analyticsRes.kpi.totalViolations,
        totalUsers: usersRes.length,
        onlineUsers: onlineUsers.length, // 將計算結果存入
        cpuUsage: `${performanceRes.cpu.percent.toFixed(1)}%`
      };

      setData(dashboardData); // 更新 state
    } catch (err) {
      console.error("無法載入儀表板數據:", err);
      setError("資料載入失敗，請稍後重試。");
    } finally {
      setIsLoading(false); // 結束載入狀態
    }
  }, []); // 依賴陣列為空，因為 token 已在 apiService 內部自動處理

  // --- 在元件載入時觸發資料獲取，並設定定時刷新 ---
  useEffect(() => {
    fetchDashboardData(); // 立即執行一次
    const interval = setInterval(fetchDashboardData, 30000); // 設定每 30 秒自動刷新一次
    return () => clearInterval(interval); // 元件卸載時清除定時器
  }, [fetchDashboardData]);

  // --- 統一的卡片數值渲染邏輯 ---
  const getCardValue = (value: string | number | undefined | null) => {
    if (isLoading) return '...'; // 正在載入時，顯示 '...'
    if (error) return '--';   // 發生錯誤時，顯示 '--'
    return value ?? 0;       // 正常情況下顯示數值，如果是 null 或 undefined 則顯示 0
  };

  // --- 取得系統狀態值的輔助函數 ---
  const getSystemStatus = () => {
    if (isLoading) return '...';
    if (error) return '錯誤';
    return '正常運行';
  };

  // --- 取得系統狀態的輔助函數 ---
  const getSystemStatusType = () => {
    if (error) return 'error';
    return 'ok';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>交通違規自動檢測與罰單系統</h1>
        {user && <span>{user.name} - {getRoleDisplayName(user.role)}</span>}
      </div>

      <div className="status-overview">
        <StatusCard
          title="系統狀態"
          value={getSystemStatus()}
          status={getSystemStatusType()}
          type="success"
          icon={<BiShield />}
        />
        <StatusCard 
          title="總使用者 / 線上人數" // 修改標題
          value={isLoading ? '- / -' : `${data?.totalUsers ?? 0} / ${data?.onlineUsers ?? 0}`} // 使用樣板字串組合兩個數值
          type="info" 
          icon={<BiGroup />} 
        />
        <StatusCard 
          title="今日違規" 
          value={getCardValue(data?.todayViolations)}
          type="warning" 
          icon={<BiFile />} 
        />
        <StatusCard 
          title="系統效能 (CPU)" 
          value={getCardValue(data?.cpuUsage)}
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