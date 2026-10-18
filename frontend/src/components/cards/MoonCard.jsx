import { useEffect, useId, useState } from 'react'

/** The mean length of a lunar month, new moon to new moon, in days. */
export const SYNODIC_DAYS = 29.530588853
// A known new moon: 6 January 2000, 18:14 UTC.
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14)
const DAY = 86_400_000
const STRIP_DAYS = 14

/**
 * The moon's age at `date`: days since the last new moon. Worked out from
 * the mean lunar month, so a phase can be off by up to about a day; the card
 * says "about" where that shows.
 */
export function moonAge(date) {
  const days = (date.getTime() - KNOWN_NEW_MOON) / DAY
  return ((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS
}

/** How much of the moon is lit, from 0 (new) to 1 (full). */
export function litFraction(age) {
  return (1 - Math.cos((2 * Math.PI * age) / SYNODIC_DAYS)) / 2
}

/**
 * The phase's name. The four principal phases are moments, so each names the
 * moon only while it looks like it (new or full within 3% lit, a quarter
 * within 7% of half lit, about 18 hours either side); the rest of the time
 * it is between them.
 */
export function phaseName(age) {
  const lit = litFraction(age)
  const waxing = age < SYNODIC_DAYS / 2
  if (lit < 0.03) return 'New moon'
  if (lit > 0.97) return 'Full moon'
  if (Math.abs(lit - 0.5) < 0.07)
    return waxing ? 'First quarter' : 'Last quarter'
  const shape = lit < 0.5 ? 'crescent' : 'gibbous'
  return `${waxing ? 'Waxing' : 'Waning'} ${shape}`
}

/** The full moon nearest ahead of `date`, or earlier the same night. */
export function nextFullMoon(date) {
  let days = SYNODIC_DAYS / 2 - moonAge(date)
  if (days < -0.5) days += SYNODIC_DAYS
  return new Date(date.getTime() + days * DAY)
}

const sameDay = (a, b) => a.toDateString() === b.toDateString()
const shortDate = (date) =>
  date.toLocaleDateString([], { month: 'short', day: 'numeric' })

/**
 * The moon at `age`, as seen from the northern hemisphere (waxing lit on the
 * right): a shaded disc clipped to its lit part, which is an outer
 * half-circle closed by the elliptical edge of the shadow.
 */
function MoonDisc({ age, className }) {
  const id = useId()
  // Drawn in a 100-unit box; the class sets its size on screen.
  const r = 49
  const c = 50
  const phase = age / SYNODIC_DAYS
  const waxing = phase < 0.5
  const k = Math.cos(2 * Math.PI * phase) // 1 at new moon, -1 at full
  const edge = Math.abs(k) * r
  const outerSweep = waxing ? 1 : 0
  const innerSweep = (waxing ? k > 0 : k < 0) ? 0 : 1
  const lit = `M ${c} ${c - r} A ${r} ${r} 0 0 ${outerSweep} ${c} ${c + r} A ${edge} ${r} 0 0 ${innerSweep} ${c} ${c - r} Z`

  return (
    <svg viewBox="0 0 100 100" aria-hidden className={`shrink-0 ${className}`}>
      <defs>
        <radialGradient id={`${id}shade`} cx="40%" cy="38%" r="70%">
          <stop offset="0" stopColor="#f1efe9" />
          <stop offset="0.7" stopColor="#c9c6be" />
          <stop offset="1" stopColor="#9c9890" />
        </radialGradient>
        <clipPath id={`${id}lit`}>
          <path d={lit} />
        </clipPath>
      </defs>
      <circle cx={c} cy={c} r={r} fill="#1c1e22" />
      <g clipPath={`url(#${id}lit)`}>
        <circle cx={c} cy={c} r={r} fill={`url(#${id}shade)`} />
        {/* A few maria, faint, so it reads as the moon at any size. */}
        <g fill="#000" fillOpacity="0.08">
          <circle cx={c - r * 0.3} cy={c - r * 0.25} r={r * 0.16} />
          <circle cx={c + r * 0.25} cy={c + r * 0.2} r={r * 0.22} />
          <circle cx={c + r * 0.05} cy={c - r * 0.45} r={r * 0.09} />
        </g>
      </g>
    </svg>
  )
}

/**
 * Tonight's moon, worked out from the date with no API: the phase, how much
 * is lit, when it is next full, and the next two weeks, the full moon among
 * them marked. Updates every hour.
 */
export default function MoonCard({ onNote }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 60_000)
    return () => clearInterval(id)
  }, [])

  const age = moonAge(now)
  const percent = Math.round(litFraction(age) * 100)
  const full = nextFullMoon(now)
  // Each day of the strip at local noon, stepped by calendar day, so a
  // daylight-saving change can neither repeat a date nor skip one.
  const days = Array.from({ length: STRIP_DAYS }, (_, i) => {
    const day = new Date(now)
    day.setHours(12, 0, 0, 0)
    day.setDate(day.getDate() + i)
    return day
  })

  useEffect(() => {
    onNote?.(`${percent}% lit`)
  }, [onNote, percent])

  return (
    <div className="@container h-full flex flex-col justify-between gap-3">
      <div className="flex items-center gap-4">
        <MoonDisc age={age} className="size-16 @lg:size-30" />
        <div className="min-w-0">
          <p className="text-[22px] @lg:text-[28px] font-medium leading-tight">
            {phaseName(age)}
          </p>
          <p className="mt-1 text-[13px] text-text-secondary">
            {percent}% lit ·{' '}
            {sameDay(full, now)
              ? 'full moon tonight'
              : `full moon about ${shortDate(full)}`}
          </p>
        </div>
      </div>
      <ol className="flex justify-between" aria-label="The next two weeks">
        {days.map((day, i) => {
          const isFull = sameDay(day, full)
          return (
            <li
              key={i}
              data-full={isFull || undefined}
              aria-current={i === 0 ? 'date' : undefined}
              aria-label={`${i === 0 ? 'Today, ' : ''}${shortDate(day)}${isFull ? ', full moon' : ''}`}
              className={`flex flex-1 flex-col items-center gap-1 py-1 font-mono text-[10px] ${
                i === 0
                  ? 'text-text-primary shadow-[inset_0_-2px_0_var(--color-text-muted)]'
                  : 'text-text-muted'
              }`}
            >
              <span
                className={`rounded-full p-0.5 ${isFull ? 'shadow-[0_0_0_1.5px_var(--color-card-moon)]' : ''}`}
              >
                <MoonDisc
                  age={moonAge(day)}
                  className="block size-[18px] @lg:size-[26px]"
                />
              </span>
              <span className={isFull ? 'font-medium text-card-moon' : ''}>
                {day.getDate()}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
