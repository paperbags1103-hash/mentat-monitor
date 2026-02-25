import React, { Component, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div style={{
          padding: '32px', fontFamily: 'monospace', background: '#0a0a0f', color: '#f1f5f9',
          minHeight: '100vh', whiteSpace: 'pre-wrap'
        }}>
          <h2 style={{ color: '#ef4444', marginBottom: '16px' }}>🚨 런타임 에러</h2>
          <p style={{ color: '#f97316', marginBottom: '8px' }}>{err.message}</p>
          <pre style={{ color: '#94a3b8', fontSize: '12px' }}>{err.stack}</pre>
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
