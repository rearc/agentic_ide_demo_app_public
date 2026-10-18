import { CardsThreeIcon } from '@phosphor-icons/react'

/**
 * Folds the card library away and back while editing (`controls` is its
 * id). Closed, the header is back to its viewing height, so cards can be
 * sized against the screen they will be seen on. It hides below `md`, where
 * the board stacks its cards (STACK_BELOW in Dashboard.jsx) and nothing can
 * be resized, so there the library simply stays open while editing.
 */
export default function LibraryButton({ open, onToggle, controls }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      className={`hidden md:inline-flex shrink-0 items-center justify-center gap-2 min-h-9 px-3.5 text-[13px] font-medium border transition-colors ${
        open
          ? 'bg-hairline-strong border-text-muted text-text-primary'
          : 'bg-panel border-hairline-strong text-text-secondary hover:text-text-primary hover:border-text-muted'
      }`}
    >
      <CardsThreeIcon size={16} aria-hidden />
      Library
    </button>
  )
}
