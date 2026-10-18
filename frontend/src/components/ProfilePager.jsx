import { useEffect } from 'react'
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'

const ARROW =
  'shrink-0 items-center justify-center w-8 h-8 text-text-muted hover:text-text-primary hover:bg-panel transition-colors'

/** Whether a key press belongs to something being typed in. */
function isTyping(target) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

/**
 * Previous and next arrows either side of the profile switcher (`children`),
 * so the profiles turn like pages; the left and right arrow keys do the same
 * when nothing is being typed. `onStep` gets -1 or 1. With one profile there
 * is nothing to turn to, so only the switcher shows.
 */
export default function ProfilePager({ count, onStep, children }) {
  const paging = count > 1

  useEffect(() => {
    if (!paging) return
    function onKeyDown(e) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      if (isTyping(e.target)) return
      if (e.key === 'ArrowLeft') onStep(-1)
      if (e.key === 'ArrowRight') onStep(1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [paging, onStep])

  if (!paging) return children
  // The arrows hide on a phone, where the header has no room for them.
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onStep(-1)}
        aria-label="Previous profile"
        className={`${ARROW} hidden sm:inline-flex`}
      >
        <CaretLeftIcon size={16} aria-hidden />
      </button>
      {children}
      <button
        type="button"
        onClick={() => onStep(1)}
        aria-label="Next profile"
        className={`${ARROW} hidden sm:inline-flex`}
      >
        <CaretRightIcon size={16} aria-hidden />
      </button>
    </div>
  )
}
