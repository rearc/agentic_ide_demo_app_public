import {
  GridLayout,
  useContainerWidth,
  verticalCompactor,
} from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { placedSize } from '../useBoard'
import Card, { DRAG_HANDLE_CLASS } from './Card'
import LoadingDots from './LoadingDots'

// Cards sit MARGIN px apart. Each draws a 1 px outline just outside its box
// (Card.jsx), so the grid keeps OUTLINE px clear around its edge for it.
const COLS = 12
const ROW_HEIGHT = 46
const MARGIN = 8
const OUTLINE = 1

// Below this container width the grid's columns get too narrow to read, so
// the cards stack in one column instead, in grid order, without dragging.
// It matches Tailwind's `md` breakpoint less the page padding (App.jsx), where
// the header hides the customize button.
export const STACK_BELOW = 728

/** Shown in place of the cards when the board shows none. */
function EmptyBoard() {
  return (
    <p className="text-center text-sm text-text-secondary py-10">
      No cards on this board. Open the Library to add some.
    </p>
  )
}

/** A card's stacked height: the height its grid rows would give it. */
function stackedHeight(h) {
  return h * ROW_HEIGHT + (h - 1) * MARGIN
}

/** The grid items for the cards `board` shows, in library order. */
function buildLayout(cards, board) {
  return cards
    .filter((card) => board[card.id] && !board[card.id].hidden)
    .map((card) => {
      const { x, y, w, h } = board[card.id]
      return { i: String(card.id), x, y, w, h, minW: 2, minH: 2 }
    })
}

// The id react-grid-layout gives the placeholder for a card dragged in.
const DROPPING_ID = '__dropping-elem__'

/**
 * The grid's usual vertical compaction, except that a card being dragged in
 * from the library wins any tie for a spot: the cards it covers move down.
 * Without this, a card hovered over the cell where it entered the grid sorts
 * after the card already there and is settled below it, so it lands lower
 * than where it was dropped.
 */
const dropFirstCompactor = {
  ...verticalCompactor,
  compact(layout, cols) {
    const pin = (static_) => (l) =>
      l.i === DROPPING_ID ? { ...l, static: static_ } : l
    // Pinned while the others settle around it, then free to float up like
    // any card.
    const settled = verticalCompactor.compact(layout.map(pin(true)), cols)
    return verticalCompactor.compact(settled.map(pin(false)), cols)
  },
}

/**
 * The shown profile's board. It owns no state: `useBoard` hands it the cards,
 * the board and the actions that change them. Every finished move, resize,
 * removal and drop is saved at once.
 */
export default function Dashboard({
  cards,
  board,
  locked,
  loading,
  error,
  draggingCardId,
  saveLayout,
  hideCard,
  showCard,
}) {
  const { width, containerRef, mounted } = useContainerWidth()

  const layout = buildLayout(cards, board)
  const cardsById = new Map(cards.map((card) => [String(card.id), card]))
  const stacked = width < STACK_BELOW

  // While a library tile is dragged over the grid, the placeholder takes the
  // size the card will land at. Anything else dragged in is refused.
  function sizeDropping() {
    if (draggingCardId === null) return false
    return placedSize(board, draggingCardId)
  }

  // The grid's items include its drop placeholder (DROPPING_ID), which marks
  // where the card was dropped; the card itself is the one being dragged.
  // They are settled once more, because a drop straight onto the cell where
  // the card entered the grid arrives before the grid has made room.
  function handleDrop(gridItems) {
    if (draggingCardId === null) return
    const settled = dropFirstCompactor.compact(gridItems, COLS)
    const dropped = settled.find((l) => l.i === DROPPING_ID)
    if (!dropped) return
    showCard(draggingCardId, { x: dropped.x, y: dropped.y }, settled)
  }

  let content
  if (loading) {
    content = (
      <LoadingDots label="Loading dashboard" size="md" className="py-24" />
    )
  } else if (error) {
    content = (
      <div className="text-center py-24">
        <p className="text-text-primary text-lg">Unable to load dashboard</p>
        <p className="text-text-secondary text-sm mt-2">{error}</p>
        <p className="text-text-secondary text-sm mt-1">
          Make sure the backend is running on port 5001
        </p>
      </div>
    )
  } else if (stacked) {
    const inGridOrder = [...layout].sort((a, b) => a.y - b.y || a.x - b.x)
    content = (
      <>
        {layout.length === 0 && <EmptyBoard />}
        <div
          className="flex flex-col"
          style={{ gap: MARGIN, padding: OUTLINE }}
        >
          {inGridOrder.map((item) => {
            const card = cardsById.get(item.i)
            return (
              <div key={item.i} style={{ height: stackedHeight(item.h) }}>
                <Card
                  card={card}
                  locked={locked}
                  movable={false}
                  onRemove={() => hideCard(card.id)}
                />
              </div>
            )
          })}
        </div>
      </>
    )
  } else if (mounted) {
    content = (
      <>
        {layout.length === 0 && <EmptyBoard />}
        <GridLayout
          // An empty board still needs room to drop a card onto.
          className="min-h-64"
          width={width}
          layout={layout}
          compactor={dropFirstCompactor}
          onDragStop={saveLayout}
          onResizeStop={saveLayout}
          onDropDragOver={sizeDropping}
          onDrop={handleDrop}
          gridConfig={{
            cols: COLS,
            rowHeight: ROW_HEIGHT,
            margin: [MARGIN, MARGIN],
            containerPadding: [OUTLINE, OUTLINE],
          }}
          // `cancel`: pressing a header button (the remove ×) never starts a drag.
          dragConfig={{
            enabled: !locked,
            handle: `.${DRAG_HANDLE_CLASS}`,
            cancel: 'button',
          }}
          resizeConfig={{ enabled: !locked }}
          dropConfig={{ enabled: !locked }}
        >
          {layout.map((item, i) => {
            const card = cardsById.get(item.i)
            return (
              <div
                key={item.i}
                className="animate-card-enter"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <Card
                  card={card}
                  locked={locked}
                  onRemove={() => hideCard(card.id)}
                />
              </div>
            )
          })}
        </GridLayout>
      </>
    )
  }

  // The container is rendered from the first paint, loading included:
  // useContainerWidth measures it once, on mount, and a container that
  // appeared only after loading was never measured (the grid kept the hook's
  // 1280 px default and overflowed narrower windows).
  return <div ref={containerRef}>{content}</div>
}
