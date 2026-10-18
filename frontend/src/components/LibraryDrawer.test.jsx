import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import LibraryDrawer from './LibraryDrawer'
import { boardEntry, cardRecord } from '../test/helpers'

const CARDS = [
  cardRecord({ id: 1, title: 'Weather', source: 'weather', icon: 'cloud-sun' }),
  cardRecord({ id: 2, title: 'Daily Quote', source: 'quote', icon: 'quote' }),
  cardRecord({ id: 3, title: 'Todos', source: 'todo', icon: 'checklist' }),
]

// Weather is on the board, Daily Quote hidden from it, Todos never placed.
const BOARD = {
  1: boardEntry(),
  2: boardEntry({ x: 4, hidden: true }),
}

function renderDrawer(props = {}) {
  const all = {
    id: 'card-library',
    cards: CARDS,
    board: BOARD,
    onAdd: vi.fn(),
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
    ...props,
  }
  render(<LibraryDrawer {...all} />)
  return all
}

/** The tile showing the card with this title. */
function tile(title) {
  return screen.getByText(title).closest('li')
}

describe('tiles', () => {
  it('lists every card, marking the ones on the board', () => {
    renderDrawer()

    expect(within(tile('Weather')).getByText('On board')).toBeInTheDocument()
    expect(tile('Weather')).toHaveAttribute('draggable', 'false')
    for (const title of ['Daily Quote', 'Todos']) {
      expect(within(tile(title)).queryByText('On board')).toBeNull()
      expect(tile(title)).toHaveAttribute('draggable', 'true')
    }
  })

  it("draws each tile in its card's colour", () => {
    renderDrawer()

    expect(
      tile('Todos').querySelector('[data-card-tab]').style.background,
    ).toBe('var(--color-card-todo)')
    expect(tile('Todos').querySelector('[data-icon]').style.color).toBe(
      'var(--color-card-todo)',
    )
  })

  it('adds a card to the board with its Add button', async () => {
    const user = userEvent.setup()
    const { onAdd } = renderDrawer()

    await user.click(screen.getByRole('button', { name: 'Add "Todos"' }))

    expect(onAdd).toHaveBeenCalledWith(3)
  })
})

describe('search', () => {
  it('filters the tiles by title as you type, ignoring case', async () => {
    const user = userEvent.setup()
    renderDrawer()

    await user.type(
      screen.getByRole('searchbox', { name: 'Search cards' }),
      'QUO',
    )

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('Daily Quote')).toBeInTheDocument()
  })

  it('says when no card matches', async () => {
    const user = userEvent.setup()
    renderDrawer()

    await user.type(screen.getByRole('searchbox'), 'zzz')

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    expect(screen.getByText('No cards match "zzz".')).toBeInTheDocument()
  })
})

describe('dragging a tile', () => {
  it('hands over the card being dragged, with drag data for Firefox', () => {
    const { onDragStart } = renderDrawer()
    const dataTransfer = { setData: vi.fn() }

    fireEvent.dragStart(tile('Todos'), { dataTransfer })

    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', '3')
    expect(onDragStart).toHaveBeenCalledWith(3)
  })

  it('lets go of it when the drag ends', () => {
    const { onDragEnd } = renderDrawer()

    fireEvent.dragEnd(tile('Todos'))

    expect(onDragEnd).toHaveBeenCalled()
  })
})
