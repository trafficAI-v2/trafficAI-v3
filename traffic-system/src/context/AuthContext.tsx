// src/context/AuthContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react'; 
import { jwtDecode } from 'jwt-decode';

// 從 .env 檔案讀取後端 API 的基本 URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// 定義從 JWT Token 中解碼出來的使用者資訊的型別
interface User {
  username: string;
  name: string;
  role: 'admin' | 'operator';
}

// 定義 JWT Token 本身的結構
interface DecodedToken {
  identity: User;
  exp: number; // Token 的過期時間
}

// 定義 AuthContext 要提供給整個應用的資料和函式的型別
interface AuthContextType {
  user: User | null;         // 當前登入的使用者資訊，或 null
  token: string | null;        // JWT Token 字串，或 null
  login: (username: string, password: string) => Promise<boolean>; // 登入函式
  logout: () => void;          // 登出函式
  isLoading: boolean;        // 是否正在檢查初始登入狀態
}

// 建立 Context 物件
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 建立 Provider 元件，它將包裹我們的整個應用程式
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('accessToken'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 這個 Effect 會在應用程式初次載入時執行
    // 它的任務是檢查 localStorage 中是否有舊的 token，並嘗試還原登入狀態
    if (token) {
      try {
        const decodedToken: DecodedToken = jwtDecode(token);
        // 檢查 token 是否已過期
        if (decodedToken.exp * 1000 > Date.now()) {
          setUser(decodedToken.identity);
        } else {
          // Token 已過期，清除它
          localStorage.removeItem('accessToken');
          setToken(null);
          setUser(null);
        }
      } catch (error) {
        console.error("無效的 token，將其清除:", error);
        localStorage.removeItem('accessToken');
        setToken(null);
        setUser(null);
      }
    }
    setIsLoading(false); // 完成初始狀態檢查
  }, [token]);

  // --- 登入函式 ---
  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        return false; // 如果後端回傳非 2xx 狀態，表示登入失敗
      }

      const { access_token } = await response.json();
      // 將 token 儲存到 localStorage，以便在重新整理頁面後保持登入
      localStorage.setItem('accessToken', access_token);
      setToken(access_token); // 更新 state，觸發 useEffect 來解碼並設定 user
      
      return true; // 登入成功
    } catch (error) {
      console.error("登入 API 請求失敗:", error);
      return false;
    }
  };

  // --- 登出函式 ---
  const logout = () => {
    localStorage.removeItem('accessToken');
    setToken(null);
    setUser(null);
    // 你也可以在這裡加入 navigate('/login')，但通常在元件層級處理跳轉更好
  };

  const value = { user, token, login, logout, isLoading };

  return (
    <AuthContext.Provider value={value}>
      {/* 只有在完成初始載入後，才渲染子元件，避免閃爍 */}
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

// 建立一個自訂的 Hook，讓其他元件可以輕鬆地使用 AuthContext
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth 必須在 AuthProvider 內部使用');
  }
  return context;
};