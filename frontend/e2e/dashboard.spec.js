import { expect, test } from '@playwright/test'

const NOW_SECONDS = Math.floor(Date.now() / 1000)

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
  // Times around now, so the card shows a day in progress (its live state),
  // not "yesterday's times": sunrise two hours ago, sunset in three.
  daylight: {
    city: 'San Francisco',
    timezone: 'America/Los_Angeles',
    sunrise: NOW_SECONDS - 2 * 3600,
    sunset: NOW_SECONDS + 3 * 3600,
    tomorrow_sunrise: NOW_SECONDS + 21 * 3600,
    daylight_seconds: 5 * 3600,
    change_seconds: 25,
  },
  iss: {
    name: 'ISS (ZARYA)',
    line1:
      '1 25544U 98067A   26291.46721113  .00007452  00000+0  14361-3 0  9990',
    line2:
      '2 25544  51.6327  50.0298 0006783 279.2532  80.7689 15.48923373590865',
    epoch: '2026-10-18T11:12:47Z',
    source: 'celestrak',
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

// Taller than the default 720 px: with the library open the sticky header is
// over 200 px, and the drag tests need their drop points clear of it without
// scrolling the page.
test.use({ viewport: { width: 1280, height: 1000 } })

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
  await expect(page.getByText('of light left')).toBeVisible()
  await expect(page.getByRole('img', { name: /^ISS over/ })).toBeVisible()
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
  await page.getByRole('button', { name: 'Edit board' }).click()

  const header = page.locator('.card-drag-handle', { hasText: 'Weather' })
  // hover() waits until the header stops moving: the library is still
  // unfolding above the board and pushing it down.
  await header.hover()
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
  await page.getByRole('button', { name: 'Edit board' }).click()
  await page
    .getByRole('button', { name: 'Remove "Weather"', exact: true })
    .click()
  await expect(weather).toHaveCount(0)
  await expect
    .poll(async () => (await defaultEntry(request, 'weather')).hidden)
    .toBe(true)

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Daily Quote' })).toBeVisible()
  await expect(weather).toHaveCount(0)

  await page.getByRole('button', { name: 'Edit board' }).click()
  await page.getByRole('button', { name: 'Add "Weather"' }).click()
  await expect(weather).toBeVisible()
  await expect
    .poll(async () => (await defaultEntry(request, 'weather')).hidden)
    .toBe(false)

  await page.reload()
  await expect(weather).toBeVisible()

  // The library's tile takes it off the board again.
  await page.getByRole('button', { name: 'Edit board' }).click()
  await page
    .getByRole('button', { name: 'Remove "Weather" from the board' })
    .click()
  await expect(weather).toHaveCount(0)
  await expect
    .poll(async () => (await defaultEntry(request, 'weather')).hidden)
    .toBe(true)
})

test('a card dragged from the library lands where it is dropped', async ({
  page,
  request,
}) => {
  const placeholder = page.getByRole('heading', { name: 'Coming Soon' })
  await page.getByRole('button', { name: 'Edit board' }).click()
  await page
    .getByRole('button', { name: 'Remove "Coming Soon"', exact: true })
    .click()
  await expect(placeholder).toHaveCount(0)

  const tile = page
    .getByRole('region', { name: 'Card library' })
    .getByRole('listitem')
    .filter({ hasText: 'Coming Soon' })
  // Dragged by hand, not with dragTo: dragTo scrolls the whole grid into
  // view first, and on a board taller than the window that puts the drop
  // point under the sticky header.
  const from = await tile.boundingBox()
  const grid = await page.locator('.react-grid-layout').boundingBox()
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(grid.x + 40, grid.y + 40, { steps: 10 })
  await page.mouse.up()

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

test('with the library folded away, the board sits where it does when viewed', async ({
  page,
}) => {
  const grid = page.locator('.react-grid-layout')
  const top = async () => (await grid.boundingBox()).y
  await expect(page.getByRole('heading', { name: 'Weather' })).toBeVisible()
  const viewed = await top()

  await page.getByRole('button', { name: 'Edit board' }).click()
  await expect.poll(top).toBeGreaterThan(viewed)

  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await expect.poll(top).toBe(viewed)
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

  await page.getByRole('button', { name: 'Edit board' }).click()
  await page
    .getByRole('button', { name: 'Remove "Daily Quote"', exact: true })
    .click()
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

  // The arrows turn through the profiles, wrapping past the last.
  await page.getByRole('button', { name: 'Next profile' }).click()
  await expect(menu('Default')).toBeVisible()
  await expect(quote).toBeVisible()
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

    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
    expect(await overflow()).toBeLessThanOrEqual(0)

    // The header gains controls while editing; it must still fit.
    await page.getByRole('button', { name: 'Edit board' }).click()
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible()
    expect(await overflow()).toBeLessThanOrEqual(0)
  })
}
