import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/queries/client';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import App from '@/App';
import '@/styles/globals.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('[wiscord] Root element #root not found in index.html');
}

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <TooltipProvider delayDuration={150}>
              <App />
            </TooltipProvider>
          </AuthProvider>
        </BrowserRouter>
        <Toaster />
        {/* Bottom-left so the dev toggle doesn't sit under the AI launcher,
            which now occupies the bottom-right corner. */}
        {import.meta.env.DEV && (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        )}
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
