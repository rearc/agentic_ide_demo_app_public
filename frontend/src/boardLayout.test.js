import { describe, expect, it } from 'vitest'

import { DROPPING_ID, settleBoard } from './boardLayout'

const COLS = 24
const card = (i, x, y, w, h) => ({ i, x, y, w, h })

/** Each card's place, by id, for comparing whole boards. */
const places = (layout) =>
  Object.fromEntries(layout.map(({ i, x, y, w, h }) => [i, [x, y, w, h]]))

// A full-width row like the owner's: four cards and two free columns.
const ROW = [
  card('weather', 0, 0, 6, 8),
  card('daylight', 6, 0, 4, 8),
  card('moon', 10, 0, 6, 8),
  card('timer', 16, 0, 6, 8),
]

/** `id` resized or moved to `place`, as the grid hands it to the compactor. */
function moving(id, place) {
  const layout = ROW.map((c) => (c.i === id ? { ...c, ...place } : c))
  return settleBoard(layout, COLS, { id, start: ROW })
}

describe('settleBoard', () => {
  it('makes room sideways when a card grows into its neighbour and the row has room', () => {
    const settled = places(moving('daylight', { w: 6 }))

    expect(settled).toEqual({
      weather: [0, 0, 6, 8],
      daylight: [6, 0, 6, 8],
      moon: [12, 0, 6, 8],
      timer: [18, 0, 6, 8],
    })
  })

  it('moves the covered card down when the row has no room', () => {
    const settled = places(moving('daylight', { w: 9 }))

    expect(settled.moon[1]).toBeGreaterThan(0)
    expect(settled.daylight).toEqual([6, 0, 9, 8])
  })

  it('slides a card left when the mover comes at it from the right', () => {
    const board = [card('a', 2, 0, 6, 8), card('b', 12, 0, 6, 8)]
    const layout = [board[0], { ...board[1], x: 6 }]

    const settled = places(settleBoard(layout, COLS, { id: 'b', start: board }))

    expect(settled).toEqual({ a: [0, 0, 6, 8], b: [6, 0, 6, 8] })
  })

  it('puts a card pushed aside back once the mover leaves', () => {
    // The move began with the row as it is; daylight first grew, then shrank.
    const settled = places(moving('daylight', { w: 4 }))

    expect(settled.moon).toEqual([10, 0, 6, 8])
    expect(settled.timer).toEqual([16, 0, 6, 8])
  })

  it('makes room the same way for a card dragged in from the library', () => {
    const board = [card('a', 0, 0, 8, 8), card('b', 8, 0, 8, 8)]
    const dropping = card(DROPPING_ID, 0, 0, 8, 8)

    const settled = places(
      settleBoard([...board, dropping], COLS, {
        id: DROPPING_ID,
        start: board,
      }),
    )

    expect(settled).toEqual({
      a: [8, 0, 8, 8],
      b: [16, 0, 8, 8],
      [DROPPING_ID]: [0, 0, 8, 8],
    })
  })

  it('only compacts upward when nothing is moving', () => {
    const settled = places(settleBoard([card('a', 0, 5, 8, 8)], COLS, null))

    expect(settled).toEqual({ a: [0, 0, 8, 8] })
  })
})
