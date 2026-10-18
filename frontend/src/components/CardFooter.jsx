/**
 * An optional strip along the bottom of a card, for a short note about its
 * data (where it came from, why it is a fallback). Render it last in a card's
 * content; it spans the card's full width.
 */
export default function CardFooter({ children }) {
  return (
    <div className="-mx-4 -mb-4 mt-auto flex justify-between gap-3 border-t border-hairline px-4 py-2 text-xs text-text-muted">
      {children}
    </div>
  )
}
