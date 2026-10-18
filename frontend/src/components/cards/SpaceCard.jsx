import { ArrowUpRightIcon, PlayIcon } from '@phosphor-icons/react'

import CardFooter from '../CardFooter'

/** The APOD page for a date: 2026-10-18 is apod.nasa.gov/apod/ap261018.html. */
function apodPage(date) {
  return `https://apod.nasa.gov/apod/ap${date.slice(2).replaceAll('-', '')}.html`
}

export default function SpaceCard({ data }) {
  if (!data) return null

  if (data.fallback) {
    return (
      <div className="h-full flex items-center justify-center text-center">
        <p className="text-sm text-text-secondary">{data.explanation}</p>
      </div>
    )
  }

  const isImage = data.url && data.media_type === 'image'
  const isVideo = data.url && data.media_type === 'video'

  return (
    <div className="h-full flex flex-col gap-3">
      {isImage && (
        // Full-bleed: the photo runs to the card's edges, its title over it.
        <div className="relative -mx-4 -mt-4 flex-1 min-h-32 overflow-hidden">
          <img
            src={data.url}
            alt={data.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-panel to-transparent px-4 pt-10 pb-2">
            <h3 className="text-base font-semibold">{data.title}</h3>
          </div>
        </div>
      )}
      {isVideo && (
        <a
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-8 border border-hairline-strong text-text-primary hover:bg-surface transition-colors"
        >
          <PlayIcon size={16} aria-hidden /> Watch today&apos;s space video
        </a>
      )}
      {!isImage && <h3 className="text-base font-semibold">{data.title}</h3>}
      <p className="text-[13px] leading-relaxed text-text-secondary line-clamp-3">
        {data.explanation}
      </p>
      {data.date && (
        <CardFooter>
          <span>NASA Astronomy Picture of the Day</span>
          <a
            href={apodPage(data.date)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-text-primary transition-colors"
          >
            {data.date} <ArrowUpRightIcon size={12} aria-hidden />
          </a>
        </CardFooter>
      )}
    </div>
  )
}
