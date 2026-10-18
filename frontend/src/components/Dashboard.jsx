import { useState, useEffect, useCallback, useRef } from 'react'
import { GridLayout, useContainerWidth } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { fetchCards, updateCard } from '../api'
import Card, { DRAG_HANDLE_CLASS } from './Card'
import LoadingDots from './LoadingDots'

// Cards sit MARGIN px apart. Each draws a 1 px outline just outside its box
// (Card.jsx), so the grid keeps OUTLINE px clear around its edge for it.
const ROW_HEIGHT = 46
const MARGIN = 8
const OUTLINE = 1

// Below this container width the grid's columns get too narrow to read, so
// the cards stack in one column instead, in grid order, without dragging.
// It matches Tailwind's `md` breakpoint less the page padding (App.jsx), where
// the header hides the customize button.
export const STACK_BELOW = 728

/** A card's stacked height: the height its grid rows would give it. */
function stackedHeight(h) {
  return h * ROW_HEIGHT + (h - 1) * MARGIN
}

function buildLayout(cards) {
  return cards.map((card, i) => ({
    i: String(card.id),
    x: card.layout?.x ?? (i % 2) * 6,
    y: card.layout?.y ?? Math.floor(i / 2) * 4,
    w: card.layout?.w ?? 6,
    h: card.layout?.h ?? 4,
    minW: 2,
    minH: 2,
  }))
}

export default function Dashboard({ locked }) {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const saveTimer = useRef(null)
  const { width, containerRef, mounted } = useContainerWidth()

  useEffect(() => {
    fetchCards()
      .then(setCards)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // The debounced save is a pending write to the API. Without this, unmounting
  // inside the window still fires it and then sets state on a dead component.
  useEffect(() => () => clearTimeout(saveTimer.current), [])

  const handleLayoutChange = useCallback(
    (newLayout) => {
      // Layout events the grid emits on its own (mount-time compaction,
      // resize) are persisted too. That keeps storage matching what is on
      // screen; the unchanged-layout check below keeps it to a no-op when
      // compaction changes nothing.
      if (locked) return

      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        newLayout.forEach((item) => {
          const card = cards.find((c) => String(c.id) === item.i)
          if (!card) return
          const prev = card.layout || {}
          if (
            prev.x === item.x &&
            prev.y === item.y &&
            prev.w === item.w &&
            prev.h === item.h
          )
            return
          updateCard(card.id, {
            layout: { x: item.x, y: item.y, w: item.w, h: item.h },
          }).catch((err) => {
            // Not fatal: the board still shows the new arrangement, it just
            // did not persist. Surfaced rather than swallowed (LOG-3).
            console.error('Failed to save card layout', err)
          })
        })
        setCards((prev) =>
          prev.map((card) => {
            const item = newLayout.find((l) => l.i === String(card.id))
            if (!item) return card
            return {
              ...card,
              layout: { x: item.x, y: item.y, w: item.w, h: item.h },
            }
          }),
        )
      }, 500)
    },
    [locked, cards],
  )

  const layout = buildLayout(cards)
  const stacked = width < STACK_BELOW

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
      <div className="flex flex-col" style={{ gap: MARGIN, padding: OUTLINE }}>
        {inGridOrder.map((item) => (
          <div key={item.i} style={{ height: stackedHeight(item.h) }}>
            <Card card={cards.find((c) => String(c.id) === item.i)} locked />
          </div>
        ))}
      </div>
    )
  } else if (mounted) {
    content = (
      <GridLayout
        width={width}
        layout={layout}
        onLayoutChange={handleLayoutChange}
        gridConfig={{
          cols: 12,
          rowHeight: ROW_HEIGHT,
          margin: [MARGIN, MARGIN],
          containerPadding: [OUTLINE, OUTLINE],
        }}
        dragConfig={{ enabled: !locked, handle: `.${DRAG_HANDLE_CLASS}` }}
        resizeConfig={{ enabled: !locked }}
      >
        {cards.map((card, i) => (
          <div
            key={String(card.id)}
            className="animate-card-enter"
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <Card card={card} locked={locked} />
          </div>
        ))}
      </GridLayout>
    )
  }

  // The container is rendered from the first paint, loading included:
  // useContainerWidth measures it once, on mount, and a container that
  // appeared only after loading was never measured (the grid kept the hook's
  // 1280 px default and overflowed narrower windows).
  return <div ref={containerRef}>{content}</div>
}
