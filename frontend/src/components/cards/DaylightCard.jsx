import { useEffect, useState } from 'react'

const MINUTE = 60_000

const DAY_SECONDS = 86_400

/** "07:16": the instant `ms` on a 24-hour clock in `timeZone`. */
function clock(ms, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(ms)
}

function duration(ms) {
  const minutes = Math.round(ms / MINUTE)
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

/** "2m 11s shorter", "longer", or "same as yesterday". */
function change(seconds) {
  if (seconds === 0) return 'same as yesterday'
  const size = Math.abs(seconds)
  return `${Math.floor(size / 60)}m ${size % 60}s ${seconds < 0 ? 'shorter' : 'longer'}`
}

/**
 * Where the day stands at `now` (ms): the fraction of daylight gone (null
 * when the sun is down), and the big figure with its label. The service
 * sends its times as instants (Unix seconds), so a countdown that crosses a
 * daylight-saving change is still right.
 */
export function daylightNow(data, now) {
  const rise = data.sunrise * 1000
  const set = data.sunset * 1000
  const next = data.tomorrow_sunrise * 1000
  if (now >= next) {
    // Open past the next sunrise: these are yesterday's times. The card is
    // fetched when it loads, so a reload refreshes it.
    return { fraction: null, stale: true }
  }
  // Inside the polar circles the sun can stay up, or down, all day.
  if (data.daylight_seconds >= DAY_SECONDS) {
    return { fraction: null, polar: 'The sun does not set today' }
  }
  if (data.daylight_seconds === 0) {
    return { fraction: null, polar: 'The sun does not rise today' }
  }
  if (now < rise) {
    return { fraction: null, figure: duration(rise - now), label: 'to sunrise' }
  }
  if (now <= set) {
    return {
      fraction: (now - rise) / (set - rise),
      figure: duration(set - now),
      label: 'of light left',
    }
  }
  return { fraction: null, figure: duration(next - now), label: 'to sunrise' }
}

/**
 * The day's arc over a horizon, drawn in a 400 by 70 box that scales with
 * the card. The part already travelled is in the card's colour, with the
 * sun at its end; at night the arc is dashed and the sun waits at sunrise.
 */
function SunArc({ fraction }) {
  const left = 8
  const right = 392
  const base = 66
  const rx = (right - left) / 2
  const ry = 56
  const day = fraction !== null
  const angle = Math.PI * (1 - (fraction ?? 0))
  const sunX = 200 + rx * Math.cos(angle)
  const sunY = base - ry * Math.sin(angle)

  return (
    <svg
      viewBox="0 0 400 70"
      preserveAspectRatio="xMidYMax meet"
      className="size-full"
      aria-hidden
    >
      <line
        x1="0"
        y1={base}
        x2="400"
        y2={base}
        className="stroke-hairline-strong"
      />
      <path
        d={`M ${left} ${base} A ${rx} ${ry} 0 0 1 ${right} ${base}`}
        fill="none"
        className="stroke-hairline-strong"
        strokeDasharray={day ? undefined : '3 4'}
      />
      {day && (
        <>
          <path
            d={`M ${left} ${base} A ${rx} ${ry} 0 0 1 ${sunX} ${sunY}`}
            fill="none"
            strokeWidth="2"
            className="stroke-card-daylight"
          />
          <circle
            cx={sunX}
            cy={sunY}
            r="13"
            className="fill-card-daylight"
            opacity="0.18"
          />
        </>
      )}
      <circle
        cx={day ? sunX : left}
        cy={day ? sunY : base}
        r={day ? 7 : 5}
        strokeWidth="1.5"
        className={
          day ? 'fill-card-daylight' : 'fill-surface stroke-card-daylight'
        }
      />
    </svg>
  )
}

/**
 * Sunrise, sunset and the light left today, for the card's city. Times are
 * shown in the city's own time zone, so a card for another city shows that
 * city's day wherever it is viewed. It
 * re-renders every minute; its data is fetched when it loads.
 */
export default function DaylightCard({ data }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), MINUTE)
    return () => clearInterval(id)
  }, [])

  if (!data) return null

  if (data.fallback) {
    return (
      <div className="h-full flex items-center justify-center text-center">
        <p className="text-sm text-text-secondary">{data.description}</p>
      </div>
    )
  }

  const status = daylightNow(data, now)
  const zone = data.timezone
  const polar = Boolean(status.polar)

  let headline
  if (status.stale) {
    headline = (
      <p className="text-sm text-text-secondary">
        These are yesterday&apos;s times. Reload for today&apos;s.
      </p>
    )
  } else if (polar) {
    headline = <p className="text-xl font-light">{status.polar}</p>
  } else {
    headline = (
      <p className="text-[34px] @lg:text-5xl font-light leading-none tracking-tight tabular-nums">
        {status.figure}
        <span className="ml-1.5 text-sm font-normal tracking-normal text-text-secondary">
          {status.label}
        </span>
      </p>
    )
  }

  return (
    <div className="@container h-full flex flex-col gap-2">
      <div>
        {headline}
        <p className="mt-1.5 text-[13px] text-text-muted">
          {data.city} · now {clock(now, zone)}
        </p>
      </div>
      {/* Takes the height left and keeps its shape, sitting on the times. */}
      <div className="flex-1 min-h-8">
        <SunArc fraction={status.fraction} />
      </div>
      <p className="flex gap-x-3.5 whitespace-nowrap font-mono text-xs text-text-secondary">
        {!polar && (
          <>
            <span>
              <span aria-hidden>↑</span>
              <span className="sr-only">Sunrise</span>{' '}
              <span className="text-text-primary">
                {clock(data.sunrise * 1000, zone)}
              </span>
            </span>
            <span>
              <span aria-hidden>↓</span>
              <span className="sr-only">Sunset</span>{' '}
              <span className="text-text-primary">
                {clock(data.sunset * 1000, zone)}
              </span>
            </span>
          </>
        )}
        <span
          className="truncate"
          title="Day length, and the change from yesterday"
        >
          <span className="text-text-primary">
            {duration(data.daylight_seconds * 1000)}
          </span>
          {/* On a narrow card the change from yesterday is left to screen
              readers, so the times beside it stay whole. */}
          <span className="sr-only @xs:not-sr-only">
            {' '}
            · {change(data.change_seconds)}
          </span>
        </span>
      </p>
    </div>
  )
}
