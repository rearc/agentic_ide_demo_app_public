import { useEffect, useRef, useState } from 'react'
import {
  CaretLeftIcon,
  CaretRightIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XIcon,
} from '@phosphor-icons/react'
import Icon from './Icon'
import { cardAccent } from './Card'

// The tiles' reveal is staggered (index.css); past this many it stops
// growing, so a large library still opens quickly.
const MAX_STAGGER = 10

/** `text` with the first match of `needle` underlined in `accent`. */
function Highlighted({ text, needle, accent }) {
  const at = needle ? text.toLowerCase().indexOf(needle) : -1
  if (at < 0) return text
  return (
    <>
      {text.slice(0, at)}
      <mark
        className="bg-transparent text-inherit underline decoration-2 underline-offset-[3px]"
        style={{ textDecorationColor: accent }}
      >
        {text.slice(at, at + needle.length)}
      </mark>
      {text.slice(at + needle.length)}
    </>
  )
}

/**
 * One library card: its title and description. A card not on the board can
 * be dragged onto the grid or added with its "+"; one already there is
 * dimmed and checked.
 */
function Tile({ card, onBoard, needle, order, onAdd, onDragStart, onDragEnd }) {
  const accent = cardAccent(card.source)

  function handleDragStart(e) {
    // Firefox starts no drag without data.
    e.dataTransfer.setData('text/plain', String(card.id))
    onDragStart(card.id)
  }

  return (
    <li
      draggable={!onBoard}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      title={card.description || undefined}
      className={`library-reveal relative flex items-center gap-2.5 min-w-0 pl-4 pr-2 bg-panel shadow-[0_0_0_1px_var(--color-hairline)] ${
        onBoard
          ? ''
          : 'cursor-grab active:cursor-grabbing hover:shadow-[0_0_0_1px_var(--color-hairline-strong)]'
      }`}
      style={{ '--i': Math.min(order, MAX_STAGGER) }}
    >
      {accent && (
        <span
          aria-hidden
          data-card-tab
          className={`absolute left-0 top-0 h-full w-1.5 ${onBoard ? 'opacity-45' : ''}`}
          style={{ background: accent }}
        />
      )}
      <Icon
        name={card.icon}
        className={`shrink-0 text-text-secondary ${onBoard ? 'opacity-45' : ''}`}
        style={{ color: accent }}
      />
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[13px] font-semibold leading-snug ${onBoard ? 'text-text-secondary' : ''}`}
        >
          <Highlighted text={card.title} needle={needle} accent={accent} />
        </span>
        {card.description && (
          <span className="block truncate text-[11.5px] leading-snug text-text-secondary">
            <Highlighted
              text={card.description}
              needle={needle}
              accent={accent}
            />
          </span>
        )}
      </span>
      {onBoard ? (
        <span
          className="grid place-items-center shrink-0 w-[30px] h-[30px] text-text-muted"
          title="On board"
        >
          <CheckIcon size={15} aria-hidden />
          <span className="sr-only">On board</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onAdd(card.id)}
          aria-label={`Add "${card.title}"`}
          className="grid place-items-center shrink-0 w-[30px] h-[30px] border border-hairline-strong text-text-primary hover:border-text-muted transition-colors"
        >
          <PlusIcon size={15} aria-hidden />
        </button>
      )}
    </li>
  )
}

/**
 * A sideways scroller with fades and arrow buttons at whichever edge has
 * more to show, and a plain mouse wheel that moves it sideways.
 */
function Shelf({ children }) {
  const scrollerRef = useRef(null)
  const [more, setMore] = useState({ left: false, right: false })

  useEffect(() => {
    const scroller = scrollerRef.current
    function measure() {
      const max = scroller.scrollWidth - scroller.clientWidth
      setMore({
        left: scroller.scrollLeft > 4,
        right: scroller.scrollLeft < max - 4,
      })
    }
    // A wheel that only scrolls up and down would do nothing here.
    // Non-passive, so the page does not scroll as well.
    function onWheel(e) {
      const sideways = scroller.scrollWidth > scroller.clientWidth
      if (sideways && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault()
        scroller.scrollLeft += e.deltaY
      }
    }
    measure()
    scroller.addEventListener('scroll', measure)
    scroller.addEventListener('wheel', onWheel, { passive: false })
    const resized = window.ResizeObserver && new ResizeObserver(measure)
    resized?.observe(scroller)
    resized?.observe(scroller.firstElementChild)
    return () => {
      scroller.removeEventListener('scroll', measure)
      scroller.removeEventListener('wheel', onWheel)
      resized?.disconnect()
    }
  }, [])

  function page(direction) {
    const scroller = scrollerRef.current
    scroller.scrollBy({
      left: direction * scroller.clientWidth * 0.8,
      behavior: 'smooth',
    })
  }

  const edge = (side, shown, direction, label, ArrowIcon) => (
    <div
      className={`absolute top-0 bottom-2 ${side} w-14 flex items-center pointer-events-none transition-opacity ${
        side === 'left-0'
          ? 'justify-start bg-linear-to-r'
          : 'justify-end bg-linear-to-l'
      } from-surface from-30% to-transparent ${shown ? 'opacity-100' : 'opacity-0'}`}
    >
      <button
        type="button"
        onClick={() => page(direction)}
        aria-label={label}
        tabIndex={shown ? 0 : -1}
        className={`grid place-items-center w-7 h-7 bg-panel border border-hairline-strong text-text-primary hover:border-text-muted ${shown ? 'pointer-events-auto' : ''}`}
      >
        <ArrowIcon size={14} aria-hidden />
      </button>
    </div>
  )

  return (
    <div className="relative flex-1 min-w-0">
      {/* The padding leaves room for the tiles' 1 px outline and the
          scrollbar. */}
      <div
        ref={scrollerRef}
        className="overflow-x-auto card-scroll px-px pt-px pb-2"
      >
        {children}
      </div>
      {edge('left-0', more.left, -1, 'Scroll the library left', CaretLeftIcon)}
      {edge(
        'right-0',
        more.right,
        1,
        'Scroll the library right',
        CaretRightIcon,
      )}
    </div>
  )
}

/**
 * The card library, under the header's row: a search field, a count and an
 * "All / To add" switch, and every card as a tile on a two-row shelf that
 * scrolls sideways. Cards already on the board go last. It stays mounted so
 * it can animate open and closed (index.css); closed, it is inert and hidden
 * from assistive technology.
 */
export default function LibraryDrawer({
  id,
  open,
  cards,
  board,
  onAdd,
  onDragStart,
  onDragEnd,
}) {
  const [query, setQuery] = useState('')
  const [toAddOnly, setToAddOnly] = useState(false)

  const needle = query.trim().toLowerCase()
  const isOnBoard = (card) => Boolean(board[card.id]) && !board[card.id].hidden
  const onBoardCount = cards.filter(isOnBoard).length
  // Array.prototype.sort is stable, so each group keeps library order.
  const shown = cards
    .filter((card) =>
      `${card.title} ${card.description ?? ''}`.toLowerCase().includes(needle),
    )
    .filter((card) => !toAddOnly || !isOnBoard(card))
    .sort((a, b) => isOnBoard(a) - isOnBoard(b))

  const filtering = needle !== '' || toAddOnly
  let empty = null
  if (cards.length === 0) empty = 'The library is empty.'
  else if (needle && shown.length === 0)
    empty = `No cards match "${query.trim()}".`
  else if (shown.length === 0) empty = 'Every card is on the board.'

  return (
    <section
      id={id}
      aria-label="Card library"
      aria-hidden={!open}
      // React 18 sets `inert` only as a string attribute.
      inert={open ? undefined : ''}
      data-open={open}
      className="library-drawer"
    >
      <div className="min-h-0 overflow-hidden">
        <div className="library-drawer-row border-t border-hairline">
          <div className="max-w-[1600px] mx-auto px-5 py-3 flex flex-col sm:flex-row sm:items-start gap-3">
            <div
              className="library-reveal flex flex-col gap-2 shrink-0 sm:w-52"
              style={{ '--i': 0 }}
            >
              <label className="relative flex items-center">
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
                  className="library-search w-full h-8 pl-8 pr-8 bg-transparent border border-hairline text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-muted transition-colors"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                    className="absolute right-1 grid place-items-center w-6 h-6 text-text-muted hover:text-text-primary"
                  >
                    <XIcon size={13} aria-hidden />
                  </button>
                )}
              </label>
              <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                <span
                  className="font-mono text-[11px] text-text-muted"
                  aria-live="polite"
                >
                  {filtering
                    ? `${shown.length} of ${cards.length}`
                    : `${cards.length} · ${onBoardCount} on board`}
                </span>
                <div className="inline-flex border border-hairline text-[11px] font-medium">
                  {[
                    ['All', false],
                    ['To add', true],
                  ].map(([label, value]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setToAddOnly(value)}
                      aria-pressed={toAddOnly === value}
                      className={`px-2 py-0.5 transition-colors ${
                        toAddOnly === value
                          ? 'bg-hairline-strong text-text-primary'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {empty ? (
              <p className="text-[13px] text-text-secondary sm:py-1.5">
                {empty}
              </p>
            ) : (
              <Shelf>
                <ul className="grid grid-flow-col grid-rows-[repeat(2,48px)] auto-cols-[232px] gap-x-2 gap-y-1.5">
                  {shown.map((card, i) => (
                    <Tile
                      key={card.id}
                      card={card}
                      onBoard={isOnBoard(card)}
                      needle={needle}
                      order={i + 1}
                      onAdd={onAdd}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                    />
                  ))}
                </ul>
              </Shelf>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
