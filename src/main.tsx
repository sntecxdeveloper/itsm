import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store/store';
import App from './App';
import { ToastContainer } from './components/common/Toast';
import ErrorBoundary from './components/common/ErrorBoundary';
import { MotionProvider } from './motion';
import './styles/global.css';

// Capture unhandled errors and display them
window.addEventListener('error', (event) => {
  console.error('[GLOBAL ERROR]', event.message, event.filename, event.lineno);
  const root = document.getElementById('root');
  if (root && !root.querySelector('#error-display')) {
    const div = document.createElement('div');
    div.id = 'error-display';
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:red;color:white;padding:20px;z-index:99999;font-family:monospace;overflow:auto;font-size:12px';
    div.innerHTML = `<b>CRASH:</b><pre>${event.message}\n${event.filename}:${event.lineno}:${event.colno}\n${event.error?.stack || ''}</pre>`;
    root.appendChild(div);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[UNHANDLED REJECTION]', event.reason);
  const root = document.getElementById('root');
  if (root && !root.querySelector('#error-display')) {
    const div = document.createElement('div');
    div.id = 'error-display';
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:darkred;color:white;padding:20px;z-index:99999;font-family:monospace;overflow:auto;font-size:12px';
    div.innerHTML = `<b>PROMISE REJECTION:</b><pre>${event.reason?.stack || event.reason}</pre>`;
    root.appendChild(div);
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <MotionProvider>
          <ToastContainer />
          <App />
        </MotionProvider>
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>
);
