import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import MoonCard, {
  litFraction,
  moonAge,
  nextFullMoon,
  phaseName,
} from './MoonCard'

// Published phases of January 2024 (UTC), to check the maths against. The
// card uses the mean lunar month, so it may be off by up to about a day.
const NEW_MOON = new Date('2024-01-11T11:57:00Z')
const FIRST_QUARTER = new Date('2024-01-18T03:52:00Z')
const FULL_MOON = new Date('2024-01-25T17:54:00Z')
const DAY = 86_400_000

afterEach(() => {
  vi.useRealTimers()
})

describe('the maths', () => {
  it.each([
    ['new moon', NEW_MOON, 'New moon', 0, 0.03],
    ['first quarter', FIRST_QUARTER, 'First quarter', 0.4, 0.6],
    ['full moon', FULL_MOON, 'Full moon', 0.97, 1],
  ])('finds the %s within a day', (_case, date, name, minLit, maxLit) => {
    const age = moonAge(date)

    expect(phaseName(age)).toBe(name)
    expect(litFraction(age)).toBeGreaterThanOrEqual(minLit)
    expect(litFraction(age)).toBeLessThanOrEqual(maxLit)
  })

  it('calls the moon between quarter and full by the phase between them', () => {
    // 1 February 2024: 60% lit and waning, three days from last quarter.
    expect(phaseName(moonAge(new Date('2024-02-01T12:00:00Z')))).toBe(
      'Waning gibbous',
    )
  })

  it('finds the next full moon within a day of the published one', () => {
    const found = nextFullMoon(FIRST_QUARTER)

    expect(Math.abs(found - FULL_MOON)).toBeLessThan(DAY)
  })

  it('still counts a full moon earlier the same night as the next one', () => {
    const later = new Date(FULL_MOON.getTime() + 6 * 3_600_000)

    expect(Math.abs(nextFullMoon(later) - FULL_MOON)).toBeLessThan(DAY)
  })
})

describe('MoonCard', () => {
  function renderOn(date) {
    vi.useFakeTimers()
    vi.setSystemTime(date)
    const onNote = vi.fn()
    render(<MoonCard onNote={onNote} />)
    return onNote
  }

  it('shows the phase, and how much is lit in the header note', () => {
    const onNote = renderOn(FIRST_QUARTER)

    expect(screen.getByText('First quarter')).toBeInTheDocument()
    expect(onNote).toHaveBeenLastCalledWith(expect.stringMatching(/^\d+% lit$/))
  })

  it('shows the next two weeks from today, marking the full moon among them', () => {
    renderOn(FIRST_QUARTER)

    const days = within(
      screen.getByRole('list', { name: 'The next two weeks' }),
    ).getAllByRole('listitem')
    expect(days).toHaveLength(14)
    expect(days[0]).toHaveAttribute('aria-current', 'date')
    // Which local day the full moon falls on depends on the time zone, so
    // the expected day comes from the same function.
    const fullDay = nextFullMoon(FIRST_QUARTER).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    })
    const marked = days.filter((day) => day.dataset.full)
    expect(marked).toHaveLength(1)
    expect(marked[0]).toHaveAccessibleName(`${fullDay}, full moon`)
  })

  it('says when the full moon is tonight', () => {
    // A minute before the full moon, so it is the same local day in any
    // time zone.
    renderOn(new Date(nextFullMoon(FIRST_QUARTER).getTime() - 60_000))

    expect(screen.getByText(/full moon tonight/)).toBeInTheDocument()
  })
})
