import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import io from 'socket.io-client';
import './ViolationPanel.css';

// --- 設定 ---
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002';
const LATEST_VIOLATIONS_API_URL = `${API_BASE_URL}/api/violations/latest`;
const socket = io(API_BASE_URL);

// Violation interface (保持不變)
interface Violation {
  id: number;
  type: string;
  plateNumber: string;
  timestamp: string;
  status: '待審核' | '已確認' | '已駁回' | '已開罰';
}

const ViolationPanel: React.FC = () => {
  // 狀態管理 (保持不變)
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 首次載入時，從 API 端點獲取初始資料
    const fetchInitialData = async () => {
      try {
        const response = await fetch(LATEST_VIOLATIONS_API_URL);
        if (!response.ok) {
          throw new Error(`無法獲取初始資料，伺服器回應: ${response.status}`);
        }
        const data: Violation[] = await response.json();
        setViolations(data);
      } catch (err) {
        console.error("獲取初始資料失敗:", err);
        setError('無法載入違規紀錄。');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    // WebSocket 監聽邏輯
    socket.on('connect', () => {
      console.log('✅ Connected to WebSocket server');
    });
    socket.on('new_violation', (newViolation: Violation) => {
      console.log('🚀 Received new violation via WebSocket:', newViolation);
      setViolations(prevViolations => 
        [newViolation, ...prevViolations].slice(0, 8)
      );
    });
    socket.on('disconnect', () => {
      console.log('❌ Disconnected from WebSocket server');
    });

    // 組件卸載時，清理所有監聽器
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('new_violation');
    };
  }, []);

  // 【核心修改】替換為不進行時區轉換的時間格式化函式
  const formatTimestamp = (isoString: string): string => {
    if (!isoString) return '';
    try {
      // 範例: "2025-09-21T15:55:34.022801Z"
      const [datePartStr, timePartStrWithZone] = isoString.split('T');
      const datePart = datePartStr.replaceAll('-', '/'); // 2025/09/21

      if (!timePartStrWithZone) return datePart;

      const mainTimePart = timePartStrWithZone.split('.')[0]; // 15:55:34
      const [hours, minutes, seconds] = mainTimePart.split(':').map(Number);

      if ([hours, minutes, seconds].some(Number.isNaN)) throw new Error('Invalid time');
      
      const ampm = hours >= 12 ? '下午' : '上午';
      let displayHours = hours % 12 || 12; // 處理 12 點和午夜

      const timePart = `${ampm} ${displayHours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      
      return `${datePart} ${timePart}`;
    } catch (e) {
      console.error("無法解析時間戳字串 (ViolationPanel):", isoString, e);
      return '無效日期';
    }
  };

  // 渲染邏輯
  const renderContent = () => {
    if (loading) return <div className="panel-message">正在載入最新紀錄...</div>;
    if (error) return <div className="panel-message error">{error}</div>;
    if (violations.length === 0) return <div className="panel-message">目前沒有新的違規紀錄</div>;
    
    return violations.map(v => (
      <div key={v.id} className="violation-item">
        <div className="violation-details">
          <span className="violation-type">{v.type}</span>
          <span className="violation-info">車牌: {v.plateNumber}</span>
          <span className="violation-info">{formatTimestamp(v.timestamp)}</span>
        </div>
        <span className={`status-tag status-${v.status}`}>{v.status}</span>
      </div>
    ));
  };
  
  return (
    <div className="violation-panel">
      <div className="panel-header">
        <h3>即時違規檢測通知</h3>
        <p>最近檢測到的違規行為</p>
      </div>
      <div className="violation-list">
        {renderContent()}
      </div>
      <NavLink to="/violations" className="view-all-records-btn">
        查看所有違規紀錄
      </NavLink>
    </div>
  );
};

export default ViolationPanel;