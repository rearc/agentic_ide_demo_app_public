import { useEffect, useReducer, useRef, useState } from 'react'
import {
  ArrowCounterClockwiseIcon,
  PauseIcon,
  PlayIcon,
} from '@phosphor-icons/react'

export const PRESETS = [5, 10, 15, 25]
export const POMODORO = { focus: 25, short: 5, long: 15, rounds: 4 }
const MINUTE = 60_000

const PHASE_NAMES = {
  focus: 'Focus',
  short: 'Short break',
  long: 'Long break',
}

function load(state, minutes) {
  return {
    ...state,
    total: minutes * MINUTE,
    left: minutes * MINUTE,
    endsAt: null,
  }
}

function phaseMinutes(phase) {
  return phase === 'focus' ? POMODORO.focus : POMODORO[phase]
}

/** The phase after `phase` in a Pomodoro cycle, and the round it belongs to. */
function nextPhase({ phase, round }) {
  if (phase !== 'focus')
    return { phase: 'focus', round: (round % POMODORO.rounds) + 1 }
  return { phase: round === POMODORO.rounds ? 'long' : 'short', round }
}

export const INITIAL = load(
  { mode: 'timer', minutes: 25, phase: 'focus', round: 1, done: false },
  25,
)

/**
 * Every change to the timer. The running timer stores when it will end, not
 * a count of ticks, so a background tab that slows its timers still shows
 * the right time; `now` comes in with the action so this stays pure.
 */
export function timerReducer(state, action) {
  switch (action.type) {
    case 'start':
      return { ...state, endsAt: action.now + state.left }
    case 'pause':
      return {
        ...state,
        left: Math.max(0, state.endsAt - action.now),
        endsAt: null,
      }
    case 'finish':
      return { ...state, left: 0, endsAt: null, done: true }
    case 'dismiss': {
      // Done is acknowledged: load what comes next, waiting for Start.
      if (state.mode === 'timer')
        return load({ ...state, done: false }, state.minutes)
      const next = nextPhase(state)
      return load({ ...state, ...next, done: false }, phaseMinutes(next.phase))
    }
    case 'reset':
      if (state.mode === 'timer')
        return load({ ...state, done: false }, state.minutes)
      return load(
        { ...state, phase: 'focus', round: 1, done: false },
        POMODORO.focus,
      )
    case 'mode':
      if (action.mode === state.mode) return state
      return timerReducer({ ...state, mode: action.mode }, { type: 'reset' })
    case 'minutes': {
      const minutes = Math.min(180, Math.max(1, action.minutes))
      return load({ ...state, minutes, done: false }, minutes)
    }
    default:
      throw new Error(`Unknown timer action: ${action.type}`)
  }
}

/** A soft two-note chime, made in the browser; silent where audio is unavailable. */
function playChime() {
  try {
    const audio = new AudioContext()
    ;[660, 880].forEach((frequency, i) => {
      const at = audio.currentTime + i * 0.18
      const tone = audio.createOscillator()
      const volume = audio.createGain()
      tone.frequency.value = frequency
      volume.gain.setValueAtTime(0.0001, at)
      volume.gain.exponentialRampToValueAtTime(0.12, at + 0.02)
      volume.gain.exponentialRampToValueAtTime(0.0001, at + 0.5)
      tone.connect(volume).connect(audio.destination)
      tone.start(at)
      tone.stop(at + 0.55)
      // Browsers limit how many audio contexts a page may hold open.
      if (i === 1) tone.onended = () => audio.close()
    })
  } catch (err) {
    console.warn('Could not play the timer chime', err)
  }
}

function formatTime(ms) {
  const seconds = Math.ceil(ms / 1000)
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function doneMessage(state) {
  if (state.mode === 'timer') return 'Time is up'
  const next = nextPhase(state)
  return next.phase === 'focus'
    ? 'Break over, time to focus'
    : `Focus done, take a ${phaseMinutes(next.phase)} minute break`
}

// While the timer flashes, its other controls are disabled and let clicks
// through to the card, so any click there only acknowledges it.
const SMALL_BUTTON =
  'min-h-7 px-1.5 border font-mono text-xs transition-colors disabled:pointer-events-none'

function ModeToggle({ mode, onMode, disabled }) {
  return (
    <div className="inline-flex shrink-0 border border-hairline-strong">
      {[
        ['timer', 'Timer'],
        ['pomodoro', 'Pomodoro'],
      ].map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          disabled={disabled}
          onClick={() => onMode(value)}
          className={`min-h-8 px-2.5 text-xs font-medium transition-colors disabled:pointer-events-none ${
            mode === value
              ? 'bg-text-primary text-surface'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function MinutesPicker({ minutes, onMinutes, disabled }) {
  return (
    <div className="flex flex-wrap gap-1">
      {PRESETS.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={minutes === m}
          aria-label={`${m} minutes`}
          disabled={disabled}
          onClick={() => onMinutes(m)}
          className={`${SMALL_BUTTON} ${
            minutes === m
              ? 'border-text-muted text-text-primary'
              : 'border-hairline text-text-secondary hover:text-text-primary'
          }`}
        >
          {m}m
        </button>
      ))}
      <button
        type="button"
        aria-label="One minute less"
        disabled={disabled}
        onClick={() => onMinutes(minutes - 1)}
        className={`${SMALL_BUTTON} border-hairline text-text-secondary hover:text-text-primary`}
      >
        −
      </button>
      <button
        type="button"
        aria-label="One minute more"
        disabled={disabled}
        onClick={() => onMinutes(minutes + 1)}
        className={`${SMALL_BUTTON} border-hairline text-text-secondary hover:text-text-primary`}
      >
        +
      </button>
    </div>
  )
}

function PhaseDots({ phase, round }) {
  // A round's dot fills once its focus is done.
  const filled = phase === 'focus' ? round - 1 : round
  return (
    <p className="flex items-center gap-2 text-xs text-text-secondary">
      <span className="font-medium text-text-primary">
        {PHASE_NAMES[phase]}
      </span>
      <span aria-hidden className="inline-flex gap-1">
        {Array.from({ length: POMODORO.rounds }, (_, i) => (
          <span
            key={i}
            className={`size-[7px] border ${i < filled ? 'border-card-timer bg-card-timer' : 'border-text-muted'}`}
          />
        ))}
      </span>
    </p>
  )
}

/**
 * A countdown timer with a Pomodoro mode. When time is up it chimes and
 * flashes until someone clicks it; then the next run is loaded and waits for
 * Start. Static: nothing is saved, so a reload resets it.
 */
export default function TimerCard({ onNote }) {
  const [state, dispatch] = useReducer(timerReducer, INITIAL)
  const [now, setNow] = useState(() => Date.now())
  // The card's main button changes between Start and "done"; keyboard focus
  // follows it if it was in the card, and is never taken from elsewhere.
  const focusInCard = useRef(false)
  const mainButton = useRef(null)
  const running = state.endsAt !== null
  const left = running ? Math.max(0, state.endsAt - now) : state.left

  // While running, re-render a few times a second and finish on time.
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= state.endsAt) {
        dispatch({ type: 'finish' })
        playChime()
      }
    }, 250)
    return () => clearInterval(id)
  }, [running, state.endsAt])

  useEffect(() => {
    onNote?.(
      state.mode === 'pomodoro'
        ? `Round ${state.round} of ${POMODORO.rounds}`
        : null,
    )
  }, [onNote, state.mode, state.round])

  useEffect(() => {
    if (focusInCard.current) mainButton.current?.focus()
  }, [state.done])

  const progress = state.total ? 1 - left / state.total : 0

  return (
    // Spans the whole card body (cancelling its padding), so the done flash
    // and the edge bar reach the card's edges.
    <div
      onClick={state.done ? () => dispatch({ type: 'dismiss' }) : undefined}
      onFocus={() => (focusInCard.current = true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget))
          focusInCard.current = false
      }}
      data-done={state.done}
      className={`relative -m-4 h-[calc(100%+2rem)] p-4 flex flex-col justify-between gap-3 ${state.done ? 'animate-timer-done cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={`text-6xl font-light leading-none tracking-tight tabular-nums ${state.done ? 'text-card-timer' : ''}`}
        >
          {formatTime(left)}
        </p>
        <ModeToggle
          mode={state.mode}
          onMode={(mode) => dispatch({ type: 'mode', mode })}
          disabled={state.done}
        />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        {state.mode === 'timer' ? (
          <MinutesPicker
            minutes={state.minutes}
            onMinutes={(minutes) => dispatch({ type: 'minutes', minutes })}
            disabled={state.done}
          />
        ) : (
          <PhaseDots phase={state.phase} round={state.round} />
        )}
        <div className="flex gap-1.5">
          {state.done ? (
            // No handler of its own: its click reaches the card's, above.
            // It is here so the keyboard can dismiss too.
            <button
              ref={mainButton}
              type="button"
              className="inline-flex items-center gap-1.5 min-h-9 px-3 text-[13px] font-medium bg-card-timer text-surface"
            >
              {doneMessage(state)}
            </button>
          ) : (
            <>
              <button
                ref={mainButton}
                type="button"
                onClick={() =>
                  dispatch({
                    type: running ? 'pause' : 'start',
                    now: Date.now(),
                  })
                }
                className="inline-flex items-center gap-1.5 min-h-9 px-3 text-[13px] font-medium bg-text-primary text-surface hover:bg-text-primary/90"
              >
                {running ? (
                  <PauseIcon size={16} aria-hidden />
                ) : (
                  <PlayIcon size={16} aria-hidden />
                )}
                {running ? 'Pause' : 'Start'}
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: 'reset' })}
                aria-label="Reset"
                className="inline-flex items-center justify-center min-h-9 min-w-9 border border-hairline-strong text-text-primary hover:border-text-muted"
              >
                <ArrowCounterClockwiseIcon size={16} aria-hidden />
              </button>
            </>
          )}
        </div>
      </div>
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[3px] bg-hairline"
      >
        <div
          className="h-full bg-card-timer"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <p className="sr-only" aria-live="polite">
        {state.done ? doneMessage(state) : ''}
      </p>
    </div>
  )
}
