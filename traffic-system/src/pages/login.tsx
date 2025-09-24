// src/pages/Login.tsx (完整修正版)

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BiShield, BiShow, BiHide } from 'react-icons/bi';
import { useAuth } from '../context/AuthContext'; 
import './Login.css';

// 【修正點 1】確保元件定義的型別是 React.FC，而不是 React.FC<{}>
const Login: React.FC = () => {
  // --- 狀態管理 (State Hooks) ---
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // --- React Hooks ---
  const navigate = useNavigate();
  const { login } = useAuth(); 

  // --- 事件處理函式 ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const success = await login(username, password);
      
      if (success) {
        navigate('/'); // 登入成功，跳轉到首頁
      } else {
        setError('帳號或密碼錯誤，請重新輸入');
      }
    } catch (err) {
      console.error("登入過程中發生錯誤:", err);
      setError('登入失敗，請檢查網路連線或稍後再試');
    } finally {
      setIsLoading(false);
    }
  };

  // --- JSX 渲染部分 ---
  // 【修正點 2】將正確的 JSX return 區塊放在這裡
  return (
    <div className="login-page-container">
      <div className="login-header">
        <BiShield className="header-icon" />
        <h1 className="header-title">登入系統</h1>
        <p className="header-subtitle">交通違規自動檢測與罰單系統</p>
      </div>

      <div className="login-card">
        <div className="card-header">
            <h2 className="card-title">歡迎回來</h2>
            <p className="card-subtitle">請輸入您的帳號密碼以登入系統</p>
        </div>
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <label htmlFor="username">帳號</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="請輸入帳號"
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="password">密碼</label>
            <div className="password-wrapper">
                <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="請輸入密碼"
                    required
                />
                <span className="password-toggle-icon" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <BiHide /> : <BiShow />}
                </span>
            </div>
          </div>

          <div className="options-group">
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              記住我
            </label>
            <Link to="/forgot-password" className="forgot-password-link">忘記密碼？</Link>
          </div>

          {error && <p className="error-message">{error}</p>}

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? '登入中...' : '登入'}
          </button>

          <p className="signup-link">
            還沒有帳號？ <Link to="/register">立即註冊</Link>
          </p>
        </form>
      </div>
    </div>
  );
}; // <--- 元件定義在這裡結束

// 【修正點 3】確保整個檔案只有這一個預設匯出
export default Login;