// src/App.tsx (最終版，整合 AuthContext)

import React from 'react'; // 主要的 React 物件
import type { ReactNode } from 'react'; // 明確地告訴 TypeScript，我只是要匯入一個型別
import { Routes, Route, Navigate } from 'react-router-dom';

// --- 佈局與頁面元件 ---
import Layout from './components/layout/Layout';
import Login from './pages/login'; // 【修正】確保 'L' 是大寫，與檔名一致
import Dashboard from './pages/Dashboard';
import ViolationLog from './pages/ViolationLog';
import GenerateTickets from './components/violations/GenerateTickets';
import Analytics from './pages/Analytics';
import { useAuth } from './context/AuthContext'; // 引入我們自訂的 useAuth Hook

// -------------------------------------------------------------------------
// 【升級版：「路由守衛」元件】
// -------------------------------------------------------------------------
const ProtectedRoute: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 【核心修改】從 useAuth 中獲取真實的 token 和 isLoading 狀態
  const { token, isLoading } = useAuth();

  // 情況 1：如果 AuthContext 正在進行初始的 token 驗證
  // (例如，應用程式剛載入，正在檢查 localStorage)
  // 我們先顯示一個簡單的載入訊息，避免畫面跳轉閃爍。
  if (isLoading) {
    return <div>正在驗證登入狀態...</div>; // 未來可以換成一個更美觀的載入動畫元件
  }

  // 情況 2：如果驗證完畢，且確定沒有 token (未登入)
  if (!token) {
    // 強制將使用者導向到登入頁面
    return <Navigate to="/login" replace />;
  }

  // 情況 3：驗證通過，使用者已登入
  // 正常顯示被包裹的子元件 (也就是 <Layout />)
  return <>{children}</>;
};


// -------------------------------------------------------------------------
// 【主應用程式路由結構】
// (這部分不需要修改，保持原樣)
// -------------------------------------------------------------------------
function App() {
  return (
    <Routes>
      {/* --- 公開路由 --- */}
      <Route path="/login" element={<Login />} />

      {/* --- 受保護的路由 --- */}
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="violations" element={<ViolationLog />} />
        <Route path="generate-tickets" element={<GenerateTickets />} />
        <Route path="analytics" element={<Analytics />} />
      </Route>
      
      {/* --- 備用路由 --- */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;