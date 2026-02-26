import React, { Component, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { initTheme } from '@/store/theme';
initTheme(); // 저장된 테마를 DOM에 즉시 적용 (첫 렌더 전)

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; componentStack: string }
> {
  state = { error: null, componentStack: '' };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // 개발 디버깅: 콘솔에 전체 컴포넌트 스택 출력
    console.error('[Mentat ErrorBoundary]', error.message, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? '' });
  }

  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div style={{
          padding: '32px', fontFamily: 'monospace', background: '#0a0a0f', color: '#f1f5f9',
          minHeight: '100vh', whiteSpace: 'pre-wrap', overflow: 'auto',
        }}>
          <h2 style={{ color: '#ef4444', marginBottom: '16px' }}>🚨 런타임 에러</h2>
          <p style={{ color: '#f97316', marginBottom: '8px', fontWeight: 'bold' }}>{err.message}</p>
          {this.state.componentStack && (
            <details style={{ marginBottom: '12px' }}>
              <summary style={{ color: '#64748b', cursor: 'pointer' }}>컴포넌트 스택 (클릭해서 펼치기)</summary>
              <pre style={{ color: '#64748b', fontSize: '11px', marginTop: '8px' }}>{this.state.componentStack}</pre>
            </details>
          )}
          <pre style={{ color: '#94a3b8', fontSize: '12px' }}>{err.stack}</pre>
          <button
            onClick={() => this.setState({ error: null, componentStack: '' })}
            style={{
              marginTop: '24px', padding: '8px 16px', background: '#3b82f6', color: 'white',
              border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'monospace',
            }}
          >↺ 재시작</button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
