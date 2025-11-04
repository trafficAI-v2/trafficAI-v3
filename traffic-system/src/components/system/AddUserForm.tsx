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
      {/* ===== 【本次修改重點】 ===== */}
      <div className="form-group">
        {/* 使用 htmlFor 屬性關聯到 input 的 id */}
        <label htmlFor="username">使用者名稱</label>
        <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
      </div>
      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="form-group">
        <label htmlFor="password">初始密碼</label>
        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <div className="form-group">
        <label htmlFor="name">姓名</label>
        <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="form-group">
        <label htmlFor="role">角色</label>
        <select id="role" value={role} onChange={(e) => setRole(e.target.value as 'operator' | 'admin')}>
          <option value="operator">操作員</option>
          <option value="admin">系統管理員</option>
        </select>
      </div>
      {/* ========================== */}
      
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