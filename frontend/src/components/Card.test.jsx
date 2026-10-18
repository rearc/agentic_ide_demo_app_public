import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Card from './Card'
import { fetchCardData, fetchTodos } from '../api'
import { cardRecord, deferred } from '../test/helpers'

vi.mock('../api')

/** Most tests here need a card that fetches data; weather is that card. */
function weatherCard(overrides = {}) {
  return cardRecord({
    title: 'Weather',
    description: 'Current conditions at a glance',
    icon: 'cloud-sun',
    source: 'weather',
    ...overrides,
  })
}

const WEATHER_DATA = {
  city: 'San Francisco',
  temp: 18.3,
  description: 'Overcast',
  icon: 'cloud',
  humidity: 72,
}

// mockReset clears implementations between tests, so defaults live here.
beforeEach(() => {
  fetchCardData.mockResolvedValue(WEATHER_DATA)
  fetchTodos.mockResolvedValue([])
})

describe('chrome', () => {
  it('renders the card title, its icon, and its description on hover', async () => {
    const { container } = render(<Card card={weatherCard()} locked />)

    const heading = await screen.findByRole('heading', { name: 'Weather' })
    expect(heading).toHaveAttribute('title', 'Current conditions at a glance')
    expect(
      container.querySelector('[data-icon="cloud-sun"]'),
    ).toBeInTheDocument()
  })

  it('marks the header with the colour its registry entry names', async () => {
    const { container } = render(<Card card={weatherCard()} locked />)
    await screen.findByRole('heading', { name: 'Weather' })

    expect(container.querySelector('[data-card-tab]').style.background).toBe(
      'var(--color-card-weather)',
    )
    expect(container.querySelector('[data-icon="cloud-sun"]').style.color).toBe(
      'var(--color-card-weather)',
    )
  })

  it('gives an unregistered card no colour', async () => {
    const { container } = render(
      <Card card={cardRecord({ source: 'not-a-real-source' })} locked />,
    )
    await screen.findByText(/no component is registered/i)

    expect(container.querySelector('[data-card-tab]')).toBeNull()
  })

  it('draws no icon for a card with an empty or unknown icon name', async () => {
    const { rerender } = render(
      <Card card={cardRecord({ icon: '☀️' })} locked />,
    )
    const header = (await screen.findByRole('heading')).parentElement
    expect(header.querySelector('[data-icon]')).toBeNull()

    rerender(<Card card={cardRecord({ icon: '' })} locked />)
    expect(header.querySelector('[data-icon]')).toBeNull()
  })

  it('shows a drag affordance only when the dashboard is unlocked', async () => {
    const { rerender } = render(<Card card={weatherCard()} locked />)
    await screen.findByRole('heading', { name: 'Weather' })

    expect(screen.queryByTitle('Drag to move')).not.toBeInTheDocument()

    rerender(<Card card={weatherCard()} locked={false} />)

    expect(screen.getByTitle('Drag to move')).toBeInTheDocument()
  })
})

describe('registry dispatch (ADR-008)', () => {
  it.each([
    ['weather', WEATHER_DATA, 'Overcast'],
    ['quote', { text: 'A quote.', author: 'Someone' }, 'A quote.'],
    [
      'space',
      { title: 'Pillars of Creation', explanation: 'A nebula.' },
      'A nebula.',
    ],
    ['placeholder', null, 'What should we build here?'],
    ['todo', null, 'No tasks yet.'],
  ])('renders the %s widget for its source', async (source, data, shows) => {
    fetchCardData.mockResolvedValue(data)

    render(<Card card={cardRecord({ source })} locked />)

    expect(await screen.findByText(shows)).toBeInTheDocument()
  })

  it('names the missing source for an unregistered source', async () => {
    render(<Card card={cardRecord({ source: 'not-a-real-source' })} locked />)

    expect(
      await screen.findByText(
        /no component is registered for source .not-a-real-source./i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('What should we build here?'),
    ).not.toBeInTheDocument()
  })
})

describe('data fetching', () => {
  it('forwards the card config to the API', async () => {
    render(<Card card={weatherCard({ config: { city: 'Boston' } })} locked />)

    await waitFor(() =>
      expect(fetchCardData).toHaveBeenCalledWith('weather', { city: 'Boston' }),
    )
  })

  it('tolerates a card with no config', async () => {
    render(<Card card={weatherCard({ config: null })} locked />)

    await waitFor(() =>
      expect(fetchCardData).toHaveBeenCalledWith('weather', {}),
    )
  })

  it.each([
    ['todo', 'No tasks yet.'],
    ['placeholder', 'What should we build here?'],
    ['not-a-real-source', /no component is registered/i],
  ])('does not fetch card data for a %s card', async (source, shows) => {
    /* The backend has no data service for these, so a request would 404 and
       replace the card's content with an error. */
    render(<Card card={cardRecord({ source })} locked />)

    await screen.findByText(shows)
    expect(fetchCardData).not.toHaveBeenCalled()
  })

  it('refetches when the card config changes', async () => {
    const { rerender } = render(
      <Card card={weatherCard({ config: { city: 'Boston' } })} locked />,
    )
    await waitFor(() => expect(fetchCardData).toHaveBeenCalledTimes(1))

    rerender(<Card card={weatherCard({ config: { city: 'Denver' } })} locked />)

    await waitFor(() => expect(fetchCardData).toHaveBeenCalledTimes(2))
    expect(fetchCardData).toHaveBeenLastCalledWith('weather', {
      city: 'Denver',
    })
  })

  it('does not refetch when an unrelated prop changes', async () => {
    const { rerender } = render(<Card card={weatherCard()} locked />)
    await waitFor(() => expect(fetchCardData).toHaveBeenCalledTimes(1))

    rerender(<Card card={weatherCard()} locked={false} />)

    await waitFor(() =>
      expect(screen.getByTitle('Drag to move')).toBeInTheDocument(),
    )
    expect(fetchCardData).toHaveBeenCalledTimes(1)
  })
})

describe('status in the header', () => {
  it('marks live data with the time it arrived', async () => {
    render(<Card card={weatherCard()} locked />)

    expect(await screen.findByText('Live')).toBeInTheDocument()
    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeInTheDocument()
  })

  it('marks fallback data as a fallback, saying why on hover', async () => {
    fetchCardData.mockResolvedValue({ ...WEATHER_DATA, fallback: true })

    render(<Card card={weatherCard()} locked />)

    expect(await screen.findByText('Fallback')).toHaveAttribute(
      'title',
      'The service did not answer: showing fallback data',
    )
    expect(screen.queryByText('Live')).not.toBeInTheDocument()
  })

  it('marks a failed fetch as an error', async () => {
    fetchCardData.mockRejectedValue(new Error('upstream boom'))

    render(<Card card={weatherCard()} locked />)

    expect(await screen.findByText('Error')).toBeInTheDocument()
  })

  it('shows no status while loading, or on a card without data', async () => {
    const pending = deferred()
    fetchCardData.mockReturnValue(pending.promise)
    const { rerender } = render(<Card card={weatherCard()} locked />)

    expect(screen.queryByText('Live')).not.toBeInTheDocument()

    rerender(<Card card={cardRecord()} locked />)
    await screen.findByText('What should we build here?')
    expect(
      screen.queryByText(/^(Live|Fallback|Error)$/),
    ).not.toBeInTheDocument()
  })
})

describe('load and error states', () => {
  it('shows a loading indicator until the fetch settles', async () => {
    const pending = deferred()
    fetchCardData.mockReturnValue(pending.promise)

    render(<Card card={weatherCard()} locked />)

    expect(
      screen.getByRole('status', { name: 'Loading card data' }),
    ).toBeInTheDocument()

    pending.resolve(WEATHER_DATA)

    expect(await screen.findByText('Overcast')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows the error message inside the card when the fetch fails', async () => {
    fetchCardData.mockRejectedValue(
      new Error('Failed to fetch data for weather'),
    )

    render(<Card card={weatherCard()} locked />)

    expect(
      await screen.findByText('Failed to fetch data for weather'),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Weather' })).toBeInTheDocument()
  })

  it('clears a previous error once a refetch succeeds', async () => {
    /* Without resetting error state per fetch, a card that failed once shows
       that stale message forever, even after a later fetch succeeds. */
    fetchCardData.mockRejectedValueOnce(new Error('upstream boom'))
    const { rerender } = render(
      <Card card={weatherCard({ config: { city: 'Boston' } })} locked />,
    )
    await screen.findByText('upstream boom')

    fetchCardData.mockResolvedValueOnce(WEATHER_DATA)
    rerender(<Card card={weatherCard({ config: { city: 'Denver' } })} locked />)

    expect(await screen.findByText('Overcast')).toBeInTheDocument()
    expect(screen.queryByText('upstream boom')).not.toBeInTheDocument()
  })

  it('shows loading again while a refetch is in flight', async () => {
    const { rerender } = render(
      <Card card={weatherCard({ config: { city: 'Boston' } })} locked />,
    )
    await screen.findByText('Overcast')

    const pending = deferred()
    fetchCardData.mockReturnValue(pending.promise)
    rerender(<Card card={weatherCard({ config: { city: 'Denver' } })} locked />)

    expect(
      await screen.findByRole('status', { name: 'Loading card data' }),
    ).toBeInTheDocument()

    pending.resolve({ ...WEATHER_DATA, description: 'Clear sky' })
    expect(await screen.findByText('Clear sky')).toBeInTheDocument()
  })

  it('ignores a stale response that lands after a newer one', async () => {
    /* Rapid config changes race. Without a guard, the slower earlier request
       resolves last and overwrites the fresher data. */
    const first = deferred()
    const second = deferred()
    fetchCardData.mockReturnValueOnce(first.promise)
    fetchCardData.mockReturnValueOnce(second.promise)

    const { rerender } = render(
      <Card card={weatherCard({ config: { city: 'Boston' } })} locked />,
    )
    rerender(<Card card={weatherCard({ config: { city: 'Denver' } })} locked />)

    second.resolve({
      ...WEATHER_DATA,
      city: 'Denver',
      description: 'Clear sky',
    })
    expect(await screen.findByText('Clear sky')).toBeInTheDocument()

    // The abandoned first request now returns with older data.
    first.resolve({ ...WEATHER_DATA, city: 'Boston', description: 'Overcast' })

    await waitFor(() =>
      expect(screen.getByText('Clear sky')).toBeInTheDocument(),
    )
    expect(screen.queryByText('Overcast')).not.toBeInTheDocument()
  })
})
