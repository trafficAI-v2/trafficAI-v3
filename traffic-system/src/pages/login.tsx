// src/pages/Login.tsx (新版，匹配新設計)

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // 引入 Link 用於註冊連結
import { BiShield, BiShow, BiHide } from 'react-icons/bi'; // 引入圖示
import './Login.css';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // 新增狀態來控制密碼可視
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // 這裡我們仍然保留假的登入邏輯，下一步才會整合 AuthContext
    console.log('Attempting to log in with:', { username, password, rememberMe });
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (username === 'admin' && password === 'password') {
      console.log('Login successful!');
      navigate('/');
    } else {
      setError('帳號或密碼錯誤，請重新輸入');
    }
    
    setIsLoading(false);
  };

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
};

export default Login;