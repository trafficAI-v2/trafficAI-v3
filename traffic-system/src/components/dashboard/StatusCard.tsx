import React from 'react';
import type { StatusType } from '../../types';

// 定義 Props 的類型，新增 icon 和 type
interface StatusCardProps {
  title: string;
  value: string | number;
  status?: StatusType;
  type?: 'success' | 'info' | 'warning' | 'primary'; // 用於決定圖示顏色
  icon: React.ReactNode; // 用於傳遞圖示元件
}

const StatusCard: React.FC<StatusCardProps> = ({ title, value, status = 'default', type = 'primary', icon }) => {
  
  // 根據 status 決定如何顯示 value
  const renderValue = () => {
    if (status === 'ok') {
      return (
        <div className="card-value-status">
          <span className="status-dot"></span>
          <span>{value}</span>
        </div>
      );
    }
    return <p className="card-value">{value}</p>;
  };

  return (
    // 添加 type 類名，以便 CSS 可以根據它設定顏色
    <div className={`status-card card-type-${type}`}>
      <div className="card-text-content">
        <p className="card-title">{title}</p>
        {renderValue()}
      </div>
      <div className="card-icon-wrapper">
        {icon}
      </div>
    </div>
  );
};

export default StatusCard;