// src/context/AuthContext.tsx (完整、乾淨的最終版本)

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

// 定義 JWT Token 本身的結構 (符合後端實際格式)
interface DecodedToken {
  sub: string;           // JWT 標準的 subject (使用者名稱)
  role: 'admin' | 'operator';
  name: string;
  exp: number;          // Token 的過期時間
  iat: number;          // Token 簽發時間
}

// 定義 AuthContext 要提供給整個應用的資料和函式的型別
interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

// 建立 Context 物件
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 建立 Provider 元件，它將包裹我們的整個應用程式
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('accessToken'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      try {
        const decodedToken: DecodedToken = jwtDecode(token);
        if (decodedToken.exp * 1000 > Date.now()) {
          // 從 JWT payload 重新組合 User 物件
          const user: User = {
            username: decodedToken.sub,
            name: decodedToken.name,
            role: decodedToken.role
          };
          setUser(user);
        } else {
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
    setIsLoading(false);
  }, [token]);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) return false;
      const { access_token } = await response.json();
      localStorage.setItem('accessToken', access_token);
      setToken(access_token);
      return true;
    } catch (error) {
      console.error("登入 API 請求失敗:", error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    setToken(null);
    setUser(null);
  };

  const value = { user, token, login, logout, isLoading };

  return (
    <AuthContext.Provider value={value}>
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

// 【重要】確保檔案在此處結束，沒有任何 ReactDOM.createRoot(...) 的程式碼。