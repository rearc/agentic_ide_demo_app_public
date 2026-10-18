import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import useBoard, { PROFILE_STORAGE_KEY } from './useBoard'
import {
  createProfile,
  deleteProfile,
  fetchCards,
  fetchProfiles,
  updateProfile,
} from './api'
import { boardEntry, cardRecord, deferred, profileRecord } from './test/helpers'

vi.mock('./api')

const CARDS = [
  cardRecord({ id: 1, title: 'Weather' }),
  cardRecord({ id: 2, title: 'Quote' }),
  cardRecord({ id: 3, title: 'Todos' }),
]

// Card 2 is hidden lower than card 1's bottom edge, so a "bottom" that
// counted hidden entries would land at y 5, not y 4.
const DEFAULT_BOARD = {
  1: boardEntry({ x: 0, y: 0, w: 6, h: 4 }),
  2: boardEntry({ x: 6, y: 0, w: 6, h: 5, hidden: true }),
}
const FOCUS_BOARD = { 3: boardEntry({ x: 0, y: 0, w: 12, h: 8 }) }

const PROFILES = [
  profileRecord({ id: 10, name: 'Default', board: DEFAULT_BOARD }),
  profileRecord({ id: 11, name: 'Focus', board: FOCUS_BOARD }),
]

beforeEach(() => {
  localStorage.clear()
  fetchCards.mockResolvedValue(CARDS)
  fetchProfiles.mockResolvedValue(PROFILES)
  updateProfile.mockResolvedValue({})
  deleteProfile.mockResolvedValue(undefined)
})

/** Render the hook and wait for its first load to finish. */
async function renderBoard() {
  const hook = renderHook(() => useBoard())
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook.result
}

/** Let queued writes run. */
async function settle() {
  await act(async () => {})
}

describe('loading', () => {
  it('loads the library and shows the first profile', async () => {
    const board = await renderBoard()

    expect(board.current.cards).toEqual(CARDS)
    expect(board.current.profiles).toEqual(PROFILES)
    expect(board.current.profile.id).toBe(10)
    expect(board.current.board).toEqual(DEFAULT_BOARD)
    expect(board.current.error).toBeNull()
  })

  it('reports a failed load as an error', async () => {
    fetchProfiles.mockRejectedValue(new Error('Failed to fetch profiles'))

    const board = await renderBoard()

    expect(board.current.error).toBe('Failed to fetch profiles')
  })
})

describe('the shown profile', () => {
  it('is the one this browser chose last', async () => {
    localStorage.setItem(PROFILE_STORAGE_KEY, '11')

    const board = await renderBoard()

    expect(board.current.profile.id).toBe(11)
  })

  it('falls back to the first profile when the remembered one is gone', async () => {
    localStorage.setItem(PROFILE_STORAGE_KEY, '99')

    const board = await renderBoard()

    expect(board.current.profile.id).toBe(10)
  })

  it('is remembered when chosen', async () => {
    const board = await renderBoard()

    act(() => board.current.selectProfile(11))

    expect(board.current.profile.id).toBe(11)
    expect(board.current.board).toEqual(FOCUS_BOARD)
    expect(localStorage.getItem(PROFILE_STORAGE_KEY)).toBe('11')
  })

  it('falls back to the first profile when storage cannot be read', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const board = await renderBoard()

    expect(board.current.profile.id).toBe(10)
    expect(warn).toHaveBeenCalled()
  })

  it('still switches when storage cannot be written', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const board = await renderBoard()

    act(() => board.current.selectProfile(11))

    expect(board.current.profile.id).toBe(11)
    expect(warn).toHaveBeenCalled()
  })
})

describe('saving the layout', () => {
  it("overlays the grid's items onto the whole board, keeping hidden entries", async () => {
    /* The grid reports only the cards it shows, plus, mid-drop, its
       placeholder; neither may cost the board its hidden entries. */
    const board = await renderBoard()

    act(() =>
      board.current.saveLayout([
        { i: '1', x: 2, y: 3, w: 5, h: 6, minW: 2, minH: 2 },
        { i: '__dropping-elem__', x: 0, y: 9, w: 4, h: 4 },
      ]),
    )
    await settle()

    const saved = {
      1: boardEntry({ x: 2, y: 3, w: 5, h: 6 }),
      2: DEFAULT_BOARD[2],
    }
    expect(board.current.board).toEqual(saved)
    expect(updateProfile).toHaveBeenCalledWith(10, { board: saved })
  })
})

describe('hiding and showing cards', () => {
  it('hides a card, keeping its place and size', async () => {
    const board = await renderBoard()

    act(() => board.current.hideCard(1))
    await settle()

    const saved = { ...DEFAULT_BOARD, 1: { ...DEFAULT_BOARD[1], hidden: true } }
    expect(board.current.board).toEqual(saved)
    expect(updateProfile).toHaveBeenCalledWith(10, { board: saved })
  })

  it('brings a hidden card back at its stored size, below the visible cards', async () => {
    const board = await renderBoard()

    act(() => board.current.showCard(2))

    expect(board.current.board[2]).toEqual(
      boardEntry({ x: 0, y: 4, w: 6, h: 5 }),
    )
  })

  it('brings a card never placed on this board in at 4 by 4', async () => {
    const board = await renderBoard()

    act(() => board.current.showCard(3))

    expect(board.current.board[3]).toEqual(
      boardEntry({ x: 0, y: 4, w: 4, h: 4 }),
    )
  })

  it('puts a dropped card where it was dropped', async () => {
    const board = await renderBoard()

    act(() => board.current.showCard(3, { x: 4, y: 2 }))
    await settle()

    expect(board.current.board[3]).toEqual(
      boardEntry({ x: 4, y: 2, w: 4, h: 4 }),
    )
    expect(updateProfile).toHaveBeenCalledWith(10, {
      board: { ...DEFAULT_BOARD, 3: boardEntry({ x: 4, y: 2, w: 4, h: 4 }) },
    })
  })

  it('saves where a drop moved the other cards to make room', async () => {
    const board = await renderBoard()
    const gridItems = [
      { i: '1', x: 0, y: 4, w: 6, h: 4 },
      { i: '__dropping-elem__', x: 0, y: 0, w: 4, h: 4 },
    ]

    act(() => board.current.showCard(3, { x: 0, y: 0 }, gridItems))
    await settle()

    expect(updateProfile).toHaveBeenCalledWith(10, {
      board: {
        ...DEFAULT_BOARD,
        1: boardEntry({ x: 0, y: 4, w: 6, h: 4 }),
        3: boardEntry({ x: 0, y: 0, w: 4, h: 4 }),
      },
    })
  })
})

describe('profiles', () => {
  it('saves the shown board as a new profile, then shows it', async () => {
    const created = profileRecord({
      id: 12,
      name: 'Copy',
      board: DEFAULT_BOARD,
    })
    createProfile.mockResolvedValue(created)
    const board = await renderBoard()

    await act(() => board.current.createProfile('Copy'))

    expect(createProfile).toHaveBeenCalledWith('Copy', DEFAULT_BOARD)
    expect(board.current.profiles).toEqual([...PROFILES, created])
    expect(board.current.profile.id).toBe(12)
    expect(localStorage.getItem(PROFILE_STORAGE_KEY)).toBe('12')
  })

  it('rejects a failed create with its reason, changing nothing', async () => {
    createProfile.mockRejectedValue(new Error('Name already in use'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const board = await renderBoard()

    await act(() =>
      expect(board.current.createProfile('Focus')).rejects.toThrow(
        'Name already in use',
      ),
    )

    expect(board.current.profiles).toEqual(PROFILES)
    expect(board.current.profile.id).toBe(10)
  })

  it('renames a profile before the server answers', async () => {
    updateProfile.mockReturnValue(deferred().promise)
    const board = await renderBoard()

    act(() => {
      board.current.renameProfile(11, 'Deep work')
    })
    await settle()

    expect(board.current.profiles[1].name).toBe('Deep work')
    expect(updateProfile).toHaveBeenCalledWith(11, { name: 'Deep work' })
  })

  it('restores the saved name and rejects when a rename fails', async () => {
    updateProfile.mockRejectedValue(new Error('Name already in use'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const board = await renderBoard()

    await act(() =>
      expect(board.current.renameProfile(11, 'Default')).rejects.toThrow(
        'Name already in use',
      ),
    )
    await settle()

    expect(board.current.profiles[1].name).toBe('Focus')
  })

  it('deletes the shown profile and shows another', async () => {
    const board = await renderBoard()

    act(() => board.current.deleteProfile(10))
    await settle()

    expect(board.current.profiles.map((p) => p.id)).toEqual([11])
    expect(board.current.profile.id).toBe(11)
    expect(deleteProfile).toHaveBeenCalledWith(10)
  })

  it('never deletes the last profile', async () => {
    fetchProfiles.mockResolvedValue([PROFILES[0]])
    const board = await renderBoard()

    act(() => board.current.deleteProfile(10))
    await settle()

    expect(board.current.profiles).toHaveLength(1)
    expect(deleteProfile).not.toHaveBeenCalled()
  })
})

describe('writes', () => {
  it('logs a failed write and reloads the profiles, undoing it on screen', async () => {
    updateProfile.mockRejectedValue(new Error('Failed to update profile'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const board = await renderBoard()

    act(() => board.current.hideCard(1))
    await waitFor(() => expect(board.current.board).toEqual(DEFAULT_BOARD))

    expect(consoleError).toHaveBeenCalledWith(
      'Failed to save the board',
      expect.any(Error),
    )
    expect(fetchProfiles).toHaveBeenCalledTimes(2)
  })

  it('sends one write at a time, in the order they were made', async () => {
    /* Each write replaces the whole board, so two in flight could land in
       either order and leave the older board saved. */
    const first = deferred()
    updateProfile.mockReturnValueOnce(first.promise)
    const board = await renderBoard()

    act(() => {
      board.current.hideCard(1)
      board.current.showCard(3)
    })
    await settle()
    expect(updateProfile).toHaveBeenCalledTimes(1)

    first.resolve({})
    await settle()

    expect(updateProfile).toHaveBeenCalledTimes(2)
    expect(updateProfile.mock.calls[1][1].board[3]).toEqual(
      boardEntry({ x: 0, y: 0, w: 4, h: 4 }),
    )
  })

  it('sends each write to the profile it was made for', async () => {
    /* `hideCard` is taken from the render before the switch, as a grid
       handler held across renders would be: it must still act on the profile
       now shown, and the write queued before the switch must still go to the
       profile it was made for. */
    const first = deferred()
    updateProfile.mockReturnValueOnce(first.promise)
    const board = await renderBoard()
    const { hideCard, selectProfile } = board.current

    act(() => {
      hideCard(1)
      selectProfile(11)
      hideCard(3)
    })
    first.resolve({})
    await settle()

    expect(updateProfile.mock.calls.map(([id]) => id)).toEqual([10, 11])
    expect(board.current.profiles[0].board[1].hidden).toBe(true)
    expect(board.current.profiles[1].board[3].hidden).toBe(true)
  })
})
