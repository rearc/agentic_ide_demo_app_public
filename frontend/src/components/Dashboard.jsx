import {
  GridLayout,
  useContainerWidth,
  verticalCompactor,
} from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { useEffect, useRef, useState } from 'react'
import { placedSize } from '../useBoard'
import Card, { DRAG_HANDLE_CLASS, cardAccent } from './Card'
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
      No cards on this board. Choose Edit board to add some from the library.
    </p>
  )
}

/**
 * The grid's 12 columns, drawn faintly behind the cards while editing so it
 * shows where a card will land. Same padding and gaps as the grid, so each
 * guide lines up with a column.
 */
function ColumnGuides({ shown }) {
  return (
    <div
      aria-hidden
      data-column-guides={shown}
      className={`absolute inset-0 grid pointer-events-none transition-opacity duration-300 ${shown ? 'opacity-100' : 'opacity-0'}`}
      style={{
        gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
        gap: MARGIN,
        padding: OUTLINE,
      }}
    >
      {Array.from({ length: COLS }, (_, i) => (
        <span
          key={i}
          className="bg-text-primary/[0.025] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-text-primary)_5%,transparent)]"
        />
      ))}
    </div>
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
  profileId,
  turn,
  locked,
  loading,
  error,
  draggingCardId,
  saveLayout,
  hideCard,
  showCard,
}) {
  const { width, containerRef, mounted } = useContainerWidth()
  // The card being moved or resized on the grid, for the preview's colour.
  const [movingId, setMovingId] = useState(null)
  const pageRef = useRef(null)

  // A page turn: the board slides in from the side the arrow points to.
  // Animated in place rather than remounting the board, so the cards both
  // profiles show keep their data instead of fetching it again.
  useEffect(() => {
    const page = pageRef.current
    if (!turn || !page?.animate) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const from = turn === 'next' ? 48 : -48
    page.getAnimations().forEach((a) => a.cancel())
    page.animate(
      [
        { opacity: 0, transform: `translateX(${from}px)` },
        { opacity: 1, transform: 'none' },
      ],
      {
        duration: 420,
        easing:
          getComputedStyle(page).getPropertyValue('--ease-sheet') || 'ease-out',
      },
    )
  }, [profileId, turn])

  const layout = buildLayout(cards, board)
  const cardsById = new Map(cards.map((card) => [String(card.id), card]))
  const stacked = width < STACK_BELOW
  const previewCard = cardsById.get(String(movingId ?? draggingCardId))

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

  function finishMove(gridItems) {
    setMovingId(null)
    saveLayout(gridItems)
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
      <div className="relative">
        {layout.length === 0 && <EmptyBoard />}
        <ColumnGuides shown={!locked} />
        <GridLayout
          // An empty board still needs room to drop a card onto.
          className="min-h-64"
          width={width}
          layout={layout}
          compactor={dropFirstCompactor}
          onDragStart={(_layout, item) => setMovingId(item.i)}
          onResizeStart={(_layout, item) => setMovingId(item.i)}
          onDragStop={finishMove}
          onResizeStop={finishMove}
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
            // On a page turn the board slides in whole, without the cards'
            // own staggered entrance.
            return (
              <div
                key={item.i}
                className={turn ? undefined : 'animate-card-enter'}
                style={turn ? undefined : { animationDelay: `${i * 0.06}s` }}
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
      </div>
    )
  }

  // The container is rendered from the first paint, loading included:
  // useContainerWidth measures it once, on mount, and a container that
  // appeared only after loading was never measured (the grid kept the hook's
  // 1280 px default and overflowed narrower windows).
  //
  // While editing, the board recedes (index.css), except during a drag in
  // from the library, when it must be at full size to drop onto.
  return (
    <div
      ref={containerRef}
      className="board-recede"
      data-recede={!locked && !stacked && draggingCardId === null}
      style={{ '--drop-color': cardAccent(previewCard?.source) }}
    >
      <div ref={pageRef}>{content}</div>
    </div>
  )
}
