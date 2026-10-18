import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { twoline2satrec } from 'satellite.js'

import IssCard from './IssCard'
import IssGlobe, { clampTilt, issPosition, orbitPath } from './IssGlobe'

// The station's orbit data from CelesTrak, 18 October 2026 (the backend's
// stored copy), and a moment two hours later.
const DATA = {
  name: 'ISS (ZARYA)',
  line1:
    '1 25544U 98067A   26291.46721113  .00007452  00000+0  14361-3 0  9990',
  line2:
    '2 25544  51.6327  50.0298 0006783 279.2532  80.7689 15.48923373590865',
  epoch: '2026-10-18T11:12:47Z',
  source: 'celestrak',
}
const NOW = new Date('2026-10-18T13:00:00Z')
const SATREC = twoline2satrec(DATA.line1, DATA.line2)

describe('the orbit maths', () => {
  it('puts the station on its orbit: latitude, height and speed', () => {
    const place = issPosition(SATREC, NOW)

    // Geodetic latitude runs a little past the 51.64° inclination.
    expect(Math.abs(place.lat)).toBeLessThanOrEqual(52)
    expect(place.lon).toBeGreaterThanOrEqual(-180)
    expect(place.lon).toBeLessThanOrEqual(180)
    expect(place.altitude).toBeGreaterThan(370)
    expect(place.altitude).toBeLessThan(460)
    expect(place.speed).toBeGreaterThan(27_000)
    expect(place.speed).toBeLessThan(28_500)
  })

  it('draws the orbit a minute at a time, 46 minutes either side', () => {
    expect(orbitPath(SATREC, NOW).coordinates).toHaveLength(93)
  })

  it('limits the tilt to 70 degrees either way', () => {
    expect(clampTilt(85)).toBe(70)
    expect(clampTilt(-85)).toBe(-70)
    expect(clampTilt(12)).toBe(12)
  })
})

describe('IssGlobe', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function globe() {
    return screen.getByRole('img', { name: /^ISS over/ })
  }

  /** The land's outline: it changes whenever the globe turns. */
  function landPath() {
    return globe().querySelectorAll('path')[2].getAttribute('d')
  }

  it('says where the station is, and draws globe, land, orbit and station', () => {
    render(<IssGlobe data={DATA} />)

    expect(globe()).toHaveAccessibleName(/ISS over .*km up/)
    const drawn = [...globe().querySelectorAll('path')].filter((p) =>
      p.getAttribute('d'),
    )
    expect(drawn).toHaveLength(6)
    expect(screen.getByText(/km\/h/)).toBeInTheDocument()
  })

  it('turns when dragged', () => {
    render(<IssGlobe data={DATA} />)
    const before = landPath()

    fireEvent.pointerDown(globe(), { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(globe(), { clientX: 160, clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(globe(), { pointerId: 1 })

    expect(landPath()).not.toBe(before)
  })

  it('turns with the arrow keys and marks them handled, so the page does not', () => {
    render(<IssGlobe data={DATA} />)
    const before = landPath()

    const notHandled = fireEvent.keyDown(globe(), { key: 'ArrowLeft' })

    expect(notHandled).toBe(false)
    expect(landPath()).not.toBe(before)
  })

  it('turns the same way with ArrowRight as with a drag to the right', () => {
    render(<IssGlobe data={DATA} />)
    fireEvent.pointerDown(globe(), { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(globe(), { clientX: 125, clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(globe(), { pointerId: 1 })
    const dragged = landPath()
    // Back to the start, then the key: 25 px of drag is the key's 10 degrees.
    fireEvent.pointerDown(globe(), { clientX: 125, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(globe(), { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerUp(globe(), { pointerId: 1 })

    fireEvent.keyDown(globe(), { key: 'ArrowRight' })

    expect(landPath()).toBe(dragged)
  })

  it('stops tilting at the limit, so the way back starts at once', () => {
    render(<IssGlobe data={DATA} />)
    for (let i = 0; i < 20; i++) fireEvent.keyDown(globe(), { key: 'ArrowUp' })
    const atLimit = landPath()

    fireEvent.keyDown(globe(), { key: 'ArrowDown' })

    expect(landPath()).not.toBe(atLimit)
  })

  it('says the position is approximate when it fell back to old orbit data', () => {
    render(<IssGlobe data={{ ...DATA, fallback: true, source: 'stored' }} />)

    expect(
      screen.getByText(/Approximate: orbit data from Oct 18/),
    ).toBeInTheDocument()
  })
})

describe('IssCard', () => {
  it('loads the globe when it is shown', async () => {
    render(<IssCard data={DATA} />)

    expect(
      await screen.findByRole('img', { name: /^ISS over/ }),
    ).toBeInTheDocument()
  })

  it('renders nothing when it has no data', () => {
    const { container } = render(<IssCard data={null} />)

    expect(container).toBeEmptyDOMElement()
  })
})
