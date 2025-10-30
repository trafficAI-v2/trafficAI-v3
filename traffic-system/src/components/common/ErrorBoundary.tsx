// src/components/common/ErrorBoundary.tsx - React 錯誤邊界

import React, { Component } from 'react';
// 【核心修正】將 'ErrorInfo' 和 'ReactNode' 這兩個「純型別」的匯入，
// 從主要的 'React' 匯入中分離出來，並在前面加上 'type' 關鍵字。
// 這是為了解決 TypeScript 5+ 在啟用 'verbatimModuleSyntax' 規則時的編譯錯誤。
import type { ErrorInfo, ReactNode } from 'react';

// 定義 ErrorBoundary 元件接收的 props 型別
interface Props {
  // children 代表被 ErrorBoundary 包裹的子元件
  children: ReactNode;
  // fallback 是一個可選的 prop，允許你從外部傳入一個自訂的錯誤顯示元件
  fallback?: ReactNode;
}

// 定義 ErrorBoundary 元件自身的 state 型別
interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

// ErrorBoundary 必須是一個類別元件 (Class Component)
export class ErrorBoundary extends Component<Props, State> {
  // 初始化 state
  public state: State = {
    hasError: false
  };

  // 這是 React 的一個靜態生命週期方法。
  // 當任何子元件在渲染期間拋出錯誤時，這個方法會先被觸發。
  // 它會回傳一個新的 state 物件，來更新元件的狀態。
  public static getDerivedStateFromError(error: Error): State {
    // 更新 state，告訴元件現在處於「有錯誤」的狀態
    return { hasError: true, error };
  }

  // 這個生命週期方法會在 getDerivedStateFromError 之後被觸發。
  // 你可以在這裡獲取更詳細的錯誤資訊（例如，哪個元件出錯了），
  // 並將這些資訊發送到日誌記錄服務。
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 在開發者的主控台中印出詳細錯誤，方便除錯
    console.error('React Error Boundary 捕獲到錯誤:', error, errorInfo);

    // 將更詳細的 errorInfo 也存入 state，以便在畫面上顯示
    this.setState({
      error,
      errorInfo
    });

    // 在真實的生產環境中，你可以在這裡將錯誤發送到監控平台，例如 Sentry
    // Sentry.captureException(error, { extra: errorInfo });
  }

  // --- 事件處理函式 ---
  private readonly handleReload = () => {
    // 重新整理整個頁面
    globalThis.location.reload();
  };

  private readonly handleReset = () => {
    // 嘗試重設錯誤狀態，讓應用程式恢復
    // 注意：這只有在錯誤不是持續性的情況下才有效
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined
    });
  };

  // --- 渲染函式 ---
  public render() {
    // 如果 state 中的 hasError 為 true，就渲染我們的「降級 UI」
    if (this.state.hasError) {
      // 如果外部傳入了自訂的 fallback UI，就優先使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 否則，使用我們預設設計的錯誤 UI
      return (
        <div style={{
          padding: '2rem',
          margin: '2rem',
          border: '1px solid #ff4d4f',
          borderRadius: '8px',
          backgroundColor: '#fff2f0',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#ff4d4f', marginBottom: '1rem' }}>
            糟糕！應用程式發生了錯誤
          </h2>

          <p style={{ marginBottom: '1.5rem' }}>
            我們遇到了一個意外的問題。請嘗試重新載入頁面，如果問題持續發生，請聯繫技術支援。
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={this.handleReload}
              style={{ padding: '0.5rem 1rem', backgroundColor: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              重新載入頁面
            </button>
            <button
              onClick={this.handleReset}
              style={{ padding: '0.5rem 1rem', backgroundColor: '#52c41a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              嘗試恢復
            </button>
          </div>

          {/* 使用 import.meta.env.DEV，確保這段詳細的錯誤資訊只在開發模式下顯示 */}
          {import.meta.env.DEV && this.state.error && (
            <details style={{ marginTop: '2rem', textAlign: 'left', backgroundColor: '#f5f5f5', padding: '1rem', borderRadius: '4px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                錯誤詳情 (僅開發環境顯示)
              </summary>

              <pre style={{ fontSize: '12px', overflow: 'auto', marginTop: '0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    // 如果 state 中的 hasError 為 false (一切正常)，就正常渲染被它包裹的子元件
    return this.props.children;
  }
}