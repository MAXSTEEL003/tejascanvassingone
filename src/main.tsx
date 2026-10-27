import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Signal watchdog that JS execution has begun
(window as any).__APP_MOUNTED__ = true;

const container = document.getElementById('root');
if (container) {
  try {
    createRoot(container).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  } catch (err: any) {
    console.error('Tejas Canvassing - Mount Error:', err);
    container.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #fafaf9;">
        <div style="max-width: 400px; width: 100%; padding: 28px; background: white; border-radius: 20px; border: 1px solid #f87171; box-shadow: 0 16px 36px rgba(0,0,0,0.06); text-align: center;">
          <h2 style="margin: 0; font-size: 18px; color: #b45309; font-weight: 800;">Tejas Canvassing - Recovery</h2>
          <p style="font-size: 12px; color: #4b5563; margin: 12px 0 16px;">${err?.message || 'A render initialization error occurred.'}</p>
          <button onclick="localStorage.clear(); sessionStorage.clear(); window.location.href='/?clean=' + Date.now();" style="width: 100%; padding: 12px; background: #d97706; color: white; border: none; border-radius: 12px; font-size: 12px; font-weight: bold; cursor: pointer;">
            Clear Local Cache & Restart
          </button>
        </div>
      </div>
    `;
  }
}


