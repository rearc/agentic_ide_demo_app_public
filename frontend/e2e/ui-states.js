// The page states the check-ui skill checks (.claude/skills/check-ui/), at
// each width. A state is a function that takes the page from first load to
// that state, and returns false where it does not apply. States must not
// change data; the skill's script refuses every write to /api anyway.

const STACKED = 768 // below this the board stacks its cards (Dashboard.jsx)

// A worktree's own ports (scripts/worktree-setup.mjs).
try {
  process.loadEnvFile(new URL('../../.dev-ports', import.meta.url))
} catch {
  // no .dev-ports: the default port
}

export default {
  // `npm run dev`; pass --url for another server.
  url: `http://localhost:${process.env.FRONTEND_PORT ?? 5173}`,
  widths: [390, 768, 1280],
  height: 800,

  // The page is ready once the board has rendered a card.
  ready: (page) => page.locator('h2').first().waitFor(),

  // Where these sit is printed for every state, as text.
  measure: {
    header: 'header',
    library: '#card-library',
    board: 'main',
  },

  states: {
    viewing: async () => {},
    'library open': async (page) => {
      await page.getByRole('button', { name: 'Edit board' }).click()
    },
    'library folded': async (page, width) => {
      if (width < STACKED) return false
      await page.getByRole('button', { name: 'Edit board' }).click()
      await page.getByRole('button', { name: 'Library', exact: true }).click()
    },
    'profile menu': async (page) => {
      await page.getByRole('button', { name: /^Control Center/ }).click()
    },
  },
}
