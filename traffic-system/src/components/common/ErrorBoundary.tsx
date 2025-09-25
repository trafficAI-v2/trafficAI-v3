// src/components/common/ErrorBoundary.tsx - React 錯誤邊界

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // 更新 state，以便下一次渲染顯示錯誤 UI
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 記錄錯誤到控制台或錯誤監控服務
    console.error('React Error Boundary 捕獲到錯誤:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });

    // 這裡可以加入錯誤監控服務，例如 Sentry
    // Sentry.captureException(error, { extra: errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined
    });
  };

  public render() {
    if (this.state.hasError) {
      // 如果有自訂的 fallback UI，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 預設的錯誤 UI
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
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#1890ff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              重新載入頁面
            </button>

            <button
              onClick={this.handleReset}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#52c41a',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              嘗試恢復
            </button>
          </div>

          {/* 在開發環境顯示詳細錯誤資訊 */}
          {import.meta.env.DEV && this.state.error && (
            <details style={{
              marginTop: '2rem',
              textAlign: 'left',
              backgroundColor: '#f5f5f5',
              padding: '1rem',
              borderRadius: '4px'
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                錯誤詳情 (僅開發環境顯示)
              </summary>

              <pre style={{
                fontSize: '12px',
                overflow: 'auto',
                marginTop: '0.5rem'
              }}>
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}