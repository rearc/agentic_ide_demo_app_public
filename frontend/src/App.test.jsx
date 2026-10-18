import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'

// Dashboard and useBoard have their own tests; stubbing them keeps this file
// about App's own job: the clock, and the edit and library controls it owns.
const dashboardRender = vi.fn()
vi.mock('./components/Dashboard', () => ({
  default: ({ locked }) => {
    dashboardRender()
    return <div data-testid="dashboard" data-locked={String(locked)} />
  },
}))

vi.mock('./useBoard', async () => {
  const { cardRecord, profileRecord } = await import('./test/helpers')
  const noop = () => {}
  const profile = profileRecord()
  return {
    default: () => ({
      cards: [cardRecord({ title: 'Weather' })],
      profiles: [profile],
      profile,
      board: profile.board,
      loading: false,
      error: null,
      draggingCardId: null,
      setDraggingCardId: noop,
      selectProfile: noop,
      stepProfile: noop,
      saveLayout: noop,
      hideCard: noop,
      showCard: noop,
      createProfile: noop,
      renameProfile: noop,
      deleteProfile: noop,
    }),
  }
})

function dashboardLocked() {
  return screen.getByTestId('dashboard').dataset.locked
}

describe('edit mode', () => {
  function library() {
    return screen.queryByRole('region', { name: 'Card library' })
  }

  function libraryButton() {
    return screen.queryByRole('button', { name: 'Library' })
  }

  it('starts locked, with the library closed and no Library button', () => {
    render(<App />)

    expect(dashboardLocked()).toBe('true')
    expect(library()).not.toBeInTheDocument()
    expect(libraryButton()).not.toBeInTheDocument()
  })

  it('unlocks the dashboard and opens the library with Edit board', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Edit board' }))

    expect(dashboardLocked()).toBe('false')
    expect(library()).toBeInTheDocument()
    expect(libraryButton()).toHaveAttribute('aria-expanded', 'true')
  })

  it('folds the library away and back while staying in edit mode', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Edit board' }))
    await user.click(libraryButton())

    expect(library()).not.toBeInTheDocument()
    expect(dashboardLocked()).toBe('false')
    expect(libraryButton()).toHaveAttribute('aria-expanded', 'false')

    await user.click(libraryButton())

    expect(library()).toBeInTheDocument()
  })

  it('locks the board and closes the library with Done', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Edit board' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))

    expect(dashboardLocked()).toBe('true')
    expect(library()).not.toBeInTheDocument()
    expect(libraryButton()).not.toBeInTheDocument()
  })

  it('shows the drag hint only while editing', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(
      screen.queryByText(/changes save automatically/),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit board' }))

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
