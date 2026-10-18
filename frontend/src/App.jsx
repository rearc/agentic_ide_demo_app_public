import { useState, useEffect } from 'react'
import { IconContext } from '@phosphor-icons/react'
import Dashboard from './components/Dashboard'
import EditButton from './components/EditButton'
import LibraryDrawer from './components/LibraryDrawer'
import ProfileMenu from './components/ProfileMenu'
import ProfilePager from './components/ProfilePager'
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
  // Editing is one mode: the cards can be moved, resized and removed, and the
  // library is open to add more. "Edit board" turns it on, "Done" off.
  const [editing, setEditing] = useState(false)
  // Which way the last profile change went: 'next' or 'prev' from the
  // arrows, null from the menu. The board slides in from that side.
  const [turn, setTurn] = useState(null)

  function stepProfile(step) {
    setTurn(step > 0 ? 'next' : 'prev')
    board.stepProfile(step)
  }

  function selectProfile(id) {
    setTurn(null)
    board.selectProfile(id)
  }

  return (
    <IconContext.Provider value={ICON_STYLE}>
      <div className="min-h-screen">
        <header className="sticky top-0 z-10 border-b-[3px] border-text-primary bg-surface/90 backdrop-blur">
          <div className="max-w-[1600px] mx-auto px-5 py-3.5 flex items-center gap-4">
            <AnimatedLabsLockup
              markSize={34}
              wordSize={27}
              tone="navy"
              title="Rearc AI Labs"
            />
            <span className="h-7 w-px shrink-0 bg-hairline-strong" />
            <ProfilePager count={board.profiles.length} onStep={stepProfile}>
              <ProfileMenu
                profiles={board.profiles}
                profile={board.profile}
                onSelect={selectProfile}
                onCreate={board.createProfile}
                onRename={board.renameProfile}
                onDelete={board.deleteProfile}
              />
            </ProfilePager>
            <div className="ml-auto flex items-center gap-3">
              {editing && (
                <span className="hidden 2xl:inline text-xs text-text-secondary">
                  Drag a card by its header, resize from its corner; changes
                  save automatically
                </span>
              )}
              <EditButton
                editing={editing}
                onToggle={() => setEditing(!editing)}
                controls={LIBRARY_ID}
              />
              <Clock />
            </div>
          </div>
          <LibraryDrawer
            id={LIBRARY_ID}
            open={editing}
            cards={board.cards}
            board={board.board}
            onAdd={board.showCard}
            onRemove={board.hideCard}
            onDragStart={board.setDraggingCardId}
            onDragEnd={() => board.setDraggingCardId(null)}
          />
        </header>
        <main className="max-w-[1600px] mx-auto px-5 py-5">
          <Dashboard
            cards={board.cards}
            board={board.board}
            profileId={board.profile?.id}
            turn={turn}
            locked={!editing}
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
