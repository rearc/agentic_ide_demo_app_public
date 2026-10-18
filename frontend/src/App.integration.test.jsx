import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import App from './App'
import { cardRecord, jsonResponse } from './test/helpers'

/**
 * The one test file that renders the real tree: App -> Dashboard -> Card ->
 * each card component, through the real api.js and the real react-grid-layout.
 *
 * Every other frontend test mocks at its own boundary, which means none of
 * them can catch a wiring mistake *between* those layers - a card registered
 * under a source the backend does not serve, a fetch that never fires, a prop
 * that stops being threaded through. Only the network is stubbed here, so
 * behaviour a component test already pins is not repeated.
 */

const CARDS = [
  cardRecord({
    id: 1,
    title: 'Weather',
    source: 'weather',
    config: { city: 'San Francisco' },
    layout: { x: 0, y: 0, w: 4, h: 4 },
  }),
  cardRecord({
    id: 2,
    title: 'Daily Quote',
    source: 'quote',
    layout: { x: 4, y: 0, w: 4, h: 4 },
  }),
  cardRecord({
    id: 3,
    title: 'Coming Soon',
    source: 'placeholder',
    layout: { x: 8, y: 0, w: 4, h: 4 },
  }),
  cardRecord({
    id: 4,
    title: 'Space Photo',
    source: 'space',
    layout: { x: 0, y: 4, w: 6, h: 7 },
  }),
  cardRecord({
    id: 5,
    title: 'Todos',
    source: 'todo',
    layout: { x: 6, y: 4, w: 6, h: 5 },
  }),
]

// No entry for placeholder or todo: neither fetches card data, and a request
// for either would 404 here as it does on the real backend, replacing the
// card's content with an error.
const DATA = {
  weather: {
    city: 'San Francisco',
    temp: 18.3,
    description: 'Overcast',
    icon_emoji: '☁️',
    humidity: 72,
  },
  quote: {
    text: 'Simplicity is the soul of efficiency.',
    author: 'Austin Freeman',
  },
  space: {
    title: 'Pillars of Creation',
    url: 'https://example.test/pillars.jpg',
    explanation: 'A star-forming region.',
    date: '2026-07-19',
    media_type: 'image',
  },
}

/** Stands in for the Flask API's read routes, routing on the path. */
function stubBackend({ todos = [], failingSource } = {}) {
  globalThis.fetch = vi.fn(async (url, { method }) => {
    const path = String(url)
    if (method === 'GET' && path === '/api/cards') return jsonResponse(CARDS)
    if (method === 'GET' && path.startsWith('/api/todos'))
      return jsonResponse(todos)

    const source = method === 'GET' && path.match(/^\/api\/data\/([^?]+)/)?.[1]
    if (!source)
      throw new Error(`Integration stub has no route for ${method} ${path}`)
    if (source === failingSource)
      return jsonResponse({ error: 'Internal server error' }, { status: 500 })
    if (source in DATA) return jsonResponse(DATA[source])
    return jsonResponse(
      { error: `Unknown source: ${source}` },
      { status: 404, statusText: 'Not Found' },
    )
  })
}

/** Render the app against the stub and wait for every card to finish loading. */
async function renderApp(backend) {
  stubBackend(backend)
  render(<App />)
  await waitFor(() => expect(screen.queryAllByRole('status')).toHaveLength(0))
}

describe('the whole board', () => {
  it('routes each card to its widget with live data', async () => {
    await renderApp({
      todos: [
        { id: 1, card_id: 5, text: 'Try checking this off', done: false },
      ],
    })

    // Weather: fetched in Celsius, shown in the °F default.
    expect(screen.getByText('65°')).toBeInTheDocument()
    expect(
      screen.getByText('Simplicity is the soul of efficiency.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Pillars of Creation' }),
    ).toBeInTheDocument()
    expect(screen.getByText('What should we build here?')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Try checking this off' }),
    ).toBeInTheDocument()
  })

  it('threads the lock state from the header button down to every card', async () => {
    const user = userEvent.setup()
    await renderApp()

    expect(screen.queryAllByTitle('Drag to move')).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Customize layout' }))

    expect(screen.getAllByTitle('Drag to move')).toHaveLength(CARDS.length)
  })

  it('keeps one failing card from taking down the rest of the board', async () => {
    await renderApp({ failingSource: 'quote' })

    expect(screen.getByText('Internal server error')).toBeInTheDocument()
    expect(screen.getByText('65°')).toBeInTheDocument()
  })
})
