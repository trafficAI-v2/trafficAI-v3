// src/pages/Profile.tsx

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import '../styles/profile.css'; // 引入我們即將建立的 CSS

const Profile: React.FC = () => {
  const { user, token } = useAuth(); // 從 Context 獲取使用者資訊和 token

  // --- 修改密碼表單的狀態管理 ---
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const getRoleDisplayName = (role: string) => {
    return role === 'admin' ? '系統管理員' : '操作員';
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // 前端驗證
    if (newPassword !== confirmPassword) {
      setError('新密碼與確認密碼不符');
      return;
    }
    if (newPassword.length < 8) {
      setError('新密碼長度至少需要 8 個字元');
      return;
    }

    setIsLoading(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      const response = await fetch(`${API_BASE_URL}/api/profile/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '密碼更新失敗');
      }

      setSuccessMessage('密碼已成功更新！');
      // 清空表單
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return <div className="page-container"><p>正在載入使用者資料...</p></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>個人資料</h1>
        <span>管理您的個人資訊與帳號安全</span>
      </div>

      <div className="profile-grid">
        {/* 左側：基本資訊卡片 */}
        <div className="profile-card content-card">
          <h2 className="card-title">基本資訊</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">使用者名稱</span>
              <span className="info-value">{user.username}</span>
            </div>
            <div className="info-item">
              <span className="info-label">姓名</span>
              <span className="info-value">{user.name}</span>
            </div>
            <div className="info-item">
              <span className="info-label">角色</span>
              <span className="info-value">{getRoleDisplayName(user.role)}</span>
            </div>
          </div>
        </div>

        {/* 右側：修改密碼卡片 */}
        <div className="profile-card content-card">
          <h2 className="card-title">修改密碼</h2>
          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label htmlFor="old-password">舊密碼</label>
              <input
                id="old-password"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="new-password">新密碼</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirm-password">確認新密碼</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="form-message error">{error}</p>}
            {successMessage && <p className="form-message success">{successMessage}</p>}

            <div className="form-actions">
              <button type="submit" disabled={isLoading}>
                {isLoading ? '更新中...' : '更新密碼'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;