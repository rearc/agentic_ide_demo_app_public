import { verticalCompactor } from 'react-grid-layout'

/** The id react-grid-layout gives the placeholder for a card dragged in. */
export const DROPPING_ID = '__dropping-elem__'

const overlaps = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/**
 * Slide `card` sideways to start at `x`, pushing on any card it then covers
 * in the same direction, as long as everything stays inside the grid.
 * Returns the new places by id, or null if there is no room. `fixed` holds
 * the places already decided (the moving card's, and earlier pushes').
 */
function slide(card, x, cards, cols, fixed) {
  if (x < 0 || x + card.w > cols) return null
  const moved = { ...card, x }
  const places = new Map([[card.i, moved]])
  const taken = new Map([...fixed, ...places])
  for (const other of cards) {
    if (taken.has(other.i) || !overlaps(moved, other)) continue
    const pushRight = moved.x > card.x
    const next = pushRight ? moved.x + moved.w : moved.x - other.w
    const further = slide(other, next, cards, cols, taken)
    if (!further) return null
    for (const [i, place] of further) {
      places.set(i, place)
      taken.set(i, place)
    }
  }
  return places
}

/**
 * Make room for `mover` beside it where the row allows: each card it covers
 * slides right (or left, if the card started to its left) just far enough,
 * pushing its own neighbours along, so long as nothing leaves the grid.
 * Cards there is no room for stay put, for the vertical compaction to move
 * down.
 */
function makeRoomBeside(mover, cards, cols) {
  const fixed = new Map([[mover.i, mover]])
  const covered = cards
    .filter((card) => card.i !== mover.i && overlaps(mover, card))
    .sort((a, b) => a.x - b.x)
  for (const card of covered) {
    if (fixed.has(card.i)) continue
    const toRight = card.x >= mover.x
    const x = toRight ? mover.x + mover.w : mover.x - card.w
    const places = slide(card, x, cards, cols, fixed)
    if (places) for (const [i, place] of places) fixed.set(i, place)
  }
  return cards.map((card) => fixed.get(card.i) ?? card)
}

/** Vertical compaction where `id` keeps its place and others settle round it. */
function settleAround(layout, id, cols) {
  const pin = (fixed) => (l) => (l.i === id ? { ...l, static: fixed } : l)
  // Pinned while the others settle around it, then free to float up like
  // any card.
  const settled = verticalCompactor.compact(layout.map(pin(true)), cols)
  return verticalCompactor.compact(settled.map(pin(false)), cols)
}

/**
 * The board's layout while a card is moved, resized or dragged in, and at
 * rest. react-grid-layout on its own only ever pushes a covered card down;
 * this first makes room sideways where the row has it, then lets the usual
 * vertical compaction settle the rest, with the moving card keeping its
 * place.
 *
 * `move` is the card being moved or resized (`id`) and the board as it was
 * when the move began (`start`): the other cards are placed from there each
 * time, so a card pushed aside comes back once the mover leaves. A card
 * dragged in from the library is the mover whenever its placeholder is on
 * the board.
 */
export function settleBoard(layout, cols, move) {
  const dropping = layout.find((l) => l.i === DROPPING_ID)
  const mover = dropping ?? (move && layout.find((l) => l.i === move.id))
  if (!mover) return verticalCompactor.compact(layout, cols)
  const others = (move?.start ?? layout).filter(
    (l) => l.i !== mover.i && l.i !== DROPPING_ID,
  )
  // Cards added or removed since the move began are taken from now.
  const now = new Map(layout.map((l) => [l.i, l]))
  const fromStart = others.filter((l) => now.has(l.i))
  const roomy = makeRoomBeside(mover, fromStart, cols)
  return settleAround([...roomy, mover], mover.i, cols)
}

/**
 * A react-grid-layout compactor that settles the board with `settleBoard`.
 * `moveRef.current` holds the move in progress, set and cleared by the
 * dashboard as moves start and stop. It lets cards overlap while a move is
 * worked out, so this compactor, not the grid, decides who moves where.
 */
export function makeCompactor(moveRef) {
  return {
    ...verticalCompactor,
    allowOverlap: true,
    compact: (layout, cols) => settleBoard(layout, cols, moveRef.current),
  }
}
