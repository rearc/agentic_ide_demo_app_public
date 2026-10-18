import { CheckIcon, SquaresFourIcon } from '@phosphor-icons/react'

/**
 * Turns editing on and off. "Edit board" unlocks the cards (App also opens
 * the library); "Done" locks them and closes the library. The two labels
 * share one cell and cross-fade (index.css), so the button keeps its width.
 * Below `sm` it shows its icon only.
 */
export default function EditButton({ editing, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={editing}
      aria-label={editing ? 'Done' : 'Edit board'}
      className={`inline-flex shrink-0 items-center justify-center min-h-9 min-w-9 px-2.5 sm:px-3.5 text-[13px] font-medium border transition-colors ${
        editing
          ? 'bg-text-primary border-text-primary text-surface hover:bg-text-primary/90'
          : 'bg-panel border-hairline-strong text-text-primary hover:border-text-muted'
      }`}
    >
      <span aria-hidden className="label-swap" data-on={editing}>
        <span className="inline-flex items-center gap-2">
          <SquaresFourIcon size={16} />
          <span className="hidden sm:inline">Edit board</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <CheckIcon size={16} />
          <span className="hidden sm:inline">Done</span>
        </span>
      </span>
    </button>
  )
}
