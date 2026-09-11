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
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              // Shared between the eager notebook workspace (chat, dialogs)
              // and the lazy study-material viewer. Kept in its own tiny chunk
              // so neither side has to load the other's graph.
              name: 'notebook-model-shared',
              test: /features[\\/]notebooks[\\/](context[\\/]notebook-model-state|hooks[\\/]use-model-persistence)\.ts$/,
              priority: 10,
            },
            {
              // Query helpers shared by the eager study-materials tree and the
              // lazy viewer — same rationale as notebook-model-shared.
              name: 'study-material-api-shared',
              test: /features[\\/]study-material-viewer[\\/]api[\\/](index|study-materials)\.ts$/,
              priority: 10,
            },
            {
              // zod is used by both eager dialogs and lazy viewer shapes;
              // without this group rolldown parks zod inside the lazy viewer
              // chunk, forcing the notebook route to load it up front.
              name: 'zod-vendor',
              test: /node_modules[\\/]zod[\\/]/,
              priority: 20,
            },
          ],
        },
      },
    },
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

