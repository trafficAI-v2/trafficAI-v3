//統計分析頁面
// src/pages/Analytics.tsx
import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { BiFilter, BiDownload, BiCalendar, BiErrorCircle } from 'react-icons/bi';
import './Analytics.css';

// 註冊 Chart.js 所有需要的元件
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler
);

// --- 圖表靜態設定 (顏色、樣式等) ---
// 我們會從 API 獲取數據，但保留這些設定來定義圖表的視覺外觀
const chartVisualConfigs = {
  trend: {
    label: '違規數量',
    backgroundColor: 'rgba(128, 116, 223, 0.1)',
    borderColor: 'rgba(128, 116, 223, 1)',
    tension: 0.4,
    pointBackgroundColor: 'rgba(128, 116, 223, 1)',
  },
  type: {
    backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#64748B'],
    borderColor: '#ffffff',
    borderWidth: 4,
  },
  location: {
    label: '違規次數',
    backgroundColor: 'rgba(22, 163, 74, 0.6)',
    borderColor: 'rgba(22, 163, 74, 1)',
    borderWidth: 1,
  },
  efficiency: {
    label: '平均處理時間(小時)',
    backgroundColor: 'rgba(139, 92, 246, 0.7)',
    borderColor: 'rgba(139, 92, 246, 1)',
    borderWidth: 1,
  },
  revenue: {
    label: '罰款金額',
    borderColor: '#F97316',
    backgroundColor: '#F97316',
    tension: 0.3,
  }
};

// 圖表通用選項
const commonChartOptions = (chartType: string) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: chartType === 'typeDistribution',
        position: 'bottom' as const,
        labels: { font: { family: 'inherit' }, padding: 20, usePointStyle: true, pointStyle: 'circle' }
      },
      title: { display: false },
    },
    scales: {
        x: { display: chartType !== 'typeDistribution', grid: { display: false }, ticks: { font: { family: 'inherit' } } },
        y: { display: chartType !== 'typeDistribution', grid: { color: '#e5e7eb', borderDash: [4, 4] }, ticks: { font: { family: 'inherit' } } }
    }
});


// React 元件主體
const Analytics: React.FC = () => {
  // --- 狀態管理 ---
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('last30days');

  // --- Effect Hook: 獲取 API 數據 ---
  useEffect(() => {
    const fetchAnalyticsData = async () => {
      setLoading(true);
      setError(null);
      try {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
        const response = await fetch(`${API_BASE_URL}/api/analytics?time_range=${timeRange}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || `API 請求失敗: ${response.status}`);
        }
        const data = await response.json();
        setAnalyticsData(data);
      } catch (err: any) {
        setError(err.message);
        console.error("獲取分析數據失敗:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [timeRange]); // 當 timeRange 改變時，重新觸發 API 請求

  // --- 渲染邏輯 ---
  if (loading) {
    return (
      <div className="analytics-page-status">
        <div className="loader"></div>
        <p>正在載入分析數據...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-page-status error">
        <BiErrorCircle size={48} />
        <h2>載入失敗</h2>
        <p>{error}</p>
      </div>
    );
  }
  
  // 確保 analyticsData 存在才渲染主體內容
  if (!analyticsData) {
    return <div className="analytics-page-status"><p>沒有可用的數據</p></div>;
  }

  // --- JSX 渲染主體 ---
  return (
    <div className="analytics-page">
      <div className="page-header-container">
        <div>
          <h1>統計分析</h1>
          <p>深入分析違規數據與執法效率</p>
        </div>
      </div>

      <div className="analytics-card filter-card">
        <div className="filter-header"><BiFilter /><h3>統計分析篩選器</h3></div>
        <div className="filters-grid">
            <div className="filter-group">
              <label htmlFor="time-range-select">時間範圍</label>
              <div className="date-picker-input">
                <BiCalendar className="date-picker-icon"/>
                <select id="time-range-select" value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
                    <option value="last90days">最近90天</option>
                    <option value="last60days">最近60天</option>
                    <option value="last30days">最近30天</option>
                    <option value="last7days">最近7天</option>
                    <option value="today">今日</option>
                </select>
              </div>
            </div>
            {/* 其他篩選器可以未來擴充 */}
        </div>
        <div className="filter-actions">
            <button className="btn-primary"><BiDownload />匯出報表</button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="analytics-card kpi-card">
            <span className="kpi-title">總違規數</span>
            <span className="kpi-value">{analyticsData.kpi.totalViolations.toLocaleString()}</span>
            <span className="kpi-subtitle">篩選範圍內</span>
        </div>
        <div className="analytics-card kpi-card">
            <span className="kpi-title">已開罰單</span>
            <span className="kpi-value">{analyticsData.kpi.ticketsIssued.toLocaleString()}</span>
            <span className="kpi-subtitle">篩選範圍內</span>
        </div>
        <div className="analytics-card kpi-card">
            <span className="kpi-title">罰鍰總額</span>
            <span className="kpi-value">NT$ {analyticsData.kpi.totalFines.toLocaleString()}</span>
            <span className="kpi-subtitle">篩選範圍內</span>
        </div>
        <div className="analytics-card kpi-card">
            <span className="kpi-title">確認率</span>
            <span className="kpi-value">{analyticsData.kpi.confirmationRate}%</span>
            <span className="kpi-subtitle">AI辨識準確率</span>
        </div>
      </div>

      <div className="charts-grid">
        <div className="analytics-card chart-card grid-col-span-2">
            <h3>違規趨勢</h3>
            <p>依日期統計違規數量</p>
            <div className="chart-container">
                <Line options={commonChartOptions('trend')} data={{
                  labels: analyticsData.trend.labels,
                  datasets: [{ ...chartVisualConfigs.trend, data: analyticsData.trend.data }]
                }} />
            </div>
        </div>

        <div className="analytics-card chart-card">
            <h3>違規類型分布</h3>
            <p>各類型違規佔比</p>
            <div className="chart-container donut-chart">
                <Doughnut options={commonChartOptions('typeDistribution')} data={{
                  labels: analyticsData.typeDistribution.labels,
                  datasets: [{ ...chartVisualConfigs.type, data: analyticsData.typeDistribution.data }]
                }} />
            </div>
        </div>
        
        <div className="analytics-card chart-card grid-col-span-3">
            <h3>高風險區域分析</h3>
            <p>違規熱點路段 Top 5</p>
            <div className="chart-container">
                <Bar options={{...commonChartOptions('location'), indexAxis: 'y'}} data={{
                  labels: analyticsData.locationAnalysis.labels,
                  datasets: [{ ...chartVisualConfigs.location, data: analyticsData.locationAnalysis.data }]
                }} />
            </div>
        </div>

        <div className="analytics-card chart-card grid-col-span-2">
            <h3>執法效率分析</h3>
            <p>此數據為靜態示意，需擴充資料庫欄位以實現</p>
            <div className="chart-container">
                <Bar options={commonChartOptions('efficiency')} data={{
                  labels: analyticsData.efficiencyAnalysis.labels,
                  datasets: [{ ...chartVisualConfigs.efficiency, data: analyticsData.efficiencyAnalysis.data }]
                }} />
            </div>
        </div>

         <div className="analytics-card chart-card grid-col-span-1">
            <h3>詳細數據</h3>
            <p>各類型違規統計</p>
            <ul className="details-list">
              {analyticsData.typeDistribution.labels.map((label: string, index: number) => (
                <li key={label}>
                  <span>{label}</span>
                  <strong>{analyticsData.typeDistribution.data[index]}</strong>
                </li>
              ))}
            </ul>
        </div>

        <div className="analytics-card chart-card grid-col-span-3">
            <h3>罰款收入統計</h3>
            <p>過去6個月每月罰款總額</p>
            <div className="chart-container">
                <Line options={commonChartOptions('revenue')} data={{
                  labels: analyticsData.revenue.labels,
                  datasets: [{ ...chartVisualConfigs.revenue, data: analyticsData.revenue.data }]
                }} />
            </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;