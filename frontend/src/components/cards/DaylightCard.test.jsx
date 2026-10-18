import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import DaylightCard, { daylightNow } from './DaylightCard'

// San Francisco on 18 October 2026 (UTC-7 that day): the service sends its
// times as instants, in Unix seconds, and the city's time zone by name.
const at = (localIso) => Date.parse(`${localIso}-07:00`)
const DATA = {
  city: 'San Francisco',
  timezone: 'America/Los_Angeles',
  sunrise: at('2026-10-18T07:16') / 1000,
  sunset: at('2026-10-18T18:28') / 1000,
  tomorrow_sunrise: at('2026-10-19T07:17') / 1000,
  daylight_seconds: 40320,
  change_seconds: -131,
}

/** An instant given as the city's local time that day. */
const local = at

afterEach(() => {
  vi.useRealTimers()
})

describe('daylightNow', () => {
  it('counts down to sunrise before dawn', () => {
    expect(daylightNow(DATA, local('2026-10-18T05:00'))).toEqual({
      fraction: null,
      figure: '2h 16m',
      label: 'to sunrise',
    })
  })

  it('counts the light left during the day, with how far the sun has gone', () => {
    const status = daylightNow(DATA, local('2026-10-18T14:05'))

    expect(status.figure).toBe('4h 23m')
    expect(status.label).toBe('of light left')
    expect(status.fraction).toBeCloseTo((14 * 60 + 5 - 436) / (1108 - 436), 5)
  })

  it("counts down to tomorrow's sunrise after sunset", () => {
    expect(daylightNow(DATA, local('2026-10-18T19:10')).figure).toBe('12h 07m')
  })

  it('counts down across a daylight-saving change, from instants', () => {
    // 1 November 2026: clocks go back at 2:00, so the night is an hour longer.
    const data = {
      ...DATA,
      sunset: at('2026-10-31T18:07') / 1000,
      tomorrow_sunrise: Date.parse('2026-11-01T06:28-08:00') / 1000,
    }

    expect(daylightNow(data, at('2026-10-31T20:00')).figure).toBe('11h 28m')
  })

  it.each([
    ['sets', 86_400, 'The sun does not set today'],
    ['rises', 0, 'The sun does not rise today'],
  ])('says so when the sun never %s', (_case, daylight, polar) => {
    const data = { ...DATA, daylight_seconds: daylight }

    expect(daylightNow(data, local('2026-10-18T12:00')).polar).toBe(polar)
  })

  it("says its times are stale once tomorrow's sunrise has passed", () => {
    expect(daylightNow(DATA, local('2026-10-19T08:00')).stale).toBe(true)
  })
})

describe('DaylightCard', () => {
  function renderAt(localIso, data = DATA) {
    vi.useFakeTimers()
    vi.setSystemTime(local(localIso))
    return render(<DaylightCard data={data} />)
  }

  it("shows the light left, the city's time and the day's times", () => {
    renderAt('2026-10-18T14:05')

    expect(screen.getByText('4h 23m')).toBeInTheDocument()
    expect(screen.getByText(/San Francisco · now 14:05/)).toBeInTheDocument()
    expect(screen.getByText('07:16')).toBeInTheDocument()
    expect(screen.getByText('18:28')).toBeInTheDocument()
    expect(screen.getByText('11h 12m')).toBeInTheDocument()
    expect(screen.getByText(/2m 11s shorter/)).toBeInTheDocument()
  })

  it('says when the day is as long as yesterday', () => {
    renderAt('2026-10-18T14:05', { ...DATA, change_seconds: 0 })

    expect(screen.getByText(/same as yesterday/)).toBeInTheDocument()
  })

  it('leaves out sunrise and sunset on a day without them', () => {
    renderAt('2026-10-18T14:05', { ...DATA, daylight_seconds: 0 })

    expect(screen.getByText('The sun does not rise today')).toBeInTheDocument()
    expect(screen.queryByText('Sunrise')).not.toBeInTheDocument()
  })

  it('says why it has no times when the service fell back', () => {
    renderAt('2026-10-18T14:05', {
      fallback: true,
      city: 'San Francisco',
      description: 'Daylight data unavailable',
      timezone: null,
      sunrise: null,
      sunset: null,
      tomorrow_sunrise: null,
      daylight_seconds: null,
      change_seconds: null,
    })

    expect(screen.getByText('Daylight data unavailable')).toBeInTheDocument()
  })

  it('renders nothing when it has no data', () => {
    const { container } = renderAt('2026-10-18T14:05', null)

    expect(container).toBeEmptyDOMElement()
  })
})
