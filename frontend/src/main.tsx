import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import AppRouter from '@/routes'
import { AuthProvider, ThemeProvider, SpeechProvider } from '@/context'
import '@/styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <SpeechProvider>
            <AppRouter />
            <Toaster
              position="top-right"
              gutter={10}
              containerStyle={{ top: 20, right: 20 }}
              toastOptions={{
                duration: 4000,
                style: {
                  borderRadius: '12px',
                  background: 'var(--card)',
                  color: 'var(--card-foreground)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 8px 30px -6px rgb(15 23 42 / 0.15)',
                  fontSize: '13px',
                  maxWidth: '360px',
                },
                success: { iconTheme: { primary: '#22C55E', secondary: 'white' } },
                error: { iconTheme: { primary: '#EF4444', secondary: 'white' } },
              }}
            />
          </SpeechProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
