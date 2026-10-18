import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Dashboard, { STACK_BELOW } from './Dashboard'
import { DRAG_HANDLE_CLASS } from './Card'
import { fetchCards, updateCard } from '../api'
import { cardRecord } from '../test/helpers'

vi.mock('../api')

// react-grid-layout owns drag/resize maths and needs real layout boxes, which
// jsdom does not provide. Stub it so these tests cover Dashboard's own logic:
// which layout it computes, and when it decides to persist one.
//
// `emitOnMount` reproduces the real library's behavior of firing
// onLayoutChange as it mounts, echoing `mountLayout` (its compacted result)
// or, when that is unset, the layout it was handed.
const grid = vi.hoisted(() => ({
  onLayoutChange: null,
  emitOnMount: false,
  mountLayout: null,
  width: 1200,
}))

vi.mock('react-grid-layout', async () => {
  const { useEffect } = await import('react')
  return {
    GridLayout: ({
      children,
      layout,
      dragConfig,
      resizeConfig,
      onLayoutChange,
    }) => {
      grid.onLayoutChange = onLayoutChange
      useEffect(() => {
        if (grid.emitOnMount) onLayoutChange(grid.mountLayout ?? layout)
      }, [])
      return (
        <div
          data-testid="grid"
          data-layout={JSON.stringify(layout)}
          data-drag-enabled={String(dragConfig?.enabled)}
          data-drag-handle={dragConfig?.handle}
          data-resize-enabled={String(resizeConfig?.enabled)}
        >
          {children}
        </div>
      )
    },
    useContainerWidth: () => ({
      width: grid.width,
      containerRef: { current: null },
      mounted: true,
    }),
  }
})

/** Render and flush the initial fetchCards promise. */
async function renderDashboard({
  locked = false,
  cards = [cardRecord()],
} = {}) {
  fetchCards.mockResolvedValue(cards)
  const utils = render(<Dashboard locked={locked} />)
  await act(async () => {})
  return utils
}

function renderedLayout() {
  return JSON.parse(screen.getByTestId('grid').dataset.layout)
}

beforeEach(() => {
  grid.onLayoutChange = null
  grid.emitOnMount = false
  grid.mountLayout = null
  grid.width = 1200
  updateCard.mockResolvedValue({})
})

describe('loading and error states', () => {
  it('shows a loading indicator before the cards arrive', () => {
    fetchCards.mockReturnValue(new Promise(() => {}))

    render(<Dashboard locked />)

    expect(
      screen.getByRole('status', { name: 'Loading dashboard' }),
    ).toBeInTheDocument()
  })

  it('shows a card for each record once they load', async () => {
    await renderDashboard({
      cards: [
        cardRecord({ id: 1, title: 'First' }),
        cardRecord({ id: 2, title: 'Second' }),
      ],
    })

    expect(screen.getByRole('heading', { name: 'First' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Second' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows an error and a hint to check the backend when the cards cannot load', async () => {
    fetchCards.mockRejectedValue(new Error('Failed to fetch cards'))

    render(<Dashboard locked />)

    expect(
      await screen.findByText('Unable to load dashboard'),
    ).toBeInTheDocument()
    expect(screen.getByText('Failed to fetch cards')).toBeInTheDocument()
    expect(
      screen.getByText('Make sure the backend is running on port 5001'),
    ).toBeInTheDocument()
  })

  it('renders an empty grid, not the loading state, when there are no cards', async () => {
    await renderDashboard({ cards: [] })

    expect(renderedLayout()).toEqual([])
  })
})

describe('layout computation', () => {
  it('uses the stored layout when the card has one', async () => {
    await renderDashboard({
      cards: [cardRecord({ id: 7, layout: { x: 2, y: 3, w: 6, h: 5 } })],
    })

    expect(renderedLayout()[0]).toMatchObject({
      i: '7',
      x: 2,
      y: 3,
      w: 6,
      h: 5,
    })
  })

  it('keeps stored zero coordinates instead of computing a fallback', async () => {
    /* A card dragged to the top-left legitimately stores x:0/y:0. Those are
       falsy, so a `||` fallback would silently relocate it on next load. The
       second and third cards are what make this detectable: their computed
       fallbacks differ from zero. */
    await renderDashboard({
      cards: [
        cardRecord({ id: 1, layout: { x: 0, y: 0, w: 6, h: 4 } }),
        cardRecord({ id: 2, layout: { x: 0, y: 0, w: 6, h: 4 } }),
        cardRecord({ id: 3, layout: { x: 0, y: 0, w: 6, h: 4 } }),
      ],
    })

    expect(renderedLayout()).toMatchObject([
      { i: '1', x: 0, y: 0 },
      { i: '2', x: 0, y: 0 }, // a `||` fallback would put this at x:6
      { i: '3', x: 0, y: 0 }, // and this at y:4
    ])
  })

  it('falls back to a computed position when the card has no layout', async () => {
    await renderDashboard({
      cards: [
        cardRecord({ id: 1, layout: {} }),
        cardRecord({ id: 2, layout: {} }),
        cardRecord({ id: 3, layout: {} }),
      ],
    })

    expect(renderedLayout()).toMatchObject([
      { i: '1', x: 0, y: 0, w: 6, h: 4 },
      { i: '2', x: 6, y: 0, w: 6, h: 4 },
      { i: '3', x: 0, y: 4, w: 6, h: 4 },
    ])
  })

  it('applies minimum dimensions to every item', async () => {
    await renderDashboard()

    expect(renderedLayout()[0]).toMatchObject({ minW: 2, minH: 2 })
  })
})

describe('lock state', () => {
  it.each([
    ['disables', 'locked', true],
    ['enables', 'unlocked', false],
  ])('%s dragging and resizing when %s', async (_verb, _state, locked) => {
    await renderDashboard({ locked })

    const gridEl = screen.getByTestId('grid')
    expect(gridEl.dataset.dragEnabled).toBe(String(!locked))
    expect(gridEl.dataset.resizeEnabled).toBe(String(!locked))
  })
})

describe('persisting layout changes', () => {
  const MOVED = [{ i: '1', x: 5, y: 6, w: 3, h: 2 }]

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** Fire a layout change and let the debounce window elapse. */
  async function changeLayoutAndSettle(layout, { advanceBy = 500 } = {}) {
    await act(async () => {
      grid.onLayoutChange(layout)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(advanceBy)
    })
  }

  it('saves the new layout after the debounce window', async () => {
    await renderDashboard({ locked: false })

    await changeLayoutAndSettle(MOVED)

    expect(updateCard).toHaveBeenCalledWith(1, {
      layout: { x: 5, y: 6, w: 3, h: 2 },
    })
  })

  it('does not save before the debounce window elapses', async () => {
    await renderDashboard({ locked: false })

    await changeLayoutAndSettle(MOVED, { advanceBy: 499 })

    expect(updateCard).not.toHaveBeenCalled()
  })

  it('coalesces a burst of changes into a single save', async () => {
    await renderDashboard({ locked: false })

    await act(async () => {
      grid.onLayoutChange([{ i: '1', x: 1, y: 0, w: 3, h: 2 }])
      grid.onLayoutChange([{ i: '1', x: 2, y: 0, w: 3, h: 2 }])
      grid.onLayoutChange([{ i: '1', x: 3, y: 0, w: 3, h: 2 }])
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(updateCard).toHaveBeenCalledTimes(1)
    expect(updateCard).toHaveBeenCalledWith(1, {
      layout: { x: 3, y: 0, w: 3, h: 2 },
    })
  })

  it('saves only the cards that actually moved', async () => {
    await renderDashboard({
      locked: false,
      cards: [
        cardRecord({ id: 1, layout: { x: 0, y: 0, w: 4, h: 4 } }),
        cardRecord({ id: 2, layout: { x: 4, y: 0, w: 4, h: 4 } }),
      ],
    })

    await changeLayoutAndSettle([
      { i: '1', x: 0, y: 0, w: 4, h: 4 },
      { i: '2', x: 8, y: 0, w: 4, h: 4 },
    ])

    expect(updateCard).toHaveBeenCalledTimes(1)
    expect(updateCard).toHaveBeenCalledWith(2, {
      layout: { x: 8, y: 0, w: 4, h: 4 },
    })
  })

  it('ignores layout items with no matching card', async () => {
    await renderDashboard({ locked: false })

    await changeLayoutAndSettle([{ i: '999', x: 5, y: 5, w: 2, h: 2 }])

    expect(updateCard).not.toHaveBeenCalled()
  })

  it('reflects the saved layout in the grid it renders next', async () => {
    await renderDashboard({ locked: false })

    await changeLayoutAndSettle(MOVED)

    expect(renderedLayout()[0]).toMatchObject({
      i: '1',
      x: 5,
      y: 6,
      w: 3,
      h: 2,
    })
  })

  it('does not leave the pending save running after unmount', async () => {
    /* The debounced callback is a queued write to the API. Unmounting inside
       the window must cancel it, not fire it against a dead component. */
    const { unmount } = await renderDashboard({ locked: false })

    await act(async () => {
      grid.onLayoutChange(MOVED)
    })
    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(updateCard).not.toHaveBeenCalled()
  })

  it('logs a failed save instead of leaving the rejection unhandled', async () => {
    updateCard.mockRejectedValue(new Error('Failed to update card'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await renderDashboard({ locked: false })

    await changeLayoutAndSettle(MOVED)

    expect(consoleError).toHaveBeenCalledWith(
      'Failed to save card layout',
      expect.any(Error),
    )
  })

  it('does not save a layout change made after locking', async () => {
    const { rerender } = await renderDashboard({ locked: false })
    rerender(<Dashboard locked />)

    await changeLayoutAndSettle(MOVED)

    expect(updateCard).not.toHaveBeenCalled()
  })

  describe('the layout the grid emits on mount', () => {
    it('is persisted like any other layout change', async () => {
      /* react-grid-layout compacts as it mounts and reports the result.
         Saving it keeps storage matching what is actually on screen. */
      grid.emitOnMount = true
      grid.mountLayout = [{ i: '1', x: 7, y: 7, w: 2, h: 2 }]

      await renderDashboard({
        locked: false,
        cards: [cardRecord({ id: 1, layout: { x: 0, y: 0, w: 4, h: 4 } })],
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })

      expect(updateCard).toHaveBeenCalledWith(1, {
        layout: { x: 7, y: 7, w: 2, h: 2 },
      })
    })

    it('is not persisted when it matches the stored layout', async () => {
      /* The unchanged-layout early return is what keeps the common case a
         no-op, so a plain page load writes nothing. */
      grid.emitOnMount = true

      await renderDashboard({
        locked: false,
        cards: [cardRecord({ id: 1, layout: { x: 0, y: 0, w: 4, h: 4 } })],
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })

      expect(updateCard).not.toHaveBeenCalled()
    })
  })
})

describe('narrow container', () => {
  const CARDS = [
    cardRecord({ id: 1, title: 'Right', layout: { x: 6, y: 0, w: 6, h: 4 } }),
    cardRecord({ id: 2, title: 'Below', layout: { x: 0, y: 4, w: 12, h: 3 } }),
    cardRecord({ id: 3, title: 'Left', layout: { x: 0, y: 0, w: 6, h: 4 } }),
  ]

  it('stacks the cards in grid order instead of rendering the grid', async () => {
    grid.width = STACK_BELOW - 1

    await renderDashboard({ cards: CARDS })

    expect(screen.queryByTestId('grid')).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual([
      'Left',
      'Right',
      'Below',
    ])
  })

  it('keeps the grid at the stacking width itself', async () => {
    grid.width = STACK_BELOW

    await renderDashboard({ cards: CARDS })

    expect(screen.getByTestId('grid')).toBeInTheDocument()
  })

  it('offers no drag handle on a stacked card, even when unlocked', async () => {
    grid.width = STACK_BELOW - 1

    await renderDashboard({ locked: false, cards: CARDS })

    expect(document.querySelector(`.${DRAG_HANDLE_CLASS}`)).toBeNull()
  })
})

describe('drag handle wiring', () => {
  /* The selector Dashboard gives the grid and the class Card renders have to
     agree. They are separate files, so nothing but this test catches a drift
     that silently disables dragging in the browser. */

  it('hands the grid a selector matching the class Card renders', async () => {
    await renderDashboard({ locked: false })

    const handle = document.querySelector(`.${DRAG_HANDLE_CLASS}`)
    expect(handle).not.toBeNull()
    expect(screen.getByTestId('grid').dataset.dragHandle).toBe(
      `.${DRAG_HANDLE_CLASS}`,
    )
  })
})
