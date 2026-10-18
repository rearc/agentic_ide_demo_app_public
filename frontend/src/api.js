const API_BASE = '/api'

/**
 * The API's own `{"error": "..."}` message when it sent one.
 *
 * Falls back to `fallback`, then to the status text. Without this, a caller
 * throws a fixed string and the specific reason the server gave is discarded
 * before anyone can show it.
 */
async function readErrorMessage(res, fallback) {
  try {
    const body = await res.json()
    return body.error || fallback || res.statusText
  } catch {
    return fallback || res.statusText
  }
}

/**
 * Fetch `url` and return the response, throwing on a non-2xx status.
 *
 * The thrown message is the server's `error` text, else `fallback`, else the
 * status text. `body`, when given, is sent as JSON.
 */
async function request(url, { method = 'GET', body, fallback } = {}) {
  const options = { method }
  if (body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' }
    options.body = JSON.stringify(body)
  }
  const res = await fetch(url, options)
  if (!res.ok) throw new Error(await readErrorMessage(res, fallback))
  return res
}

export async function fetchCards() {
  const res = await request(`${API_BASE}/cards`, {
    fallback: 'Failed to fetch cards',
  })
  return res.json()
}

export async function updateCard(id, fields) {
  const res = await request(`${API_BASE}/cards/${id}`, {
    method: 'PUT',
    body: fields,
    fallback: 'Failed to update card',
  })
  return res.json()
}

export async function fetchCardData(source, config = {}) {
  const params = new URLSearchParams(config)
  const query = params.toString()
  const url = `${API_BASE}/data/${source}${query ? `?${query}` : ''}`
  const res = await request(url, {
    fallback: `Failed to fetch data for ${source}`,
  })
  return res.json()
}

export async function fetchTodos(cardId) {
  const res = await request(`${API_BASE}/todos?card_id=${cardId}`)
  return res.json()
}

export async function createTodo(cardId, text) {
  const res = await request(`${API_BASE}/todos`, {
    method: 'POST',
    body: { card_id: cardId, text },
  })
  return res.json()
}

export async function updateTodo(todoId, fields) {
  const res = await request(`${API_BASE}/todos/${todoId}`, {
    method: 'PATCH',
    body: fields,
  })
  return res.json()
}

export async function deleteTodo(todoId) {
  await request(`${API_BASE}/todos/${todoId}`, { method: 'DELETE' })
}
