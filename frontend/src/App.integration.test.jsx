import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import App from './App'

function nextArrow() {
  return screen.getByRole('button', { name: 'Next profile' })
}
import {
  boardEntry,
  cardRecord,
  jsonResponse,
  profileRecord,
} from './test/helpers'

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
  }),
  cardRecord({ id: 2, title: 'Daily Quote', source: 'quote' }),
  cardRecord({ id: 3, title: 'Coming Soon', source: 'placeholder' }),
  cardRecord({ id: 4, title: 'Space Photo', source: 'space' }),
  cardRecord({ id: 5, title: 'Todos', source: 'todo' }),
]

// Default shows every card; Focus only the todos.
const PROFILES = [
  profileRecord({
    id: 1,
    name: 'Default',
    board: {
      1: boardEntry({ x: 0, y: 0, w: 4, h: 4 }),
      2: boardEntry({ x: 4, y: 0, w: 4, h: 4 }),
      3: boardEntry({ x: 8, y: 0, w: 4, h: 4 }),
      4: boardEntry({ x: 0, y: 4, w: 6, h: 7 }),
      5: boardEntry({ x: 6, y: 4, w: 6, h: 7 }),
    },
  }),
  profileRecord({
    id: 2,
    name: 'Focus',
    board: { 5: boardEntry({ x: 0, y: 0, w: 12, h: 8 }) },
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
    icon: 'cloud',
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

/**
 * Stands in for the Flask API, routing on the path. A profile PATCH answers
 * with the profile as sent; the test reads the request it was given.
 */
function stubBackend({ todos = [], failingSource } = {}) {
  globalThis.fetch = vi.fn(async (url, { method, body }) => {
    const path = String(url)
    if (method === 'GET' && path === '/api/cards') return jsonResponse(CARDS)
    if (method === 'GET' && path === '/api/profiles')
      return jsonResponse(PROFILES)
    if (method === 'PATCH' && path.startsWith('/api/profiles/'))
      return jsonResponse(JSON.parse(body))
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

// jsdom lays nothing out, so every element is 0 px wide and the dashboard
// would stack its cards. The board under test is a desktop-width one.
const offsetWidth = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetWidth',
)
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => 1200,
  })
})
afterAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', offsetWidth)
})

// The shown profile is remembered in localStorage (TEST-3).
beforeEach(() => {
  localStorage.clear()
})

/** The board each profile PATCH sent, in order. */
function savedBoards() {
  return fetch.mock.calls
    .filter(([, init]) => init.method === 'PATCH')
    .map(([url, init]) => [url, JSON.parse(init.body).board])
}

/** Render the app against the stub and wait for every card to finish loading. */
async function renderApp(backend) {
  stubBackend(backend)
  render(<App />)
  // The first render of the whole app can pass waitFor's 1 s default under load
  // (seen when several sessions run tests at once), so allow longer.
  await waitFor(() => expect(screen.queryAllByRole('status')).toHaveLength(0), {
    timeout: 5000,
  })
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

    await user.click(screen.getByRole('button', { name: 'Edit board' }))

    expect(screen.getAllByTitle('Drag to move')).toHaveLength(CARDS.length)
  })

  it('keeps one failing card from taking down the rest of the board', async () => {
    await renderApp({ failingSource: 'quote' })

    expect(screen.getByText('Internal server error')).toBeInTheDocument()
    expect(screen.getByText('65°')).toBeInTheDocument()
  })

  it('hides a card with its × and saves it hidden', async () => {
    const user = userEvent.setup()
    await renderApp()

    await user.click(screen.getByRole('button', { name: 'Edit board' }))
    await user.click(
      screen.getByRole('button', { name: 'Remove "Daily Quote"' }),
    )

    expect(
      screen.queryByRole('heading', { name: 'Daily Quote' }),
    ).not.toBeInTheDocument()
    await waitFor(() =>
      expect(savedBoards()).toEqual([
        [
          '/api/profiles/1',
          { ...PROFILES[0].board, 2: boardEntry({ x: 4, hidden: true }) },
        ],
      ]),
    )
  })

  it('adds a card from the library to the board', async () => {
    const user = userEvent.setup()
    localStorage.setItem('dashboard.profileId', '2')
    await renderApp()

    await user.click(screen.getByRole('button', { name: 'Edit board' }))
    await user.click(screen.getByRole('button', { name: 'Add "Coming Soon"' }))

    expect(
      screen.getByRole('heading', { name: 'Coming Soon' }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(savedBoards()).toEqual([
        [
          '/api/profiles/2',
          { ...PROFILES[1].board, 3: boardEntry({ x: 0, y: 8, w: 8, h: 8 }) },
        ],
      ]),
    )
  })

  it.each([
    ['its next arrow', (user) => user.click(nextArrow())],
    ['the right arrow key', (user) => user.keyboard('{ArrowRight}')],
  ])('turns to the next profile with %s', async (_case, turn) => {
    const user = userEvent.setup()
    await renderApp()

    await turn(user)

    expect(
      screen.getByRole('button', { name: 'Control Center, profile Focus' }),
    ).toBeInTheDocument()
  })

  it('leaves the arrow keys alone while typing', async () => {
    const user = userEvent.setup()
    await renderApp()

    await user.click(screen.getByPlaceholderText('Add a task…'))
    await user.keyboard('{ArrowRight}')

    expect(
      screen.getByRole('button', { name: 'Control Center, profile Default' }),
    ).toBeInTheDocument()
  })

  it('switches the board from the profile menu', async () => {
    const user = userEvent.setup()
    await renderApp()

    await user.click(screen.getByRole('button', { name: /Control Center/ }))
    await user.click(
      within(screen.getByRole('region', { name: 'Profiles' })).getByRole(
        'button',
        { name: 'Focus' },
      ),
    )

    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual([
      'Todos',
    ])
  })
})
