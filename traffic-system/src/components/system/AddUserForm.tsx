// src/components/system/AddUserForm.tsx

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

interface AddUserFormProps {
  onSuccess: () => void; // 成功後要執行的回呼函式
  onCancel: () => void;  // 取消時要執行的回呼函式
}

const AddUserForm: React.FC<AddUserFormProps> = ({ onSuccess, onCancel }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'operator' | 'admin'>('operator'); // 預設為操作員
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { token } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      const response = await fetch(`${API_BASE_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ username, email, password, name, role }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '註冊失敗');
      }
      
      alert('使用者新增成功！');
      onSuccess(); // 呼叫成功後的回呼
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="add-user-form">
      {/* 表單欄位... (CSS class 可以在你的通用 CSS 或 system.css 中定義) */}
      <div className="form-group">
        <label>使用者名稱</label>
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
      </div>
      <div className="form-group">
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="form-group">
        <label>初始密碼</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <div className="form-group">
        <label>姓名</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="form-group">
        <label>角色</label>
        <select value={role} onChange={(e) => setRole(e.target.value as 'operator' | 'admin')}>
          <option value="operator">操作員</option>
          <option value="admin">系統管理員</option>
        </select>
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div className="form-actions">
        <button type="button" onClick={onCancel} disabled={isLoading}>取消</button>
        <button type="submit" disabled={isLoading}>
          {isLoading ? '儲存中...' : '建立使用者'}
        </button>
      </div>
    </form>
  );
};

export default AddUserForm;