import { GRADIENT_TEXT_CLASS } from './gradientText'

export default function QuoteCard({ data }) {
  if (!data) return null
  return (
    <div className="h-full flex flex-col justify-between">
      <blockquote className="relative text-lg italic text-text-primary/90 leading-relaxed font-light pl-1">
        <span
          aria-hidden
          className={`absolute -left-1 -top-6 text-6xl leading-none font-serif opacity-40 select-none ${GRADIENT_TEXT_CLASS}`}
        >
          &ldquo;
        </span>
        <span className="relative">{data.text}</span>
      </blockquote>
      <div className="mt-4 pt-3 border-t border-border-subtle/60 flex items-baseline justify-between gap-2 text-xs text-text-muted">
        <p className="tracking-wide uppercase">
          {data.author}
          {data.fallback && (
            <span className="ml-2 normal-case tracking-normal opacity-50">
              (offline)
            </span>
          )}
        </p>
        {/* ZenQuotes' free tier requires a link back to it. */}
        {!data.fallback && (
          <a
            href="https://zenquotes.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 hover:text-text-secondary transition-colors"
          >
            via ZenQuotes
          </a>
        )}
      </div>
    </div>
  )
}
