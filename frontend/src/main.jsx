import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/ported.css';
import './styles/auth.css';
import './styles/mobile.css';
import './styles/app.css';

import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { ConfirmProvider } from './components/Modal';
import { ToastProvider } from './components/Toast';
import { initPWA } from './lib/pwa';
import { applyTheme, getTheme } from './lib/theme';

applyTheme(getTheme());
initPWA();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 4xx is an answer, not a glitch: don't retry it. Retry network/server blips once or twice.
      retry: (count, err) => !(err?.status >= 400 && err?.status < 500) && count < 2,
      refetchOnWindowFocus: true,
      staleTime: 2000,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <ConfirmProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ConfirmProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
