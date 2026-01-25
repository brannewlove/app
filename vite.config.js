import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      vue(),
      vueDevTools(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    server: {
      port: parseInt(env.VITE_PORT) || 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path
        }
      },
      historyApiFallback: true
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-charts': ['chart.js', 'vue-chartjs'],
            'vendor-utils': ['axios', 'vue-router']
          }
        }
      },
      chunkSizeWarningLimit: 1000
    },
    test: {
      environment: 'happy-dom',
      exclude: ['backend/**', 'node_modules/**', 'dist/**']
    }
  }
})
