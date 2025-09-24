// src/pages/Login.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // 這裡是我們之後會用 AuthContext 替換的部分
    // 為了測試畫面，我們先模擬一個假的登入過程
    console.log('Attempting to log in with:', username);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 模擬網路延遲

    // 模擬成功或失敗
    if (username === 'admin' && password === 'password') {
      console.log('Login successful!');
      navigate('/'); // 登入成功，跳轉到首頁
    } else {
      setError('使用者名稱或密碼錯誤');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="login-page-container">
      <div className="login-card">
        <h1 className="login-title">Traffic AI</h1>
        <p className="login-subtitle">交通違規檢測系統</p>
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <label htmlFor="username">使用者帳號</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="請輸入使用者名稱或Email"
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="password">密碼</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="請輸入密碼"
              required
            />
          </div>

          {error && <p className="error-message">{error}</p>}

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? '登入中...' : '登入'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;