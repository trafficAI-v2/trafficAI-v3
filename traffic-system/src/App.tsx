// src/App.tsx

import React from 'react'; // 引入 React
import { Routes, Route, Navigate } from 'react-router-dom'; // 引入路由相關元件

// --- 佈局與頁面元件 ---
import Layout from './components/layout/Layout'; // 主佈局 (包含側邊欄和頂部導航)
import Login from './pages/login';               // 登入頁面
import Dashboard from './pages/Dashboard';           // 儀表板頁面
import ViolationLog from './pages/ViolationLog';     // 違規紀錄頁面
import GenerateTickets from './components/violations/GenerateTickets'; // 罰單產生區
import Analytics from './pages/Analytics';         // 統計分析頁面

// -------------------------------------------------------------------------
// 【第 1 步：定義「路由守衛」元件】
// 這個元件是實現權限控制的核心。
// 它的工作是：檢查使用者是否已登入。
// - 如果已登入，就顯示被它包裹的子元件 (例如 Layout)。
// - 如果未登入，就強制將使用者重新導向到 '/login' 頁面。
// -------------------------------------------------------------------------
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 目前，我們先用一個假的登入狀態來測試。
  // 之後，這裡會替換成從 AuthContext 讀取真實的登入狀態。
  const isAuthenticated = localStorage.getItem('accessToken'); // 檢查本機儲存是否有 token

  if (!isAuthenticated) {
    // 如果未認證 (未登入)，則導向到登入頁面
    return <Navigate to="/login" replace />;
  }

  // 如果已認證，則正常顯示子元件
  return <>{children}</>;
};


// -------------------------------------------------------------------------
// 【第 2 步：主應用程式路由結構】
// 這裡定義了整個應用程式的 URL 結構。
// -------------------------------------------------------------------------
function App() {
  return (
    <Routes>
      {/* --- 公開路由 --- */}
      {/* 
        這個區塊放置所有不需要登入就可以訪問的頁面。
        我們的登入頁面就屬於這裡。
      */}
      <Route path="/login" element={<Login />} />


      {/* --- 受保護的路由 --- */}
      {/* 
        這個區塊放置所有「必須登入」才能訪問的頁面。
        我們用上面定義的 <ProtectedRoute> 元件將整個 <Layout> 包裹起來，
        這意味著所有在 <Layout> 內部的頁面（儀表板、分析頁等）都被自動保護了。
      */}
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* 'index' 代表當 URL 是根路徑 '/' 時，預設顯示的頁面 */}
        <Route index element={<Dashboard />} />
        
        {/* 其他嵌套在 Layout 內的子頁面 */}
        <Route path="violations" element={<ViolationLog />} />
        <Route path="generate-tickets" element={<GenerateTickets />} />
        <Route path="analytics" element={<Analytics />} />
      </Route>
      

      {/* --- 備用路由 --- */}
      {/* 
        如果使用者訪問了任何未定義的路徑，我們可以將他們導向回首頁。
        或者未來可以建立一個專門的 404 Not Found 頁面。
      */}
      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  );
}

export default App;