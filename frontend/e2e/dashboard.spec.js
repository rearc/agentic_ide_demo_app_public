import { expect, test } from '@playwright/test'

// The browser never reaches the real data APIs: each source is answered here,
// so the suite runs offline. Cards and todos still hit the real backend.
const DATA = {
  weather: {
    city: 'San Francisco',
    // 18.3 C is 64.94 F: shows 65° and 18°. (A flat 18 would show 64°.)
    temp: 18.3,
    description: 'partly cloudy',
    icon: 'cloud-sun',
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

async function fetchProfiles(request) {
  const response = await request.get('/api/profiles')
  return response.json()
}

/** The seeded "Default" profile's entry for the card with `slug`. */
async function defaultEntry(request, slug) {
  const card = seededCards.find((c) => c.slug === slug)
  const [profile] = await fetchProfiles(request)
  return profile.board[card.id]
}

async function deleteAllTodos(request, cardId) {
  const response = await request.get(`/api/todos?card_id=${cardId}`)
  for (const todo of await response.json()) {
    await request.delete(`/api/todos/${todo.id}`)
  }
}

let seededCards
let seededDefault

test.beforeAll(async ({ request }) => {
  seededCards = await fetchCards(request)
  ;[seededDefault] = await fetchProfiles(request)
})

// Specs share one database, so each one leaves it as it found it: the seeded
// "Default" board, no other profile, no todos.
test.afterEach(async ({ request }) => {
  for (const profile of await fetchProfiles(request)) {
    if (profile.id !== seededDefault.id) {
      await request.delete(`/api/profiles/${profile.id}`)
    }
  }
  await request.patch(`/api/profiles/${seededDefault.id}`, {
    data: { board: seededDefault.board },
  })
  for (const card of seededCards) {
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
  const before = await defaultEntry(request, 'weather')
  await page.getByRole('button', { name: 'Customize layout' }).click()

  const header = page.locator('.card-drag-handle', { hasText: 'Weather' })
  const box = await header.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 500, box.y + 300, { steps: 20 })
  await page.mouse.up()

  // Saved when the drag ends; the request is still in flight here.
  await expect.poll(() => defaultEntry(request, 'weather')).not.toEqual(before)
  const saved = await defaultEntry(request, 'weather')

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Weather' })).toBeVisible()
  expect(await defaultEntry(request, 'weather')).toEqual(saved)
})

test('a removed card stays off the board, and comes back from the library', async ({
  page,
  request,
}) => {
  const weather = page.getByRole('heading', { name: 'Weather' })
  await page.getByRole('button', { name: 'Customize layout' }).click()
  await page.getByRole('button', { name: 'Remove "Weather"' }).click()
  await expect(weather).toHaveCount(0)
  await expect
    .poll(async () => (await defaultEntry(request, 'weather')).hidden)
    .toBe(true)

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Daily Quote' })).toBeVisible()
  await expect(weather).toHaveCount(0)

  await page.getByRole('button', { name: 'Library' }).click()
  await page.getByRole('button', { name: 'Add "Weather"' }).click()
  await expect(weather).toBeVisible()
  await expect
    .poll(async () => (await defaultEntry(request, 'weather')).hidden)
    .toBe(false)

  await page.reload()
  await expect(weather).toBeVisible()
})

test('a card dragged from the library lands where it is dropped', async ({
  page,
  request,
}) => {
  const placeholder = page.getByRole('heading', { name: 'Coming Soon' })
  await page.getByRole('button', { name: 'Customize layout' }).click()
  await page.getByRole('button', { name: 'Remove "Coming Soon"' }).click()
  await expect(placeholder).toHaveCount(0)

  await page.getByRole('button', { name: 'Library' }).click()
  const tile = page
    .getByRole('region', { name: 'Card library' })
    .getByRole('listitem')
    .filter({ hasText: 'Coming Soon' })
  await tile.dragTo(page.locator('.react-grid-layout'), {
    targetPosition: { x: 40, y: 40 },
  })

  await expect(placeholder).toBeVisible()
  // Dropped on the top-left corner, it takes that spot, and the card that was
  // there (Weather, 4 rows tall) moves down below it.
  const place = async (slug) => {
    const { x, y, hidden } = await defaultEntry(request, slug)
    return { x, y, hidden }
  }
  await expect
    .poll(async () => [await place('placeholder'), await place('weather')])
    .toEqual([
      { x: 0, y: 0, hidden: false },
      { x: 0, y: 4, hidden: false },
    ])
})

test('a profile saved from the board keeps its own cards', async ({ page }) => {
  const quote = page.getByRole('heading', { name: 'Daily Quote' })
  const menu = (name) =>
    page.getByRole('button', { name: `Control Center, profile ${name}` })
  const pick = (name) =>
    page
      .getByRole('region', { name: 'Profiles' })
      .getByRole('button', { name, exact: true })

  await menu('Default').click()
  await page.getByRole('button', { name: 'Save as new profile' }).click()
  await page.getByRole('textbox', { name: 'New profile name' }).fill('Focus')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(menu('Focus')).toBeVisible()

  await page.getByRole('button', { name: 'Customize layout' }).click()
  await page.getByRole('button', { name: 'Remove "Daily Quote"' }).click()
  await expect(quote).toHaveCount(0)

  await menu('Focus').click()
  await pick('Default').click()
  await expect(quote).toBeVisible()

  // The shown profile is remembered across a reload.
  await menu('Default').click()
  await pick('Focus').click()
  await page.reload()
  await expect(menu('Focus')).toBeVisible()
  await expect(quote).toHaveCount(0)
})

for (const width of [1280, 760, 390]) {
  test(`the board fits a ${width} px window without scrolling sideways`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.reload()
    for (const card of seededCards) {
      await expect(
        page.getByRole('heading', { name: card.title }),
      ).toBeVisible()
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
}
