import { useState, useEffect } from 'react'
import { fetchCardData } from '../api'
import WeatherCard from './cards/WeatherCard'
import QuoteCard from './cards/QuoteCard'
import SpaceCard from './cards/SpaceCard'
import PlaceholderCard from './cards/PlaceholderCard'
import TodoCard from './cards/TodoCard'
import LoadingDots from './LoadingDots'

/**
 * Class marking the drag target within a card.
 *
 * Dashboard hands react-grid-layout the matching selector. Defined once
 * because the two must agree: if they drift, dragging silently stops working
 * with no error anywhere.
 */
export const DRAG_HANDLE_CLASS = 'card-drag-handle'

const CARD_REGISTRY = {
  weather: { component: WeatherCard, accent: 'card-weather', needsData: true },
  quote: { component: QuoteCard, accent: 'card-quote', needsData: true },
  space: { component: SpaceCard, accent: 'card-space', needsData: true },
  placeholder: {
    component: PlaceholderCard,
    accent: 'card-placeholder',
    needsData: false,
  },
  todo: { component: TodoCard, accent: 'card-todo', needsData: false },
}

export default function Card({ card, locked }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const entry = CARD_REGISTRY[card.source] || CARD_REGISTRY.placeholder
  const configKey = JSON.stringify(card.config || {})

  useEffect(() => {
    if (!entry.needsData) {
      setError(null)
      setLoading(false)
      return
    }
    // Reset per-fetch state, or a card that errored once keeps showing that
    // error even after a later fetch succeeds.
    setLoading(true)
    setError(null)

    // Guard against an earlier request resolving after a later one and
    // overwriting fresher data.
    let current = true
    fetchCardData(card.source, card.config || {})
      .then((result) => {
        if (current) setData(result)
      })
      .catch((err) => {
        if (current) setError(err.message)
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [card.source, entry.needsData, configKey])

  const CardContent = entry.component
  const accent = `var(--color-${entry.accent})`
  const accent2 = `var(--color-${entry.accent}-2, ${accent})`

  return (
    <div
      className="group relative h-full rounded-sm bg-surface-raised/90 border border-border-subtle overflow-hidden transition-all duration-300 hover:border-transparent hover:-translate-y-0.5"
      style={{
        '--a': accent,
        '--b': accent2,
        boxShadow: '0 1px 0 0 rgba(255,255,255,0.03) inset',
      }}
    >
      {/* Top accent bar */}
      <div
        className="absolute inset-x-0 top-0 h-[3px] opacity-80 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'linear-gradient(90deg, var(--a), var(--b))' }}
      />
      {/* Corner glow, intensifies on hover */}
      <div
        className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full blur-3xl opacity-15 transition-opacity duration-300 group-hover:opacity-35"
        style={{
          background: 'radial-gradient(circle, var(--b), transparent 70%)',
        }}
      />
      {/* Hover ring glow */}
      <div
        className="pointer-events-none absolute inset-0 rounded-sm opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          boxShadow:
            '0 0 0 1px color-mix(in oklab, var(--a) 40%, transparent), 0 18px 40px -20px color-mix(in oklab, var(--b) 55%, transparent)',
        }}
      />

      <div className="relative p-5 h-full flex flex-col">
        <div
          className={`flex items-center gap-3 mb-4 ${!locked ? `${DRAG_HANDLE_CLASS} cursor-grab active:cursor-grabbing` : ''}`}
        >
          <span
            className="grid place-items-center h-9 w-9 shrink-0 rounded-sm text-lg ring-1"
            style={{
              background:
                'linear-gradient(135deg, color-mix(in oklab, var(--a) 22%, transparent), color-mix(in oklab, var(--b) 14%, transparent))',
              '--tw-ring-color':
                'color-mix(in oklab, var(--a) 30%, transparent)',
            }}
          >
            {card.icon}
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-bold text-text-primary leading-tight truncate">
              {card.title}
            </h2>
            <p className="text-xs text-text-muted mt-0.5 truncate">
              {card.description}
            </p>
          </div>
          {!locked && (
            <span
              className="text-text-muted text-xs select-none"
              title="Drag to move"
            >
              ⠿
            </span>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-auto card-scroll">
          {loading ? (
            <LoadingDots label="Loading card data" className="py-8" />
          ) : error ? (
            <p className="text-sm text-red-400/80 py-4">{error}</p>
          ) : (
            <CardContent data={data} card={card} />
          )}
        </div>
      </div>
    </div>
  )
}
