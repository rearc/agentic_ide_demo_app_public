import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The Playwright suite points the proxy at its own backend through this variable.
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:5001'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
})
