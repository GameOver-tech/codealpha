import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Force dep re-optimization on every dev start so a prior `vite build`
  // (which rewrites .vite/deps in production mode) never leaves a stale
  // cache where NODE_ENV-based branches (e.g. React's index.js) resolve
  // to null in the dev server.
  optimizeDeps: {
    force: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          motion: ['framer-motion'],
          query: ['@tanstack/react-query'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tabs', '@radix-ui/react-toast', '@radix-ui/react-tooltip'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          dropzone: ['react-dropzone'],
        },
      },
    },
    // Recharts is large and only used on the dashboard — don't let it
    // block first paint of other admin pages.
    chunkSizeWarningLimit: 700,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
