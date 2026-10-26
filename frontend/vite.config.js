import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// A worktree's own ports (scripts/worktree-setup.mjs); the main checkout has no
// such file and keeps 5173 and 5001. Variables already set win over the file.
try {
  process.loadEnvFile(new URL('../.dev-ports', import.meta.url))
} catch {
  // no .dev-ports: the default ports
}

const PORT = Number(process.env.FRONTEND_PORT ?? 5173)
// The Playwright suite points the proxy at its own backend through this variable.
const API_PROXY_TARGET =
  process.env.API_PROXY_TARGET ??
  `http://127.0.0.1:${process.env.BACKEND_PORT ?? 5001}`

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Inside the checkout, not node_modules: a worktree links the main checkout's
  // node_modules, and two dev servers must not share one dependency cache.
  cacheDir: '.vite',
  server: {
    port: PORT,
    // Fail rather than drift to the next port, where the proxy and the
    // checks would not look for it.
    strictPort: true,
    proxy: {
      '/api': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
})
