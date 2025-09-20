import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import io from 'socket.io-client';
import './ViolationPanel.css';

// --- 設定 ---
// ✅ 1. 只從 .env 讀取基礎 URL，並提供一個預設值以防開發時 .env 忘記設定
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002';

// ✅ 2. 正確地從基礎 URL 組合出「獲取最新紀錄」的 API 路徑
const LATEST_VIOLATIONS_API_URL = `${API_BASE_URL}/api/violations/latest`;

// ✅ 3. 使用基礎 URL 建立 WebSocket 連線
const socket = io(API_BASE_URL);

// 您的 Violation interface 定義 (保持不變)
interface Violation {
  id: number;
  type: string;
  plateNumber: string;
  timestamp: string;
  status: '待審核' | '已確認' | '已駁回';
}

const ViolationPanel: React.FC = () => {
  // 狀態管理 (保持不變)
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 首次載入時，從正確的 API 端點獲取初始資料
    const fetchInitialData = async () => {
      try {
        const response = await fetch(LATEST_VIOLATIONS_API_URL); // 使用修正後的 URL
        if (!response.ok) {
          throw new Error(`無法獲取初始資料，伺服器回應: ${response.status}`);
        }
        const data: Violation[] = await response.json();
        setViolations(data);
      } catch (err) {
        console.error("獲取初始資料失敗:", err); // 加入更詳細的錯誤日誌
        setError('無法載入違規紀錄。');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    // WebSocket 監聽邏輯 (保持不變)
    socket.on('connect', () => {
      console.log('✅ Connected to WebSocket server');
    });
    socket.on('new_violation', (newViolation: Violation) => {
      console.log('🚀 Received new violation via WebSocket:', newViolation);
      setViolations(prevViolations => 
        [newViolation, ...prevViolations].slice(0, 5)
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
  }, []); // 空依賴陣列，確保此 effect 只執行一次

  // 時間格式化函式 (保持不變)
  const formatTimestamp = (isoString: string): string => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const datePart = date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const timePart = date.toLocaleTimeString('zh-TW', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Taipei'
    });
    return `${datePart} ${timePart}`;
  };

  // 渲染邏輯 (保持不變)
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
        <span className="status-tag status-pending">{v.status}</span>
      </div>
    ));
  };
  
  return (
    <div className="panel violation-panel">
      <div className="panel-header"><h3>即時違規檢測</h3><p>最近檢測到的違規行為</p></div>
      <div className="violation-list">{renderContent()}</div>
      <NavLink to="/violations" className="view-all-records-btn">查看所有違規紀錄</NavLink>
    </div>
  );
};

export default ViolationPanel;