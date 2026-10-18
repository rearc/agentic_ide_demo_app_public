import CardFooter from '../CardFooter'

export default function QuoteCard({ data }) {
  if (!data) return null
  return (
    <div className="h-full flex flex-col gap-3">
      <blockquote className="text-lg leading-relaxed">{data.text}</blockquote>
      <p className="text-[13px] text-text-secondary">{data.author}</p>
      <CardFooter>
        {data.fallback ? (
          <span>ZenQuotes did not answer: showing a built-in quote</span>
        ) : (
          // ZenQuotes' free tier requires a link back to it.
          <a
            href="https://zenquotes.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-primary transition-colors"
          >
            via ZenQuotes
          </a>
        )}
      </CardFooter>
    </div>
  )
}
