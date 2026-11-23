import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { AuthShell } from './lib/authClient.tsx';
import './index.css';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegisterError() {
      // Ignore restricted preview iframe service worker registration errors
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <AuthShell>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </AuthShell>
);
