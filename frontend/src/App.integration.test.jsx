import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'

/**
 * The one test that renders the real tree: App -> Dashboard -> Card -> each
 * card component, through the real api.js and the real react-grid-layout.
 *
 * Every other frontend test mocks at its own boundary, which means none of
 * them can catch a wiring mistake *between* those layers - a card registered
 * under a source the backend does not serve, a fetch that never fires, a prop
 * that stops being threaded through. Only the network is stubbed here.
 */

const CARDS = [
  {
    id: 1,
    slug: 'weather',
    title: 'Weather',
    description: 'Current conditions',
    icon: '☀️',
    source: 'weather',
    config: { city: 'San Francisco' },
    layout: { x: 0, y: 0, w: 4, h: 4 },
    position: 1,
    is_active: true,
  },
  {
    id: 2,
    slug: 'quote',
    title: 'Daily Quote',
    description: 'Inspiration',
    icon: '💬',
    source: 'quote',
    config: {},
    layout: { x: 4, y: 0, w: 4, h: 4 },
    position: 2,
    is_active: true,
  },
  {
    id: 3,
    slug: 'placeholder',
    title: 'Coming Soon',
    description: 'Next widget',
    icon: '✨',
    source: 'placeholder',
    config: {},
    layout: { x: 8, y: 0, w: 4, h: 4 },
    position: 3,
    is_active: true,
  },
  {
    id: 4,
    slug: 'space',
    title: 'Space Photo',
    description: 'APOD',
    icon: '🚀',
    source: 'space',
    config: {},
    layout: { x: 0, y: 4, w: 6, h: 7 },
    position: 4,
    is_active: true,
  },
  {
    id: 5,
    slug: 'todo',
    title: 'Todos',
    description: 'Track what needs doing',
    icon: '✅',
    source: 'todo',
    config: {},
    layout: { x: 6, y: 4, w: 6, h: 5 },
    position: 5,
    is_active: true,
  },
]

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
  placeholder: { message: 'Nothing here yet!' },
}

/** Stands in for the Flask API, routing on method and path like the real one. */
function stubBackend({ todos = [] } = {}) {
  const state = { todos: [...todos], nextTodoId: 100 }

  const fetchMock = vi.fn(async (url, options = {}) => {
    const method = options.method || 'GET'
    const path = String(url)
    // Serialized on the way out, exactly as a real response body would be.
    // Returning the live object instead lets the component share a reference
    // with this stub's state, so a later push here mutates what is rendered.
    const ok = (body, status = 200) => ({
      ok: true,
      status,
      statusText: 'OK',
      json: async () => JSON.parse(JSON.stringify(body)),
    })

    if (method === 'GET' && path === '/api/cards') return ok(CARDS)

    const dataMatch = path.match(/^\/api\/data\/([^?]+)/)
    if (method === 'GET' && dataMatch) {
      const source = dataMatch[1]
      if (!(source in DATA)) {
        return {
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: async () => ({ error: `Unknown source: ${source}` }),
        }
      }
      return ok(DATA[source])
    }

    if (method === 'GET' && path.startsWith('/api/todos'))
      return ok(state.todos)

    if (method === 'POST' && path === '/api/todos') {
      const body = JSON.parse(options.body)
      const created = {
        id: state.nextTodoId++,
        card_id: body.card_id,
        text: body.text,
        done: false,
      }
      state.todos.push(created)
      return ok(created, 201)
    }

    if (method === 'PATCH' && path.startsWith('/api/todos/')) {
      const id = Number(path.split('/').pop())
      const patch = JSON.parse(options.body)
      const todo = state.todos.find((t) => t.id === id)
      Object.assign(todo, patch)
      return ok({ ...todo })
    }

    if (method === 'PUT' && path.startsWith('/api/cards/')) {
      return ok({ ...CARDS[0], ...JSON.parse(options.body) })
    }

    throw new Error(`Integration stub has no route for ${method} ${path}`)
  })

  globalThis.fetch = fetchMock
  return { fetchMock, state }
}

/** Render the app and wait for every card to finish loading. */
async function renderApp(options) {
  const harness = stubBackend(options)
  render(<App />)
  await waitFor(() => expect(screen.queryAllByRole('status')).toHaveLength(0))
  return harness
}

beforeEach(() => {
  stubBackend()
})

describe('the whole board', () => {
  it('renders every seeded card', async () => {
    await renderApp()

    for (const title of [
      'Weather',
      'Daily Quote',
      'Coming Soon',
      'Space Photo',
      'Todos',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
  })

  it('routes each card to its widget with live data', async () => {
    await renderApp()

    // Weather: fetched in Celsius, converted for display.
    expect(screen.getByText('65°')).toBeInTheDocument()
    expect(screen.getByText('Overcast')).toBeInTheDocument()
    // Quote
    expect(
      screen.getByText('Simplicity is the soul of efficiency.'),
    ).toBeInTheDocument()
    // Space
    expect(
      screen.getByRole('img', { name: 'Pillars of Creation' }),
    ).toBeInTheDocument()
    // Placeholder
    expect(screen.getByText('What should we build here?')).toBeInTheDocument()
  })

  it('asks the API for exactly the sources that need data', async () => {
    const { fetchMock } = await renderApp()

    const requested = fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter((url) => url.startsWith('/api/data/'))

    expect(requested).toEqual(
      expect.arrayContaining([
        '/api/data/weather?city=San+Francisco',
        '/api/data/quote',
        '/api/data/space',
      ]),
    )
    // todo and placeholder render without a data call.
    expect(requested).not.toContain('/api/data/todo')
    expect(requested).not.toContain('/api/data/placeholder')
  })

  it('loads the todo card through its own endpoint', async () => {
    const { fetchMock } = await renderApp({
      todos: [
        { id: 1, card_id: 5, text: 'Try checking this off', done: false },
      ],
    })

    expect(
      screen.getByRole('button', { name: 'Try checking this off' }),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/todos?card_id=5', {
      method: 'GET',
    })
  })
})

describe('interactions across the whole tree', () => {
  it('threads the lock state from the header button down to every card', async () => {
    const user = userEvent.setup()
    await renderApp()

    expect(screen.queryAllByTitle('Drag to move')).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Customize layout' }))

    expect(screen.getAllByTitle('Drag to move')).toHaveLength(CARDS.length)
    expect(
      screen.getByRole('button', { name: 'Lock layout' }),
    ).toBeInTheDocument()
  })

  it('adds a todo end to end, from keystroke to rendered row', async () => {
    const user = userEvent.setup()
    const { state } = await renderApp()

    await user.type(
      screen.getByPlaceholderText('Add a task…'),
      'Write an integration test',
    )
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(
      await screen.findByRole('button', { name: 'Write an integration test' }),
    ).toBeInTheDocument()
    expect(state.todos.map((t) => t.text)).toEqual([
      'Write an integration test',
    ])
  })

  it('toggles a todo end to end', async () => {
    const user = userEvent.setup()
    const { state } = await renderApp({
      todos: [{ id: 1, card_id: 5, text: 'A task', done: false }],
    })

    await user.click(screen.getByRole('checkbox', { name: /"A task"/ }))

    await waitFor(() => expect(state.todos[0].done).toBe(true))
    expect(screen.getByRole('checkbox', { name: /"A task"/ })).toBeChecked()
  })
})

describe('degraded backends', () => {
  it('renders fallback content without breaking the rest of the board', async () => {
    /* ADR-009: the API answers 200 with fallback data rather than erroring, so
       a dead upstream must not take the board down. */
    stubBackend()
    const healthy = globalThis.fetch
    globalThis.fetch = vi.fn(async (url, options) => {
      if (String(url).startsWith('/api/data/quote')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            text: 'The best way to predict the future is to invent it.',
            author: 'Alan Kay',
            fallback: true,
          }),
        }
      }
      return healthy(url, options)
    })

    render(<App />)
    await waitFor(() => expect(screen.queryAllByRole('status')).toHaveLength(0))

    expect(screen.getByText('(offline)')).toBeInTheDocument()
    expect(screen.getByText('65°')).toBeInTheDocument()
  })

  it('shows the dashboard error state when the card list cannot load', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({ error: 'Database is unavailable' }),
    }))

    render(<App />)

    expect(
      await screen.findByText('Unable to load dashboard'),
    ).toBeInTheDocument()
    // Surfaced from the API body rather than a hardcoded string.
    expect(screen.getByText('Database is unavailable')).toBeInTheDocument()
  })
})
