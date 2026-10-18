import { CardsThreeIcon } from '@phosphor-icons/react'

/** The header's toggle for the card library drawer (`controls` is its id). */
export default function LibraryButton({ open, onToggle, controls }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      // The label hides below `lg` to leave the header's sides room; this
      // keeps the button's name when it does.
      aria-label="Library"
      className={`inline-flex items-center gap-2 min-h-9 min-w-9 justify-center px-2.5 lg:px-3.5 text-[13px] font-medium border transition-colors ${
        open
          ? 'bg-text-primary border-text-primary text-surface hover:bg-text-primary/90'
          : 'bg-panel border-hairline-strong text-text-primary hover:border-text-muted'
      }`}
    >
      <CardsThreeIcon size={16} aria-hidden />
      <span className="hidden lg:inline">Library</span>
    </button>
  )
}
