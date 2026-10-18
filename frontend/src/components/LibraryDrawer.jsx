import { useState } from 'react'
import { CheckIcon, MagnifyingGlassIcon, PlusIcon } from '@phosphor-icons/react'
import Icon from './Icon'
import { cardAccent } from './Card'

const TILE =
  'relative shrink-0 flex items-center gap-2.5 h-11 w-56 pl-4 pr-1.5 bg-panel shadow-[0_0_0_1px_var(--color-hairline)]'

/**
 * One library card. A card not on the board can be dragged onto the grid or
 * added with its button; one already there says so.
 */
function Tile({ card, onBoard, onAdd, onDragStart, onDragEnd }) {
  const accent = cardAccent(card.source)

  function handleDragStart(e) {
    // Firefox starts no drag without data.
    e.dataTransfer.setData('text/plain', String(card.id))
    onDragStart(card.id)
  }

  return (
    <li
      draggable={!onBoard}
      onDragStart={onBoard ? undefined : handleDragStart}
      onDragEnd={onBoard ? undefined : onDragEnd}
      className={`${TILE} ${onBoard ? '' : 'cursor-grab active:cursor-grabbing hover:shadow-[0_0_0_1px_var(--color-hairline-strong)]'}`}
    >
      {accent && (
        <span
          aria-hidden
          data-card-tab
          className="absolute left-0 top-0 h-full w-1.5"
          style={{ background: accent }}
        />
      )}
      <Icon
        name={card.icon}
        className="shrink-0 text-text-secondary"
        style={{ color: accent }}
      />
      <span
        className="min-w-0 flex-1 truncate text-sm font-semibold"
        title={card.description || undefined}
      >
        {card.title}
      </span>
      {onBoard ? (
        <span className="inline-flex items-center gap-1 pr-1.5 text-xs text-text-muted">
          <CheckIcon size={14} aria-hidden />
          On board
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onAdd(card.id)}
          aria-label={`Add "${card.title}"`}
          className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium border border-hairline-strong text-text-primary hover:border-text-muted transition-colors"
        >
          <PlusIcon size={14} aria-hidden />
          Add
        </button>
      )}
    </li>
  )
}

/**
 * The card library, opened under the header's row: a search field and every
 * card as a tile, left to right, scrolling sideways when they overflow.
 */
export default function LibraryDrawer({
  id,
  cards,
  board,
  onAdd,
  onDragStart,
  onDragEnd,
}) {
  const [query, setQuery] = useState('')

  const needle = query.trim().toLowerCase()
  const shown = cards.filter((card) =>
    card.title.toLowerCase().includes(needle),
  )

  return (
    <section
      id={id}
      aria-label="Card library"
      className="border-t border-hairline"
    >
      <div className="max-w-[1600px] mx-auto px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="relative flex items-center shrink-0 sm:w-48">
          <MagnifyingGlassIcon
            size={14}
            aria-hidden
            className="absolute left-2.5 text-text-muted pointer-events-none"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search cards"
            placeholder="Search cards"
            className="w-full h-8 pl-8 pr-2.5 bg-transparent border border-hairline text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-muted transition-colors"
          />
        </label>
        {shown.length === 0 ? (
          <p className="text-[13px] text-text-secondary">
            {cards.length === 0
              ? 'The library is empty.'
              : `No cards match "${query.trim()}".`}
          </p>
        ) : (
          // The padding leaves room for the tiles' 1 px outline and the
          // sideways scrollbar; the negative margin keeps it out of the row's
          // spacing.
          <ul className="flex-1 min-w-0 flex gap-2 overflow-x-auto card-scroll px-px py-2 -my-2">
            {shown.map((card) => {
              const entry = board[card.id]
              return (
                <Tile
                  key={card.id}
                  card={card}
                  onBoard={Boolean(entry) && !entry.hidden}
                  onAdd={onAdd}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                />
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
