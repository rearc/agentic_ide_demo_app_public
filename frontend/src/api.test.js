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

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/**
 * Every endpoint is one call to the shared request helper: what differs is the
 * request it sends and what it resolves with, so that is what this table pins.
 */
const ENDPOINTS = [
  {
    name: 'fetchCards',
    call: () => fetchCards(),
    url: '/api/cards',
    init: { method: 'GET' },
    body: [{ id: 1, slug: 'weather' }],
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
  },
  {
    name: 'fetchCardData',
    call: () => fetchCardData('quote'),
    url: '/api/data/quote',
    init: { method: 'GET' },
    body: { text: 'A quote.', author: 'Someone' },
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
    // A 204 has no body to parse, so this one resolves with nothing.
    name: 'deleteTodo',
    call: () => deleteTodo(1),
    url: '/api/todos/1',
    init: { method: 'DELETE' },
    body: null,
    resolvesWith: undefined,
  },
]

it.each(ENDPOINTS.map((endpoint) => [endpoint.name, endpoint]))(
  '%s sends its request and resolves with the response body',
  async (_name, endpoint) => {
    const fetchMock = stubFetch(jsonResponse(endpoint.body))
    const expected =
      'resolvesWith' in endpoint ? endpoint.resolvesWith : endpoint.body

    const result = await endpoint.call()

    expect(fetchMock).toHaveBeenCalledWith(endpoint.url, endpoint.init)
    expect(result).toEqual(expected)
  },
)

describe('a failed request throws with', () => {
  /* The message falls back in three steps: the API's own `error`, then the
     caller's fallback, then the status text. One row per step, with and
     without a JSON body, so removing any step fails a row. */
  it.each([
    [
      "the API's own error message",
      {
        call: () => fetchCards(),
        response: jsonResponse(
          { error: 'Database is unavailable' },
          { status: 500 },
        ),
        message: 'Database is unavailable',
      },
    ],
    [
      "the caller's fallback when the body carries no error",
      {
        call: () => fetchCards(),
        response: jsonResponse({}, { status: 500 }),
        message: 'Failed to fetch cards',
      },
    ],
    [
      'the status text when the caller has no fallback',
      {
        call: () => fetchTodos(7),
        response: jsonResponse(
          {},
          { status: 500, statusText: 'Internal Server Error' },
        ),
        message: 'Internal Server Error',
      },
    ],
    [
      "the caller's fallback when the body is not JSON",
      {
        call: () => fetchCardData('weather'),
        response: brokenJsonResponse(),
        message: 'Failed to fetch data for weather',
      },
    ],
    [
      'the status text when the body is not JSON and there is no fallback',
      {
        call: () => fetchTodos(7),
        response: brokenJsonResponse({
          statusText: 'Bad Gateway',
          status: 502,
        }),
        message: 'Bad Gateway',
      },
    ],
  ])('%s', async (_reaching, { call, response, message }) => {
    stubFetch(response)

    await expect(call()).rejects.toThrow(message)
  })
})

describe('fetchCardData query building', () => {
  it('omits the query string for an empty config', async () => {
    const fetchMock = stubFetch(jsonResponse({}))

    await fetchCardData('quote', {})

    expect(fetchMock).toHaveBeenCalledWith('/api/data/quote', { method: 'GET' })
  })

  it('serializes config into an encoded query string', async () => {
    const fetchMock = stubFetch(jsonResponse({}))

    await fetchCardData('weather', { city: 'San Francisco' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/data/weather?city=San+Francisco',
      { method: 'GET' },
    )
  })
})
