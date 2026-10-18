import { defineConfig, devices } from '@playwright/test'

const BACKEND_PORT = 5011
const FRONTEND_PORT = 5183

// Ports and database differ from `npm run dev` on purpose, and nothing is
// reused, so the suite never touches a dev server or the presenter's app.db.
export default defineConfig({
  testDir: 'e2e',
  // One backend, one database: specs share it, so they run one at a time.
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/start-backend.mjs',
      url: `http://127.0.0.1:${BACKEND_PORT}/api/cards`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${FRONTEND_PORT} --strictPort`,
      url: `http://localhost:${FRONTEND_PORT}`,
      env: { API_PROXY_TARGET: `http://127.0.0.1:${BACKEND_PORT}` },
      reuseExistingServer: false,
    },
  ],
})
