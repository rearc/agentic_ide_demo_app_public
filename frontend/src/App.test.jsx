import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'

// Dashboard has its own tests; stubbing it keeps this file about App's own job:
// the clock, and the lock toggle it owns.
const dashboardRender = vi.fn()
vi.mock('./components/Dashboard', () => ({
  default: ({ locked }) => {
    dashboardRender()
    return <div data-testid="dashboard" data-locked={String(locked)} />
  },
}))

function dashboardLocked() {
  return screen.getByTestId('dashboard').dataset.locked
}

describe('lock toggle', () => {
  it('starts locked', () => {
    render(<App />)

    expect(dashboardLocked()).toBe('true')
    expect(
      screen.getByRole('button', { name: 'Customize layout' }),
    ).toBeInTheDocument()
  })

  it('unlocks the dashboard when clicked', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Customize layout' }))

    expect(dashboardLocked()).toBe('false')
    expect(
      screen.getByRole('button', { name: 'Lock layout' }),
    ).toBeInTheDocument()
  })

  it('locks it again on a second click', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Customize layout' }))
    await user.click(screen.getByRole('button', { name: 'Lock layout' }))

    expect(dashboardLocked()).toBe('true')
  })

  it('shows the drag hint only while unlocked', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(
      screen.queryByText(/changes save automatically/),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Customize layout' }))

    expect(screen.getByText(/changes save automatically/)).toBeInTheDocument()
  })
})

describe('clock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-19T14:30:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the current time and date', () => {
    /* Asserted locale-independently (TEST-3): the component formats with the
       runtime's default locale, so matching "July 19" would fail on a machine
       set to de-DE, where the same instant renders "19. Juli". The digits are
       the same in every locale. */
    render(<App />)

    expect(screen.getByText(/\b\d{1,2}:\d{2}\b/)).toBeInTheDocument()
    expect(screen.getByText(/\b19\b/)).toBeInTheDocument()
  })

  it('shows the next minute within a second of it starting', () => {
    /* Starting one second before the minute turns: an interval any slower
       than a second would leave the old minute on screen. */
    vi.setSystemTime(new Date('2026-07-19T14:30:59'))
    render(<App />)
    const before = screen.getByText(/\d{1,2}:\d{2}/).textContent

    act(() => {
      vi.advanceTimersByTime(1_000)
    })

    expect(screen.getByText(/\d{1,2}:\d{2}/).textContent).not.toBe(before)
  })

  it('does not re-render the dashboard on a tick', () => {
    /* The tick state lives in the clock alone; if it moved back into App, the
       whole grid would re-render every second. */
    render(<App />)
    dashboardRender.mockClear()

    act(() => {
      vi.advanceTimersByTime(5_000)
    })

    expect(dashboardRender).not.toHaveBeenCalled()
  })

  it('clears its own interval on unmount', () => {
    /* FE-6. Asserting only that clearInterval was called would pass if some
       unrelated timer were cleared, so the id is captured and compared. */
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    const { unmount } = render(<App />)
    const intervalId = setIntervalSpy.mock.results[0].value

    unmount()

    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId)
  })
})
