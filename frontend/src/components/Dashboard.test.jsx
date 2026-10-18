import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Dashboard, { STACK_BELOW } from './Dashboard'
import { DRAG_HANDLE_CLASS } from './Card'
import { boardEntry, cardRecord } from '../test/helpers'

vi.mock('../api')

// react-grid-layout owns drag, resize and drop maths and needs real layout
// boxes, which jsdom does not provide. Stub it so these tests cover
// Dashboard's own logic: which layout it hands the grid, and what it does with
// what the grid reports back. The stub keeps the callbacks so a test can fire
// them as the real grid would.
const grid = vi.hoisted(() => ({
  onDragStop: null,
  onResizeStop: null,
  onDrop: null,
  onDropDragOver: null,
  width: 1200,
}))

vi.mock('react-grid-layout', () => ({
  GridLayout: ({
    children,
    layout,
    dragConfig,
    resizeConfig,
    dropConfig,
    onDragStop,
    onResizeStop,
    onDrop,
    onDropDragOver,
  }) => {
    Object.assign(grid, { onDragStop, onResizeStop, onDrop, onDropDragOver })
    return (
      <div
        data-testid="grid"
        data-layout={JSON.stringify(layout)}
        data-drag-enabled={String(dragConfig?.enabled)}
        data-drag-handle={dragConfig?.handle}
        data-drag-cancel={dragConfig?.cancel}
        data-resize-enabled={String(resizeConfig?.enabled)}
        data-drop-enabled={String(dropConfig?.enabled)}
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
}))

/** Render with a one-card board unless the test says otherwise. */
function renderDashboard(props = {}) {
  const all = {
    cards: [cardRecord({ id: 1 })],
    board: { 1: boardEntry() },
    locked: false,
    loading: false,
    error: null,
    draggingCardId: null,
    saveLayout: vi.fn(),
    hideCard: vi.fn(),
    showCard: vi.fn(),
    ...props,
  }
  render(<Dashboard {...all} />)
  return all
}

function renderedLayout() {
  return JSON.parse(screen.getByTestId('grid').dataset.layout)
}

beforeEach(() => {
  grid.width = 1200
})

describe('loading and error states', () => {
  it('shows a loading indicator while the board loads', () => {
    renderDashboard({ loading: true })

    expect(
      screen.getByRole('status', { name: 'Loading dashboard' }),
    ).toBeInTheDocument()
  })

  it('shows a card for each entry the board shows', () => {
    renderDashboard({
      cards: [
        cardRecord({ id: 1, title: 'First' }),
        cardRecord({ id: 2, title: 'Second' }),
      ],
      board: { 1: boardEntry(), 2: boardEntry({ x: 4 }) },
    })

    expect(screen.getByRole('heading', { name: 'First' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Second' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows an error and a hint to check the backend when the board cannot load', () => {
    renderDashboard({ error: 'Failed to fetch cards' })

    expect(screen.getByText('Unable to load dashboard')).toBeInTheDocument()
    expect(screen.getByText('Failed to fetch cards')).toBeInTheDocument()
    expect(
      screen.getByText('Make sure the backend is running on port 5001'),
    ).toBeInTheDocument()
  })

  it('says an empty board is empty, and still renders the grid to drop onto', () => {
    renderDashboard({ board: {} })

    expect(screen.getByText(/No cards on this board/)).toBeInTheDocument()
    expect(renderedLayout()).toEqual([])
  })
})

describe('layout computation', () => {
  it("places each card at its board entry's position and size", () => {
    renderDashboard({ board: { 1: boardEntry({ x: 2, y: 3, w: 6, h: 5 }) } })

    expect(renderedLayout()).toEqual([
      { i: '1', x: 2, y: 3, w: 6, h: 5, minW: 2, minH: 2 },
    ])
  })

  it('leaves out hidden cards and cards the board has never placed', () => {
    renderDashboard({
      cards: [
        cardRecord({ id: 1, title: 'Shown' }),
        cardRecord({ id: 2, title: 'Hidden' }),
        cardRecord({ id: 3, title: 'Never placed' }),
      ],
      board: { 1: boardEntry(), 2: boardEntry({ x: 4, hidden: true }) },
    })

    expect(renderedLayout().map((item) => item.i)).toEqual(['1'])
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual([
      'Shown',
    ])
  })
})

describe('lock state', () => {
  it.each([
    ['disables', 'locked', true],
    ['enables', 'unlocked', false],
  ])('%s dragging, resizing and dropping when %s', (_verb, _state, locked) => {
    renderDashboard({ locked })

    const gridEl = screen.getByTestId('grid')
    expect(gridEl.dataset.dragEnabled).toBe(String(!locked))
    expect(gridEl.dataset.resizeEnabled).toBe(String(!locked))
    expect(gridEl.dataset.dropEnabled).toBe(String(!locked))
  })
})

describe('saving', () => {
  const MOVED = [{ i: '1', x: 5, y: 6, w: 3, h: 2 }]

  it.each([
    ['a drag', 'onDragStop'],
    ['a resize', 'onResizeStop'],
  ])('saves the layout when %s stops', (_action, callback) => {
    const { saveLayout } = renderDashboard()

    grid[callback](MOVED)

    expect(saveLayout).toHaveBeenCalledWith(MOVED)
  })

  it('hides a card when its × is pressed', async () => {
    const user = userEvent.setup()
    const { hideCard } = renderDashboard({
      cards: [cardRecord({ id: 7, title: 'Todos' })],
      board: { 7: boardEntry() },
    })

    await user.click(screen.getByRole('button', { name: 'Remove "Todos"' }))

    expect(hideCard).toHaveBeenCalledWith(7)
  })
})

describe('dropping a card from the library', () => {
  /* The dragged card's id comes from useBoard (set by the library tile on
     dragstart), because the grid cannot read dataTransfer during dragover. */

  it.each([
    ['its stored size, for a hidden card', 2, { w: 6, h: 5 }],
    ['4 by 4, for a card never placed', 3, { w: 4, h: 4 }],
  ])('sizes the drop placeholder at %s', (_case, draggingCardId, size) => {
    renderDashboard({
      board: {
        1: boardEntry(),
        2: boardEntry({ w: 6, h: 5, hidden: true }),
      },
      draggingCardId,
    })

    expect(grid.onDropDragOver()).toEqual(size)
  })

  it('refuses a drag that is not a library card', () => {
    renderDashboard({ draggingCardId: null })

    expect(grid.onDropDragOver()).toBe(false)
  })

  it('shows the dragged card where the placeholder was dropped', () => {
    /* The layout argument also holds the placeholder and every other card;
       only the placeholder item says where the drop landed. */
    const { showCard } = renderDashboard({ draggingCardId: 3 })
    const placeholder = { i: '__dropping-elem__', x: 4, y: 2, w: 4, h: 4 }

    grid.onDrop([{ i: '1', x: 0, y: 0, w: 4, h: 4 }, placeholder], placeholder)

    expect(showCard).toHaveBeenCalledWith(3, { x: 4, y: 2 })
  })

  it('ignores a drop with no library card being dragged', () => {
    const { showCard } = renderDashboard({ draggingCardId: null })

    grid.onDrop([], { i: '__dropping-elem__', x: 0, y: 0, w: 1, h: 1 })

    expect(showCard).not.toHaveBeenCalled()
  })
})

describe('narrow container', () => {
  const CARDS = [
    cardRecord({ id: 1, title: 'Right' }),
    cardRecord({ id: 2, title: 'Below' }),
    cardRecord({ id: 3, title: 'Left' }),
  ]
  const BOARD = {
    1: boardEntry({ x: 6, y: 0, w: 6, h: 4 }),
    2: boardEntry({ x: 0, y: 4, w: 12, h: 3 }),
    3: boardEntry({ x: 0, y: 0, w: 6, h: 4 }),
  }

  it('stacks the cards in grid order instead of rendering the grid', () => {
    grid.width = STACK_BELOW - 1

    renderDashboard({ cards: CARDS, board: BOARD })

    expect(screen.queryByTestId('grid')).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual([
      'Left',
      'Right',
      'Below',
    ])
  })

  it('keeps the grid at the stacking width itself', () => {
    grid.width = STACK_BELOW

    renderDashboard({ cards: CARDS, board: BOARD })

    expect(screen.getByTestId('grid')).toBeInTheDocument()
  })

  it('offers the × but no drag handle on a stacked card when unlocked', () => {
    grid.width = STACK_BELOW - 1

    renderDashboard({ cards: CARDS, board: BOARD, locked: false })

    expect(document.querySelector(`.${DRAG_HANDLE_CLASS}`)).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Remove "Left"' }),
    ).toBeInTheDocument()
  })
})

describe('drag handle wiring', () => {
  /* The selector Dashboard gives the grid and the class Card renders have to
     agree. They are separate files, so nothing but this test catches a drift
     that silently disables dragging in the browser. */

  it('hands the grid a selector matching the class Card renders', () => {
    renderDashboard({ locked: false })

    const handle = document.querySelector(`.${DRAG_HANDLE_CLASS}`)
    expect(handle).not.toBeNull()
    expect(screen.getByTestId('grid').dataset.dragHandle).toBe(
      `.${DRAG_HANDLE_CLASS}`,
    )
  })

  it('starts no drag from a button in the handle, such as the remove ×', async () => {
    await renderDashboard({ locked: false })

    expect(screen.getByTestId('grid').dataset.dragCancel).toBe('button')
  })
})
