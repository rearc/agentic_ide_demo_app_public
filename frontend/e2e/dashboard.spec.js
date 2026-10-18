import { expect, test } from '@playwright/test'

// The browser never reaches the real data APIs: each source is answered here,
// so the suite runs offline. Cards and todos still hit the real backend.
const DATA = {
  weather: {
    city: 'San Francisco',
    // 18.3 C is 64.94 F: shows 65° and 18°. (A flat 18 would show 64°.)
    temp: 18.3,
    description: 'partly cloudy',
    icon_emoji: '⛅',
    humidity: 60,
  },
  quote: { text: 'Mocked quote for the test.', author: 'Test Author' },
  space: {
    title: 'Mocked Nebula',
    // A 1x1 GIF, so the image needs no network either.
    url: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
    explanation: 'A mocked space photo.',
    date: '2026-01-01',
    media_type: 'image',
  },
}

async function mockDataApis(page) {
  await page.route('**/api/data/*', (route) => {
    const source = new URL(route.request().url()).pathname.split('/').pop()
    return route.fulfill({ json: DATA[source] })
  })
}

async function fetchCards(request) {
  const response = await request.get('/api/cards')
  return response.json()
}

async function deleteAllTodos(request, cardId) {
  const response = await request.get(`/api/todos?card_id=${cardId}`)
  for (const todo of await response.json()) {
    await request.delete(`/api/todos/${todo.id}`)
  }
}

let seededCards

test.beforeAll(async ({ request }) => {
  seededCards = await fetchCards(request)
})

// Specs share one database, so each one leaves it as it found it.
test.afterEach(async ({ request }) => {
  for (const card of seededCards) {
    await request.put(`/api/cards/${card.id}`, {
      data: { layout: card.layout },
    })
    if (card.source === 'todo') await deleteAllTodos(request, card.id)
  }
})

test.beforeEach(async ({ page }) => {
  await mockDataApis(page)
  await page.goto('/')
})

test('every seeded card renders its title and its mocked data', async ({
  page,
}) => {
  for (const card of seededCards) {
    await expect(page.getByRole('heading', { name: card.title })).toBeVisible()
  }

  await expect(page.getByText('partly cloudy')).toBeVisible()
  await expect(page.getByText('Mocked quote for the test.')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Mocked Nebula' })).toBeVisible()
})

test('the weather card shows Fahrenheit by default and Celsius once chosen', async ({
  page,
}) => {
  await expect(page.getByText('65°', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '°C' }).click()

  await expect(page.getByText('18°', { exact: true })).toBeVisible()
})

test('a todo added and checked off is still there, and done, after a reload', async ({
  page,
}) => {
  await page.getByPlaceholder('Add a task…').fill('Write the e2e suite')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  const checkbox = page.getByRole('checkbox', { name: /Write the e2e suite/ })
  await expect(checkbox).toHaveAttribute('aria-checked', 'false')

  await checkbox.click()
  await expect(checkbox).toHaveAttribute('aria-checked', 'true')

  await page.reload()
  await expect(
    page.getByRole('checkbox', { name: /Write the e2e suite/ }),
  ).toHaveAttribute('aria-checked', 'true')
})

test('a card dragged by its header keeps its new position after a reload', async ({
  page,
  request,
}) => {
  const before = (await fetchCards(request)).find((c) => c.slug === 'weather')
  await page.getByRole('button', { name: 'Customize layout' }).click()

  const header = page.locator('.card-drag-handle', { hasText: 'Weather' })
  const box = await header.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 500, box.y + 300, { steps: 20 })
  await page.mouse.up()

  // The dashboard saves 500 ms after the last change.
  await expect
    .poll(async () => {
      const weather = (await fetchCards(request)).find(
        (c) => c.slug === 'weather',
      )
      return weather.layout
    })
    .not.toEqual(before.layout)
  const saved = (await fetchCards(request)).find(
    (c) => c.slug === 'weather',
  ).layout

  await page.reload()
  const after = (await fetchCards(request)).find((c) => c.slug === 'weather')
  expect(after.layout).toEqual(saved)
})
