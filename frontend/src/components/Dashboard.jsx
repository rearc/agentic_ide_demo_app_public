import { useState, useEffect, useCallback, useRef } from 'react'
import { GridLayout, useContainerWidth } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { fetchCards, updateCard } from '../api'
import Card, { DRAG_HANDLE_CLASS } from './Card'
import LoadingDots from './LoadingDots'

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

  if (loading) {
    return <LoadingDots label="Loading dashboard" size="md" className="py-24" />
  }

  if (error) {
    return (
      <div className="text-center py-24">
        <p className="text-text-secondary text-lg">Unable to load dashboard</p>
        <p className="text-text-muted text-sm mt-2">{error}</p>
        <p className="text-text-muted text-sm mt-1">
          Make sure the backend is running on port 5001
        </p>
      </div>
    )
  }

  const layout = buildLayout(cards)

  return (
    <div>
      <div ref={containerRef}>
        {mounted && (
          <GridLayout
            width={width}
            layout={layout}
            onLayoutChange={handleLayoutChange}
            gridConfig={{ cols: 12, rowHeight: 40, margin: [16, 16] }}
            dragConfig={{ enabled: !locked, handle: `.${DRAG_HANDLE_CLASS}` }}
            resizeConfig={{ enabled: !locked }}
          >
            {cards.map((card, i) => (
              <div
                key={String(card.id)}
                className="animate-card-enter"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <Card card={card} locked={locked} />
              </div>
            ))}
          </GridLayout>
        )}
      </div>
    </div>
  )
}
