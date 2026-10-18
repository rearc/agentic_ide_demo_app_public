import { useEffect, useId, useMemo, useRef } from 'react'

/**
 * AnimatedLabsLockup — the Rearc AI Labs animated horizontal signature.
 *
 * Ported from the Rearc website brand system
 * (website/src/components/elements/lockup/animated-horizontal.tsx +
 * monogram/geometry.ts + monogram/wordmark.tsx), converted from
 * Next.js/TypeScript to a self-contained Vite JSX component.
 *
 * Arrangement: the `rearc` wordmark · a hairline divider · the animated
 * `[AI] LABS` mark. One requestAnimationFrame loop drives the beat: the gold
 * compass arrow laps the `[AI]` square track, fires staggered dots to each LABS
 * letter; letters snap gold L→A→B→S on landing, the group glows once, drains
 * left→right, and the cycle repeats. Respects `prefers-reduced-motion`.
 */

const MONO_FONT = "'Space Mono', SFMono-Regular, Menlo, monospace"
const WORDMARK_FONT =
  'var(--font-general-sans), var(--font-brand), Arial, sans-serif'
const GOLD = '#F2C729'
const TONE_FG = { navy: '#FFFFFF', cream: '#081229' }

/** Rounded-square track path (viewBox 0 0 100 100, 8..92, corner radius 17). */
const TRACK = (() => {
  const x0 = 8,
    y0 = 8,
    x1 = 92,
    y1 = 92,
    r = 17
  return `M ${x0 + r} ${y0} H ${x1 - r} A ${r} ${r} 0 0 1 ${x1} ${y0 + r} V ${y1 - r} A ${r} ${r} 0 0 1 ${x1 - r} ${y1} H ${x0 + r} A ${r} ${r} 0 0 1 ${x0} ${y1 - r} V ${y0 + r} A ${r} ${r} 0 0 1 ${x0 + r} ${y0} Z`
})()
const RACER_PATH = 'M -3.6 -5 L 4.2 0 L -3.6 5'
const LABS_LETTERS = ['L', 'A', 'B', 'S']

// Timeline (ms). RACE = racer lap; CYCLE = full loop; GLOW/DRAIN = LABS finish.
const RACE = 2000
const CYCLE = 5400
const GLOW = 520
const DRAIN = 680
const PULSE = 230
const SPEED = 0.22 // px/ms — dot flight speed across the wide canvas
const SPAWN_STAGGER = 240 // ms between L→A→B→S dot releases
const KEY_FRAC = 0.331 // path fraction at the middle of the right edge
const VIEW_H = 100
const EXIT = { x: 92, y: 50 }
const H_LETTER_Y = 50

const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
const easeOutQuad = (t) => 1 - (1 - t) * (1 - t)

/** LABS geometry in viewBox units, sized to match wordSize*0.78 px height. */
function labsLayout(markSize, wordSize) {
  const font = (wordSize * 0.78 * VIEW_H) / markSize
  const advance = font * 0.78
  const first = 100 + font * 0.55
  const x = [0, 1, 2, 3].map((i) => first + i * advance)
  const viewW = x[3] + font * 0.7
  return { font, x, viewW }
}

/** The `rearc` wordmark: `re` in foreground ink, `arc` in the accent. */
function Wordmark({ size, fg, accent }) {
  return (
    <span
      style={{
        fontFamily: WORDMARK_FONT,
        fontWeight: 600,
        fontSize: size,
        letterSpacing: '-0.02em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: fg }}>re</span>
      <span style={{ color: accent }}>arc</span>
    </span>
  )
}

export default function AnimatedLabsLockup({
  tone = 'navy',
  markSize = 32,
  wordSize = 26,
  accent = GOLD,
  run = true,
  className,
  style,
  title = 'rearc AI LABS',
}) {
  const fg = TONE_FG[tone]
  const resolvedAccent = accent === 'fg' ? fg : accent
  const uid = useId().replace(/:/g, '')
  const {
    font: letterFont,
    x: letterX,
    viewW,
  } = useMemo(() => labsLayout(markSize, wordSize), [markSize, wordSize])

  const pathRef = useRef(null)
  const markRef = useRef(null)
  const glowRef = useRef(null)
  const dotRefs = useRef([])
  const letterRefs = useRef([])
  const goldGroupRef = useRef(null)
  const drainRef = useRef(null)

  useEffect(() => {
    const path = pathRef.current
    if (!path) return
    const total = path.getTotalLength()

    const placeRacer = (frac, glow) => {
      const L = ((((KEY_FRAC + frac) % 1) + 1) % 1) * total
      const p = path.getPointAtLength(L)
      const p2 = path.getPointAtLength((L + 0.6) % total)
      const ang = (Math.atan2(p2.y - p.y, p2.x - p.x) * 180) / Math.PI
      if (markRef.current) {
        markRef.current.setAttribute(
          'transform',
          `translate(${p.x} ${p.y}) rotate(${ang})`,
        )
      }
      if (glowRef.current) {
        glowRef.current.setAttribute('transform', `translate(${p.x} ${p.y})`)
        glowRef.current.setAttribute('opacity', glow.toFixed(3))
        glowRef.current.setAttribute('r', (3.5 + glow * 6).toFixed(2))
      }
    }

    const spawn = (i) => i * SPAWN_STAGGER
    const dist = (i) => Math.hypot(letterX[i] - EXIT.x, H_LETTER_Y - EXIT.y)
    const travel = (i) => dist(i) / SPEED
    const arrival = (i) => spawn(i) + travel(i)
    const lastArrival = Math.max(...[0, 1, 2, 3].map(arrival))

    const park = () => {
      placeRacer(1, 0.25)
      letterRefs.current.forEach((el) => {
        if (el) el.style.opacity = '0'
      })
      if (drainRef.current) {
        drainRef.current.setAttribute('x', '0')
        drainRef.current.setAttribute('width', String(viewW))
      }
      if (goldGroupRef.current) goldGroupRef.current.style.filter = 'none'
    }

    const reduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!run || reduce) {
      park()
      return
    }

    let raf = 0
    let start = null

    const loop = (ts) => {
      if (start == null) start = ts
      const E = ts - start
      const e = E % CYCLE
      const he = e - RACE

      if (e < RACE) {
        placeRacer(easeInOutCubic(e / RACE), 0)
      } else {
        let glow = 0.06
        for (let i = 0; i < 4; i++) {
          const dt = he - spawn(i)
          if (dt >= 0 && dt < PULSE) {
            glow = Math.max(glow, 0.7 * Math.sin((dt / PULSE) * Math.PI))
          }
        }
        placeRacer(1, glow)
      }

      for (let i = 0; i < 4; i++) {
        const node = dotRefs.current[i]
        if (!node) continue
        const bp = e >= RACE ? (he - spawn(i)) / travel(i) : -1
        if (bp >= 0 && bp < 1) {
          const x = EXIT.x + (letterX[i] - EXIT.x) * easeOutQuad(bp)
          const y = EXIT.y + (H_LETTER_Y - EXIT.y) * easeOutQuad(bp)
          const op = bp < 0.16 ? bp / 0.16 : bp > 0.88 ? (1 - bp) / 0.12 : 1
          node.setAttribute(
            'transform',
            `translate(${x.toFixed(2)} ${y.toFixed(2)})`,
          )
          node.setAttribute('opacity', op.toFixed(3))
          node.setAttribute('r', (1.6 + 0.9 * Math.min(1, bp * 2)).toFixed(2))
        } else {
          node.setAttribute('opacity', '0')
        }
      }

      const landed = (i) => e >= RACE && he >= arrival(i)
      const drainRect = drainRef.current
      const gg = goldGroupRef.current
      const glowFilter = (g) =>
        `drop-shadow(0 0 ${(6 * g + 0.6).toFixed(1)}px rgba(242,199,41,${(0.85 * g).toFixed(2)}))`

      if (e >= RACE) {
        const since = he - lastArrival
        for (let i = 0; i < 4; i++) {
          const el = letterRefs.current[i]
          if (el) el.style.opacity = landed(i) ? '1' : '0'
        }
        if (drainRect) {
          if (since < GLOW) {
            drainRect.setAttribute('x', '0')
            drainRect.setAttribute('width', String(viewW))
            if (gg)
              gg.style.filter = glowFilter(
                Math.sin((Math.max(0, since) / GLOW) * Math.PI),
              )
          } else if (since < GLOW + DRAIN) {
            const dp = (since - GLOW) / DRAIN
            drainRect.setAttribute('x', (dp * viewW).toFixed(1))
            drainRect.setAttribute('width', (viewW - dp * viewW).toFixed(1))
            if (gg) gg.style.filter = 'none'
          } else {
            drainRect.setAttribute('x', String(viewW))
            drainRect.setAttribute('width', '0')
            if (gg) gg.style.filter = 'none'
          }
        }
      } else {
        for (let i = 0; i < 4; i++) {
          const el = letterRefs.current[i]
          if (el) el.style.opacity = '0'
        }
        if (drainRect) {
          drainRect.setAttribute('x', '0')
          drainRect.setAttribute('width', String(viewW))
        }
        if (gg) gg.style.filter = 'none'
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [run, tone, markSize, resolvedAccent, fg, letterX, viewW])

  const svgHeight = markSize
  const svgWidth = (markSize * viewW) / VIEW_H

  return (
    <span
      className={className}
      role="img"
      aria-label={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: wordSize * 0.55,
        ...style,
      }}
    >
      <Wordmark size={wordSize} fg={fg} accent={resolvedAccent} />
      <span
        aria-hidden="true"
        style={{
          width: 1,
          height: wordSize * 1.05,
          background: fg,
          opacity: 0.2,
        }}
      />
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${viewW} ${VIEW_H}`}
        fill="none"
        aria-hidden="true"
        style={{ display: 'block', flexShrink: 0 }}
      >
        <defs>
          <clipPath id={`${uid}-drain`}>
            <rect ref={drainRef} x="0" y="0" width={viewW} height={VIEW_H} />
          </clipPath>
          <filter
            id={`${uid}-blur`}
            x="-300%"
            y="-300%"
            width="700%"
            height="700%"
          >
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
        </defs>
        <path
          ref={pathRef}
          d={TRACK}
          stroke={fg}
          strokeWidth="4.4"
          fill="none"
          strokeLinejoin="round"
          opacity="0.9"
        />
        <text
          x="49"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily={MONO_FONT}
          fontWeight="700"
          fontSize="44"
          letterSpacing="-2"
          fill={fg}
        >
          AI
        </text>
        {/* LABS base (foreground tone, always visible). */}
        {LABS_LETTERS.map((ch, i) => (
          <text
            key={ch}
            x={letterX[i]}
            y={H_LETTER_Y}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={MONO_FONT}
            fontWeight="700"
            fontSize={letterFont}
            fill={fg}
          >
            {ch}
          </text>
        ))}
        {/* LABS gold overlay — snaps per-letter; glow + drain on the group. */}
        <g ref={goldGroupRef} clipPath={`url(#${uid}-drain)`}>
          {LABS_LETTERS.map((ch, i) => (
            <text
              key={ch}
              ref={(el) => {
                letterRefs.current[i] = el
              }}
              x={letterX[i]}
              y={H_LETTER_Y}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily={MONO_FONT}
              fontWeight="700"
              fontSize={letterFont}
              fill={resolvedAccent}
              style={{ opacity: 0 }}
            >
              {ch}
            </text>
          ))}
        </g>
        {/* Racer glow + dots + chevron (parked at right-edge exit for first paint). */}
        <circle
          ref={glowRef}
          r="4"
          fill={resolvedAccent}
          filter={`url(#${uid}-blur)`}
          opacity="0"
        />
        {[0, 1, 2, 3].map((i) => (
          <circle
            key={`dot-${i}`}
            ref={(el) => {
              dotRefs.current[i] = el
            }}
            r="2"
            fill={resolvedAccent}
            opacity="0"
          />
        ))}
        <g
          ref={markRef}
          transform={`translate(${EXIT.x} ${EXIT.y}) rotate(90)`}
        >
          <path
            d={RACER_PATH}
            fill="none"
            stroke={resolvedAccent}
            strokeWidth="3.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </span>
  )
}
