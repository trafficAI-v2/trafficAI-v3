// src/types/index.ts

// 狀態卡片的類型
export type StatusType = 'ok' | 'warning' | 'error' | 'default';

// 攝影機資訊
export interface Camera {
  id: string;
  name: string;
}

// 違規事件
export interface Violation {
  id: string;
  timestamp: string; // 或 Date
  cameraName: string;
  type: string; // 例如：超速、闖紅燈
  imageUrl: string;
}

export interface ViolationType {
  type: string;
  confidence: number;
}

// src/types/statistics.ts

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  fill?: boolean;
  tension?: number;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface KpiData {
  totalViolations: { value: number; period: string };
  correctionRate: { value: number; source: string };
  billingRate: { value: number; period: string };
  totalFine: { value: number; period: string };
}

export interface DashboardAnalyticsData {
  kpis: KpiData;
  violationTrend: ChartData;
  violationTypeDistribution: ChartData;
  highRiskArea: ChartData;
  enforcementEfficiency: ChartData;
  fineRevenue: ChartData;
}

export interface StatisticsFilters {
    // 您可以根據後端需求定義篩選條件的類型
    // 例如： dateRange: [string, string] | null;
    timeUnit: '日' | '週' | '月';
    violationType: string;
    location: string;
}