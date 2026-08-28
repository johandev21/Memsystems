import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@/app': path.resolve(__dirname, './src/app'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/features': path.resolve(__dirname, './src/features'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['@base-ui/react', '@base-ui/react/alert-dialog', 'react', 'react-dom'],
  },
  esbuild: {
    target: 'es2022',
  },
  build: {
    target: 'esnext',
  },
  server: {
    host: process.env.VITE_HOST || '127.0.0.1',
    port: 3000,
    strictPort: true,
    watch:
      process.env.VITE_USE_POLLING === 'true'
        ? {
            usePolling: true,
            interval: Number(process.env.VITE_POLLING_INTERVAL || 500),
          }
        : undefined,
    proxy: {
      '/api': {
        target: process.env.NESTJS_BACKEND_URL || 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
})

