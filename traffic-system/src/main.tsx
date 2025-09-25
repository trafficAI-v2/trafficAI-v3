// src/main.tsx (完整、正確的最終版本)

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';

// 引入樣式檔案 (順序很重要！)
import './styles/variables.css'; // CSS 變數 (最先載入)
import './styles/base.css';      // 基礎樣式和通用類別
import './styles/main.css';      // 現有的主樣式 

// 【第 1 步：從 context 檔案中引入 AuthProvider】
import { AuthProvider } from './context/AuthContext.tsx';

// 【第 2 步：執行 React 的啟動邏輯】
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* AuthProvider 必須在最外層，包裹住所有需要存取登入狀態的元件 */}
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
)