import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/styles/global.css'

const app = createApp(App)

// --- 클라이언트 에러 로깅 연동 코드 (UI 없이 백엔드로만 전송) ---

const logErrorToServer = (error, info = '') => {
  const errorData = {
    message: error?.message || String(error),
    stack: error?.stack || '',
    info: info,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
  };

  fetch('/api/system-report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(errorData)
  }).catch(err => {
    console.error('Failed to send error log to server:', err);
  });
};

app.config.errorHandler = (err, instance, info) => {
  console.error('Vue Global Error:', err, info);
  logErrorToServer(err, `Vue info: ${info}`);
};

window.addEventListener('error', (event) => {
  console.error('Window Global Error:', event.error || event.message);
  logErrorToServer(event.error || new Error(event.message), 'window.onerror');
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason);
  logErrorToServer(event.reason || new Error(event.reason?.message || 'Unhandled promise rejection'), 'unhandledrejection');
});

// ---------------------------------------------------

app.use(router)

app.mount('#app')
