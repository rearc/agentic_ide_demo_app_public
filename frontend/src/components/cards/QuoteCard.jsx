export default function QuoteCard({ data }) {
  if (!data) return null
  return (
    <div className="h-full flex flex-col justify-between">
      <blockquote className="text-lg leading-relaxed">{data.text}</blockquote>
      <div className="mt-4 pt-3 border-t border-hairline flex items-baseline justify-between gap-2 text-xs text-text-secondary">
        <p>
          {data.author}
          {data.fallback && (
            <span className="ml-2 text-fallback">(offline)</span>
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
