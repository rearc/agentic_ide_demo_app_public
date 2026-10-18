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
    open: true,
    cards: CARDS,
    board: BOARD,
    onAdd: vi.fn(),
    onRemove: vi.fn(),
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

describe('open and closed', () => {
  it('is inert and hidden from assistive technology while closed', () => {
    renderDrawer({ open: false })

    const drawer = document.getElementById('card-library')
    expect(drawer).toHaveAttribute('aria-hidden', 'true')
    expect(drawer).toHaveAttribute('inert')
  })

  it('is reachable while open', () => {
    renderDrawer()

    expect(
      screen.getByRole('region', { name: 'Card library' }),
    ).not.toHaveAttribute('inert')
  })
})

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

  it('takes a card off the board from its tile', async () => {
    const user = userEvent.setup()
    const { onRemove } = renderDrawer()

    await user.click(
      screen.getByRole('button', { name: 'Remove "Weather" from the board' }),
    )

    expect(onRemove).toHaveBeenCalledWith(1)
  })

  it('adds a card to the board with its Add button', async () => {
    const user = userEvent.setup()
    const { onAdd } = renderDrawer()

    await user.click(screen.getByRole('button', { name: 'Add "Todos"' }))

    expect(onAdd).toHaveBeenCalledWith(3)
  })
})

describe('search', () => {
  function search() {
    return screen.getByRole('searchbox', { name: 'Search cards' })
  }

  it('filters the tiles by title as you type, ignoring case', async () => {
    const user = userEvent.setup()
    renderDrawer()

    await user.type(search(), 'QUO')

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('listitem')).toHaveTextContent('Daily Quote')
  })

  it('matches descriptions too', async () => {
    const user = userEvent.setup()
    renderDrawer({
      cards: [
        cardRecord({ id: 1, title: 'Build Status', description: 'CI runs' }),
        cardRecord({ id: 2, title: 'Notes', description: 'A scratch pad' }),
      ],
    })

    await user.type(search(), 'ci')

    expect(screen.getByRole('listitem')).toHaveTextContent('Build Status')
  })

  it('counts the cards, and the matches while filtering', async () => {
    const user = userEvent.setup()
    renderDrawer()

    expect(screen.getByText('3 · 1 on board')).toBeInTheDocument()

    await user.type(search(), 'quo')

    expect(screen.getByText('1 of 3')).toBeInTheDocument()
  })

  it('clears with its own button', async () => {
    const user = userEvent.setup()
    renderDrawer()

    await user.type(search(), 'zzz')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(search()).toHaveValue('')
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('says when no card matches', async () => {
    const user = userEvent.setup()
    renderDrawer()

    await user.type(search(), 'zzz')

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    expect(screen.getByText('No cards match "zzz".')).toBeInTheDocument()
  })
})

describe('order and the "To add" switch', () => {
  function titles() {
    return screen
      .getAllByRole('listitem')
      .map((li) => li.querySelector('.font-semibold').textContent)
  }

  it('puts cards already on the board last, each group in library order', () => {
    renderDrawer()

    expect(titles()).toEqual(['Daily Quote', 'Todos', 'Weather'])
  })

  it('shows only the cards that can be added', async () => {
    const user = userEvent.setup()
    renderDrawer()

    await user.click(screen.getByRole('button', { name: 'To add' }))

    expect(titles()).toEqual(['Daily Quote', 'Todos'])
  })

  it('says when every card is on the board', async () => {
    const user = userEvent.setup()
    renderDrawer({ cards: [CARDS[0]] })

    await user.click(screen.getByRole('button', { name: 'To add' }))

    expect(screen.getByText('Every card is on the board.')).toBeInTheDocument()
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
