import { useState, useEffect } from 'react'
import {
  IconContext,
  LockSimpleIcon,
  SquaresFourIcon,
} from '@phosphor-icons/react'
import Dashboard from './components/Dashboard'
import AnimatedLabsLockup from './components/brand/AnimatedLabsLockup'

/** Header clock. Owns the one-second tick so only it re-renders, not the app. */
function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const time = now.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
  const date = now.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="text-right hidden sm:block">
      <p className="font-mono text-lg font-medium leading-none tabular-nums">
        {time}
      </p>
      <p className="text-text-secondary text-xs mt-1.5">{date}</p>
    </div>
  )
}

// Every Phosphor icon in the app takes this weight unless it sets its own.
const ICON_STYLE = { weight: 'light' }

export default function App() {
  const [locked, setLocked] = useState(true)

  return (
    <IconContext.Provider value={ICON_STYLE}>
      <div className="min-h-screen">
        <header className="sticky top-0 z-10 border-b border-hairline bg-surface/90 backdrop-blur">
          <div className="max-w-[1600px] mx-auto px-5 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <AnimatedLabsLockup
                markSize={34}
                wordSize={27}
                tone="navy"
                title="Rearc AI Labs"
              />
              <span className="hidden sm:block h-7 w-px bg-hairline-strong" />
              <h1 className="hidden sm:block text-[15px] font-medium text-text-secondary">
                Control Center
              </h1>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {!locked && (
                <span className="hidden lg:inline text-xs text-text-secondary">
                  Drag a card by its header, resize from its corner; changes
                  save automatically
                </span>
              )}
              {/* Hidden where the dashboard stacks its cards (STACK_BELOW in
                  Dashboard.jsx): a stacked board has no layout to customize. */}
              <button
                onClick={() => setLocked((l) => !l)}
                className={`hidden md:inline-flex items-center gap-2 min-h-9 px-3.5 text-[13px] font-medium border transition-colors ${
                  locked
                    ? 'bg-panel border-hairline-strong text-text-primary hover:border-text-muted'
                    : 'bg-text-primary border-text-primary text-surface hover:bg-text-primary/90'
                }`}
              >
                {locked ? (
                  <SquaresFourIcon size={16} aria-hidden />
                ) : (
                  <LockSimpleIcon size={16} aria-hidden />
                )}
                {locked ? 'Customize layout' : 'Lock layout'}
              </button>
              <Clock />
            </div>
          </div>
        </header>
        <main className="max-w-[1600px] mx-auto px-5 py-5">
          <Dashboard locked={locked} />
        </main>
      </div>
    </IconContext.Provider>
  )
}
