import { useState, useEffect } from 'react'
import {
  IconContext,
  LockSimpleIcon,
  SquaresFourIcon,
} from '@phosphor-icons/react'
import Dashboard from './components/Dashboard'
import LibraryButton from './components/LibraryButton'
import LibraryDrawer from './components/LibraryDrawer'
import ProfileMenu from './components/ProfileMenu'
import AnimatedLabsLockup from './components/brand/AnimatedLabsLockup'
import useBoard from './useBoard'

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

const LIBRARY_ID = 'card-library'

export default function App() {
  const board = useBoard()
  const [locked, setLocked] = useState(true)
  const [libraryOpen, setLibraryOpen] = useState(false)

  // Adding cards is a Customize action, so opening the library unlocks the
  // board, and locking it closes the library.
  function toggleLibrary() {
    if (!libraryOpen) setLocked(false)
    setLibraryOpen(!libraryOpen)
  }

  function toggleLock() {
    if (!locked) setLibraryOpen(false)
    setLocked(!locked)
  }

  return (
    <IconContext.Provider value={ICON_STYLE}>
      <div className="min-h-screen">
        <header className="sticky top-0 z-10 border-b-[3px] border-text-primary bg-surface/90 backdrop-blur">
          {/* Three columns, the outer two equal, keep the Library button in
              the centre; when one side needs more room it shifts rather than
              overlap. The sides keep their content's width, so what they
              show is trimmed by breakpoint to fit. */}
          <div className="max-w-[1600px] mx-auto px-5 py-3.5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            {/* min-w-max: the profile name truncates, which would otherwise
                let the grid squeeze this column below the name's width. */}
            <div className="flex items-center gap-4 min-w-max">
              <AnimatedLabsLockup
                markSize={34}
                wordSize={27}
                tone="navy"
                title="Rearc AI Labs"
              />
              <span className="h-7 w-px shrink-0 bg-hairline-strong" />
              <div className="flex">
                <ProfileMenu
                  profiles={board.profiles}
                  profile={board.profile}
                  onSelect={board.selectProfile}
                  onCreate={board.createProfile}
                  onRename={board.renameProfile}
                  onDelete={board.deleteProfile}
                />
              </div>
            </div>
            <LibraryButton
              open={libraryOpen}
              onToggle={toggleLibrary}
              controls={LIBRARY_ID}
            />
            <div className="flex items-center justify-end gap-3">
              {!locked && (
                <span className="hidden 2xl:inline text-xs text-text-secondary">
                  Drag a card by its header, resize from its corner; changes
                  save automatically
                </span>
              )}
              {/* "Customize layout" hides where the dashboard stacks its cards
                  (STACK_BELOW in Dashboard.jsx): there is no layout to drag.
                  "Lock layout" shows at every width, since the Library button
                  can turn Customize on there too. */}
              <button
                onClick={toggleLock}
                className={`${locked ? 'hidden md:inline-flex' : 'inline-flex'} shrink-0 items-center gap-2 min-h-9 px-3.5 text-[13px] font-medium border transition-colors ${
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
          {libraryOpen && (
            <LibraryDrawer
              id={LIBRARY_ID}
              cards={board.cards}
              board={board.board}
              onAdd={board.showCard}
              onDragStart={board.setDraggingCardId}
              onDragEnd={() => board.setDraggingCardId(null)}
            />
          )}
        </header>
        <main className="max-w-[1600px] mx-auto px-5 py-5">
          <Dashboard
            cards={board.cards}
            board={board.board}
            locked={locked}
            loading={board.loading}
            error={board.error}
            draggingCardId={board.draggingCardId}
            saveLayout={board.saveLayout}
            hideCard={board.hideCard}
            showCard={board.showCard}
          />
        </main>
      </div>
    </IconContext.Provider>
  )
}
