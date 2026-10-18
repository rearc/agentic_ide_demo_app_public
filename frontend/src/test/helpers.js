import { vi } from 'vitest'

/** Build a minimal fetch Response stand-in carrying a JSON body. */
export function jsonResponse(body, { status = 200, statusText = 'OK' } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
  }
}

/** A response whose body is not valid JSON, so `.json()` rejects. */
export function brokenJsonResponse({
  status = 500,
  statusText = 'Server Error',
} = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON')
    },
  }
}

/** Point global fetch at a single response returned for every call. */
export function stubFetch(response) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  globalThis.fetch = fetchMock
  return fetchMock
}

/**
 * A card record as `GET /api/cards` returns it.
 *
 * Defaults to a placeholder card, which fetches no data, so a test only
 * stubs the data call when it overrides `source` with a card that needs one.
 */
export function cardRecord(overrides = {}) {
  return {
    id: 1,
    slug: 'placeholder',
    title: 'Coming Soon',
    description: 'Your next widget goes here',
    icon: '✨',
    source: 'placeholder',
    config: {},
    layout: { x: 0, y: 0, w: 4, h: 4 },
    position: 1,
    is_active: true,
    ...overrides,
  }
}

/** A `matchMedia` result for `query` (jsdom has no matchMedia of its own). */
export function mediaQueryList(query, matches = false) {
  return {
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }
}

/**
 * A promise whose settlement the test controls.
 *
 * Use this to observe a component mid-flight, between the moment it fires a
 * request and the moment that request settles. Assertions about optimistic
 * updates need it: once the promise resolves, the optimistic state and the
 * server-confirmed state look identical, so a test that only checks the end
 * state passes even when the optimistic update has been deleted.
 */
export function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
