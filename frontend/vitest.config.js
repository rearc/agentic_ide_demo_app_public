import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Deliberately separate from vite.config.js: the test run needs neither the dev
// server proxy nor the Tailwind plugin, and keeping them out makes it faster.
export default defineConfig({
  plugins: [react()],
  test: {
    // e2e/ holds Playwright specs, which run under `npm run test:e2e`.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    // Component styling is asserted through class names, never compiled CSS.
    css: false,
    // Undo spies/stubs between tests so one test cannot leak into the next.
    // mockReset matters as much as restoreMocks: clearing a mock forgets its
    // calls but keeps its implementation, so a mockResolvedValue set in one
    // test would otherwise still be in force in the next.
    restoreMocks: true,
    mockReset: true,
    unstubGlobals: true,
  },
})
