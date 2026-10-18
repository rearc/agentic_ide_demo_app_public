import { useState, useEffect } from 'react'
import { DotsSixVerticalIcon, XIcon } from '@phosphor-icons/react'
import { fetchCardData } from '../api'
import Icon from './Icon'
import WeatherCard from './cards/WeatherCard'
import QuoteCard from './cards/QuoteCard'
import SpaceCard from './cards/SpaceCard'
import PlaceholderCard from './cards/PlaceholderCard'
import TodoCard from './cards/TodoCard'
import TimerCard from './cards/TimerCard'
import MoonCard from './cards/MoonCard'
import DaylightCard from './cards/DaylightCard'
import IssCard from './cards/IssCard'
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
  timer: { component: TimerCard, accent: 'card-timer', needsData: false },
  moon: { component: MoonCard, accent: 'card-moon', needsData: false },
  daylight: {
    component: DaylightCard,
    accent: 'card-daylight',
    needsData: true,
  },
  iss: { component: IssCard, accent: 'card-iss', needsData: true },
}

/**
 * Shown for a card whose `source` has no entry in CARD_REGISTRY.
 *
 * This registry and the backend's SERVICES agree only through the source
 * string (ADR-008), so when they drift the card says which source is missing
 * rather than passing for the "build something here" placeholder.
 */
function UnregisteredCard({ card }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center">
      <p className="text-sm text-text-secondary">
        No component is registered for source &ldquo;{card.source}&rdquo;.
      </p>
      <p className="text-xs text-text-muted mt-2">
        Add it to CARD_REGISTRY in Card.jsx.
      </p>
    </div>
  )
}

const UNREGISTERED = { component: UnregisteredCard, needsData: false }

/**
 * The colour of the card with this `source`, as a CSS value, or undefined for
 * an unregistered source. Everything drawn in a card's colour (the card, its
 * library tile) reads it here.
 */
export function cardAccent(source) {
  // `accent` names a colour token in index.css (--color-<accent>).
  const accent = CARD_REGISTRY[source]?.accent
  return accent && `var(--color-${accent})`
}

const STATUS = {
  live: { label: 'Live', className: 'text-live' },
  fallback: {
    label: 'Fallback',
    className: 'text-fallback',
    title: 'The service did not answer: showing fallback data',
  },
  error: { label: 'Error', className: 'text-danger' },
}

/** Clock time as 24-hour HH:MM, the same width at every hour. */
function hhmm(date) {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
}

/** A data card's state in its header: live (with when) or why it is not. */
function CardStatus({ status, fetchedAt }) {
  const { label, className, title } = STATUS[status]
  return (
    <>
      {status === 'live' && fetchedAt && (
        <span className="font-mono text-[11px] text-text-muted tabular-nums">
          {hhmm(fetchedAt)}
        </span>
      )}
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-medium ${className}`}
        title={title}
      >
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
        {label}
      </span>
    </>
  )
}

/**
 * One card on the board. While editing (`locked` false) it offers an ×
 * that calls `onRemove`, and, when `movable`, its header becomes the drag
 * handle; the stacked board passes `movable={false}` since it cannot drag.
 */
export default function Card({ card, locked, movable = true, onRemove }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fetchedAt, setFetchedAt] = useState(null)
  // A short note a card's content may put in the header (the todo count).
  const [note, setNote] = useState(null)

  const entry = CARD_REGISTRY[card.source] ?? UNREGISTERED
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
        if (current) {
          setData(result)
          setFetchedAt(new Date())
        }
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
  const accent = cardAccent(card.source)
  const draggable = !locked && movable
  const removable = !locked && Boolean(onRemove)
  let status = null
  if (entry.needsData && !loading) {
    if (error) status = 'error'
    else status = data?.fallback ? 'fallback' : 'live'
  }

  return (
    // The hairline is an outline just outside the box, so the colour tab
    // sits flush with the card's left edge.
    <div className="relative h-full flex flex-col bg-panel shadow-[0_0_0_1px_var(--color-hairline)]">
      {accent && (
        <span
          aria-hidden
          data-card-tab
          className="absolute left-0 top-0 h-11 w-1.5"
          style={{ background: accent }}
        />
      )}
      <div
        className={`flex items-center gap-2.5 h-11 shrink-0 pl-4 border-b border-hairline ${removable ? 'pr-2' : 'pr-4'} ${draggable ? `${DRAG_HANDLE_CLASS} cursor-grab active:cursor-grabbing` : ''}`}
      >
        <Icon
          name={card.icon}
          className="shrink-0 text-text-secondary"
          style={{ color: accent }}
        />
        <h2
          className="min-w-0 truncate text-sm font-semibold"
          title={card.description || undefined}
        >
          {card.title}
        </h2>
        <span className="flex-1" />
        {status && <CardStatus status={status} fetchedAt={fetchedAt} />}
        {note && <span className="text-xs text-text-secondary">{note}</span>}
        {draggable && (
          <span className="text-text-muted" title="Drag to move">
            <DotsSixVerticalIcon size={16} aria-hidden />
          </span>
        )}
        {/* The button's own inset keeps the × on the 16 px edge the header's
            padding gives everything else. */}
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove "${card.title}"`}
            title="Remove from this board"
            className="inline-flex items-center justify-center h-8 w-8 shrink-0 text-text-muted hover:text-text-primary hover:bg-hairline transition-colors"
          >
            <XIcon size={16} aria-hidden />
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-auto card-scroll p-4">
        {loading ? (
          <LoadingDots label="Loading card data" className="py-8" />
        ) : error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : (
          <CardContent data={data} card={card} onNote={setNote} />
        )}
      </div>
    </div>
  )
}
