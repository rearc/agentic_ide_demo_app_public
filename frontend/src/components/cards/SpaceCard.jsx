export default function SpaceCard({ data }) {
  if (!data) return null

  if (data.fallback) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <p className="text-sm text-text-secondary">{data.explanation}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {data.url && data.media_type === 'image' ? (
        <div className="relative overflow-hidden ring-1 ring-hairline">
          <img
            src={data.url}
            alt={data.title}
            className="w-full h-48 object-cover transition-transform duration-500 hover:scale-105"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-panel/70 to-transparent" />
        </div>
      ) : data.url && data.media_type === 'video' ? (
        <a
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-10 bg-surface text-text-primary hover:text-text-secondary transition-colors ring-1 ring-hairline"
        >
          <span>▶</span> Watch today&apos;s space video
        </a>
      ) : null}
      <h3 className="text-sm font-semibold">{data.title}</h3>
      <p className="text-xs text-text-secondary leading-relaxed">
        {data.explanation}
      </p>
      {data.date && <p className="text-xs text-text-secondary">{data.date}</p>}
    </div>
  )
}
