import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import WeatherCard from './WeatherCard'

const WEATHER = {
  city: 'San Francisco',
  temp: 18.3,
  description: 'Overcast',
  icon_emoji: '☁️',
  humidity: 72,
}

describe('WeatherCard', () => {
  it('defaults to Fahrenheit', () => {
    render(<WeatherCard data={WEATHER} />)

    expect(screen.getByText('65°')).toBeInTheDocument()
  })

  it('converts to Celsius when the unit is toggled', async () => {
    const user = userEvent.setup()
    render(<WeatherCard data={WEATHER} />)

    await user.click(screen.getByRole('button', { name: '°C' }))

    expect(screen.getByText('18°')).toBeInTheDocument()
  })

  it('converts back to Fahrenheit', async () => {
    const user = userEvent.setup()
    render(<WeatherCard data={WEATHER} />)

    await user.click(screen.getByRole('button', { name: '°C' }))
    await user.click(screen.getByRole('button', { name: '°F' }))

    expect(screen.getByText('65°')).toBeInTheDocument()
  })

  it('rounds the temperature to a whole number', () => {
    render(<WeatherCard data={{ ...WEATHER, temp: 0.4 }} />)

    expect(screen.getByText('33°')).toBeInTheDocument()
  })

  it('renders nothing when it has no data', () => {
    const { container } = render(<WeatherCard data={null} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders the conditions, city and icon', () => {
    render(<WeatherCard data={WEATHER} />)

    expect(screen.getByText('Overcast')).toBeInTheDocument()
    expect(screen.getByText('San Francisco')).toBeInTheDocument()
    expect(screen.getByText('☁️')).toBeInTheDocument()
  })

  it('omits humidity when the API did not supply it', () => {
    render(<WeatherCard data={{ ...WEATHER, humidity: null }} />)

    expect(screen.queryByText(/humidity/)).not.toBeInTheDocument()
  })

  it('renders zero humidity rather than treating it as absent', () => {
    render(<WeatherCard data={{ ...WEATHER, humidity: 0 }} />)

    expect(screen.getByText('💧 0% humidity')).toBeInTheDocument()
  })

  describe('fallback state (ADR-009)', () => {
    const FALLBACK = {
      fallback: true,
      city: 'San Francisco',
      temp: '--',
      description: 'Weather data unavailable',
      icon_emoji: '❓',
      humidity: null,
    }

    it('shows the fallback message without a temperature or unit toggle', () => {
      render(<WeatherCard data={FALLBACK} />)

      expect(screen.getByText('Weather data unavailable')).toBeInTheDocument()
      expect(screen.queryByText(/°$/)).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: '°C' }),
      ).not.toBeInTheDocument()
    })
  })
})
