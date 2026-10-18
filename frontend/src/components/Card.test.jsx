import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Card from './Card'
import { fetchCardData, fetchTodos } from '../api'
import { deferred } from '../test/helpers'

// Derived from the real module rather than listed by hand, so adding an export
// to api.js cannot silently arrive here as undefined.
vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal()
  return Object.fromEntries(Object.keys(actual).map((name) => [name, vi.fn()]))
})

function cardRecord(overrides = {}) {
  return {
    id: 1,
    slug: 'weather',
    title: 'Weather',
    description: 'Current conditions at a glance',
    icon: '☀️',
    source: 'weather',
    config: {},
    layout: {},
    position: 1,
    is_active: true,
    ...overrides,
  }
}

const WEATHER_DATA = {
  city: 'San Francisco',
  temp: 18.3,
  description: 'Overcast',
  icon_emoji: '☁️',
  humidity: 72,
}

// mockReset clears implementations between tests, so defaults live here.
beforeEach(() => {
  fetchCardData.mockResolvedValue(WEATHER_DATA)
  fetchTodos.mockResolvedValue([])
})

describe('chrome', () => {
  it('renders the card title, description and icon', async () => {
    render(<Card card={cardRecord()} locked />)

    expect(
      await screen.findByRole('heading', { name: 'Weather' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Current conditions at a glance'),
    ).toBeInTheDocument()
    expect(screen.getByText('☀️')).toBeInTheDocument()
  })

  it('shows a drag affordance only when the dashboard is unlocked', async () => {
    const { rerender } = render(<Card card={cardRecord()} locked />)
    await screen.findByRole('heading', { name: 'Weather' })

    expect(screen.queryByTitle('Drag to move')).not.toBeInTheDocument()

    rerender(<Card card={cardRecord()} locked={false} />)

    expect(screen.getByTitle('Drag to move')).toBeInTheDocument()
  })
})

describe('registry dispatch (ADR-008)', () => {
  it('renders the weather widget for a weather source', async () => {
    render(<Card card={cardRecord({ source: 'weather' })} locked />)

    expect(await screen.findByText('Overcast')).toBeInTheDocument()
    expect(screen.getByText('💧 72% humidity')).toBeInTheDocument()
  })

  it('renders the quote widget for a quote source', async () => {
    fetchCardData.mockResolvedValue({ text: 'A quote.', author: 'Someone' })

    render(<Card card={cardRecord({ source: 'quote' })} locked />)

    expect(await screen.findByText('A quote.')).toBeInTheDocument()
  })

  it('renders the space widget for a space source', async () => {
    fetchCardData.mockResolvedValue({
      title: 'Pillars of Creation',
      url: 'https://example.test/pillars.jpg',
      explanation: 'A nebula.',
      date: '2026-07-19',
      media_type: 'image',
    })

    render(<Card card={cardRecord({ source: 'space' })} locked />)

    expect(await screen.findByText('Pillars of Creation')).toBeInTheDocument()
  })

  it('renders the placeholder widget for a placeholder source', async () => {
    render(<Card card={cardRecord({ source: 'placeholder' })} locked />)

    expect(
      await screen.findByText('What should we build here?'),
    ).toBeInTheDocument()
  })

  it('renders the todo widget for a todo source', async () => {
    render(<Card card={cardRecord({ source: 'todo' })} locked />)

    expect(
      await screen.findByPlaceholderText('Add a task…'),
    ).toBeInTheDocument()
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

  it('does not fetch data for an unregistered source', async () => {
    render(<Card card={cardRecord({ source: 'not-a-real-source' })} locked />)

    await screen.findByText(/no component is registered/i)
    expect(fetchCardData).not.toHaveBeenCalled()
  })
})

describe('data fetching', () => {
  it('fetches data for a source that needs it', async () => {
    render(<Card card={cardRecord({ source: 'weather' })} locked />)

    await waitFor(() =>
      expect(fetchCardData).toHaveBeenCalledWith('weather', {}),
    )
  })

  it('forwards the card config to the API', async () => {
    render(<Card card={cardRecord({ config: { city: 'Boston' } })} locked />)

    await waitFor(() =>
      expect(fetchCardData).toHaveBeenCalledWith('weather', { city: 'Boston' }),
    )
  })

  it('tolerates a card with no config', async () => {
    render(<Card card={cardRecord({ config: null })} locked />)

    await waitFor(() =>
      expect(fetchCardData).toHaveBeenCalledWith('weather', {}),
    )
  })

  it('does not fetch for sources that manage their own data', async () => {
    render(<Card card={cardRecord({ source: 'todo' })} locked />)

    await screen.findByPlaceholderText('Add a task…')
    expect(fetchCardData).not.toHaveBeenCalled()
  })

  it('refetches when the card config changes', async () => {
    const { rerender } = render(
      <Card card={cardRecord({ config: { city: 'Boston' } })} locked />,
    )
    await waitFor(() => expect(fetchCardData).toHaveBeenCalledTimes(1))

    rerender(<Card card={cardRecord({ config: { city: 'Denver' } })} locked />)

    await waitFor(() => expect(fetchCardData).toHaveBeenCalledTimes(2))
    expect(fetchCardData).toHaveBeenLastCalledWith('weather', {
      city: 'Denver',
    })
  })

  it('does not refetch when an unrelated prop changes', async () => {
    const { rerender } = render(<Card card={cardRecord()} locked />)
    await waitFor(() => expect(fetchCardData).toHaveBeenCalledTimes(1))

    rerender(<Card card={cardRecord()} locked={false} />)

    await waitFor(() =>
      expect(screen.getByTitle('Drag to move')).toBeInTheDocument(),
    )
    expect(fetchCardData).toHaveBeenCalledTimes(1)
  })
})

describe('load and error states', () => {
  it('shows a loading indicator until the fetch settles', async () => {
    const pending = deferred()
    fetchCardData.mockReturnValue(pending.promise)

    render(<Card card={cardRecord()} locked />)

    expect(
      screen.getByRole('status', { name: 'Loading card data' }),
    ).toBeInTheDocument()

    pending.resolve(WEATHER_DATA)

    expect(await screen.findByText('Overcast')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows the error message when the fetch fails', async () => {
    fetchCardData.mockRejectedValue(
      new Error('Failed to fetch data for weather'),
    )

    render(<Card card={cardRecord()} locked />)

    expect(
      await screen.findByText('Failed to fetch data for weather'),
    ).toBeInTheDocument()
  })

  it('keeps the card chrome visible when the fetch fails', async () => {
    fetchCardData.mockRejectedValue(new Error('boom'))

    render(<Card card={cardRecord()} locked />)

    await screen.findByText('boom')
    expect(screen.getByRole('heading', { name: 'Weather' })).toBeInTheDocument()
  })

  it('clears a previous error once a refetch succeeds', async () => {
    /* Without resetting error state per fetch, a card that failed once shows
       that stale message forever, even after a later fetch succeeds. */
    fetchCardData.mockRejectedValueOnce(new Error('upstream boom'))
    const { rerender } = render(
      <Card card={cardRecord({ config: { city: 'Boston' } })} locked />,
    )
    await screen.findByText('upstream boom')

    fetchCardData.mockResolvedValueOnce(WEATHER_DATA)
    rerender(<Card card={cardRecord({ config: { city: 'Denver' } })} locked />)

    expect(await screen.findByText('Overcast')).toBeInTheDocument()
    expect(screen.queryByText('upstream boom')).not.toBeInTheDocument()
  })

  it('shows loading again while a refetch is in flight', async () => {
    const { rerender } = render(
      <Card card={cardRecord({ config: { city: 'Boston' } })} locked />,
    )
    await screen.findByText('Overcast')

    const pending = deferred()
    fetchCardData.mockReturnValue(pending.promise)
    rerender(<Card card={cardRecord({ config: { city: 'Denver' } })} locked />)

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
      <Card card={cardRecord({ config: { city: 'Boston' } })} locked />,
    )
    rerender(<Card card={cardRecord({ config: { city: 'Denver' } })} locked />)

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
