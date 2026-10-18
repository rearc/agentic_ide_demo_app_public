import { useState, useEffect } from 'react'
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
      <p className="font-display text-2xl font-bold tracking-tight text-text-primary tabular-nums leading-none">
        {time}
      </p>
      <p className="text-text-muted text-xs mt-1.5">{date}</p>
    </div>
  )
}

export default function App() {
  const [locked, setLocked] = useState(true)

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border-subtle/70 bg-surface/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <AnimatedLabsLockup
              markSize={34}
              wordSize={27}
              tone="navy"
              title="Rearc AI Labs"
            />
            <span className="hidden sm:block h-7 w-px bg-border-subtle" />
            <h1 className="hidden sm:block font-display text-lg font-semibold tracking-tight text-text-secondary">
              Control Center
            </h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {!locked && (
              <span className="hidden md:inline-flex items-center text-xs text-text-secondary bg-surface-raised/80 border border-border-subtle rounded-sm px-3 py-1.5">
                Drag &amp; resize — changes save automatically
              </span>
            )}
            <button
              onClick={() => setLocked((l) => !l)}
              className={`text-sm font-medium rounded-sm px-3.5 py-2 border transition-colors ${
                locked
                  ? 'border-border-subtle text-text-secondary hover:text-text-primary hover:border-text-muted'
                  : 'border-card-placeholder/60 text-card-placeholder hover:bg-card-placeholder/10'
              }`}
            >
              {locked ? 'Customize layout' : 'Lock layout'}
            </button>
            <Clock />
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Dashboard locked={locked} />
      </main>
    </div>
  )
}
