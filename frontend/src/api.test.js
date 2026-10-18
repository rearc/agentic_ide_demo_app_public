import { describe, expect, it } from 'vitest'

import {
  createTodo,
  deleteTodo,
  fetchCardData,
  fetchCards,
  fetchTodos,
  updateCard,
  updateTodo,
} from './api'
import { brokenJsonResponse, jsonResponse, stubFetch } from './test/helpers'

/**
 * api.js is seven variations on one shape: build a URL, send it, throw on a
 * bad status, return the parsed body. Testing each variation longhand produced
 * seven near-identical blocks, so the shared behavior is table-driven here and
 * only the parts that genuinely differ get their own tests below.
 */

const JSON_HEADERS = { 'Content-Type': 'application/json' }

const ENDPOINTS = [
  {
    name: 'fetchCards',
    call: () => fetchCards(),
    url: '/api/cards',
    init: { method: 'GET' },
    body: [{ id: 1, slug: 'weather' }],
    ownMessage: 'Failed to fetch cards',
  },
  {
    name: 'updateCard',
    call: () => updateCard(1, { title: 'Renamed' }),
    url: '/api/cards/1',
    init: {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify({ title: 'Renamed' }),
    },
    body: { id: 1, title: 'Renamed' },
    ownMessage: 'Failed to update card',
  },
  {
    name: 'fetchCardData',
    call: () => fetchCardData('quote'),
    url: '/api/data/quote',
    init: { method: 'GET' },
    body: { text: 'A quote.', author: 'Someone' },
    ownMessage: 'Failed to fetch data for quote',
  },
  {
    name: 'fetchTodos',
    call: () => fetchTodos(7),
    url: '/api/todos?card_id=7',
    init: { method: 'GET' },
    body: [{ id: 1, text: 'A task' }],
  },
  {
    name: 'createTodo',
    call: () => createTodo(7, 'Write tests'),
    url: '/api/todos',
    init: {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ card_id: 7, text: 'Write tests' }),
    },
    body: { id: 1, text: 'Write tests', done: false },
  },
  {
    name: 'updateTodo',
    call: () => updateTodo(1, { done: true }),
    url: '/api/todos/1',
    init: {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ done: true }),
    },
    body: { id: 1, done: true },
  },
  {
    name: 'deleteTodo',
    call: () => deleteTodo(1),
    url: '/api/todos/1',
    init: { method: 'DELETE' },
    body: null,
  },
]

describe.each(ENDPOINTS)('$name', ({ call, url, init, body, ownMessage }) => {
  it('sends the expected request', async () => {
    const fetchMock = stubFetch(jsonResponse(body))

    await call()

    expect(fetchMock).toHaveBeenCalledWith(url, init)
  })

  it('surfaces the error message the API supplied', async () => {
    stubFetch(
      jsonResponse({ error: 'Something specific went wrong' }, { status: 500 }),
    )

    await expect(call()).rejects.toThrow('Something specific went wrong')
  })

  it('falls back to its own message when the body carries no error', async () => {
    stubFetch(
      jsonResponse({}, { status: 500, statusText: 'Internal Server Error' }),
    )

    await expect(call()).rejects.toThrow(ownMessage ?? 'Internal Server Error')
  })

  it('falls back again when the error body is not JSON', async () => {
    stubFetch(brokenJsonResponse({ status: 500, statusText: 'Server Error' }))

    await expect(call()).rejects.toThrow(ownMessage ?? 'Server Error')
  })
})

describe('returned values', () => {
  it.each(ENDPOINTS.filter((endpoint) => endpoint.body !== null))(
    '$name resolves with the parsed body',
    async ({ call, body }) => {
      stubFetch(jsonResponse(body))

      await expect(call()).resolves.toEqual(body)
    },
  )

  it('deleteTodo resolves with nothing', async () => {
    stubFetch(jsonResponse(null, { status: 204 }))

    await expect(deleteTodo(1)).resolves.toBeUndefined()
  })
})

describe('fetchCardData query building', () => {
  it('omits the query string when there is no config', async () => {
    const fetchMock = stubFetch(jsonResponse({}))

    await fetchCardData('quote')

    expect(fetchMock).toHaveBeenCalledWith('/api/data/quote', { method: 'GET' })
  })

  it('omits the query string for an empty config', async () => {
    const fetchMock = stubFetch(jsonResponse({}))

    await fetchCardData('quote', {})

    expect(fetchMock).toHaveBeenCalledWith('/api/data/quote', { method: 'GET' })
  })

  it('serializes config into the query string', async () => {
    const fetchMock = stubFetch(jsonResponse({}))

    await fetchCardData('weather', { city: 'Boston' })

    expect(fetchMock).toHaveBeenCalledWith('/api/data/weather?city=Boston', {
      method: 'GET',
    })
  })

  it('url-encodes config values', async () => {
    const fetchMock = stubFetch(jsonResponse({}))

    await fetchCardData('weather', { city: 'San Francisco' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/data/weather?city=San+Francisco',
      { method: 'GET' },
    )
  })
})
