import { useEffect, useMemo, useRef, useState } from 'react'
import * as api from './api'

/** Where this browser remembers which profile it shows. */
export const PROFILE_STORAGE_KEY = 'dashboard.profileId'

/** The size a card takes on a board where it has never been placed. */
export const NEW_CARD_SIZE = { w: 4, h: 4 }

const EMPTY_BOARD = {}

/**
 * The size `cardId` takes when it comes onto `board`: its stored size when
 * the board has an entry for it (a hidden card keeps its size), else
 * NEW_CARD_SIZE.
 */
export function placedSize(board, cardId) {
  const entry = board[cardId]
  return entry ? { w: entry.w, h: entry.h } : NEW_CARD_SIZE
}

/**
 * `board` with the grid's items laid over it: each visible card takes the
 * place the grid gives it. Hidden entries keep theirs, and grid items that
 * are not on the board (the drop placeholder) are ignored.
 */
function withGridItems(board, gridItems) {
  const next = { ...board }
  for (const { i, x, y, w, h } of gridItems) {
    const entry = next[i]
    if (entry && !entry.hidden) next[i] = { ...entry, x, y, w, h }
  }
  return next
}

/** The profile on screen: the chosen one, else the first. */
function shownProfile(profiles, shownId) {
  return profiles.find((p) => p.id === shownId) ?? profiles[0] ?? null
}

/** The row just below the lowest visible card: where an added card goes. */
function bottomEdge(board) {
  return Object.values(board)
    .filter((entry) => !entry.hidden)
    .reduce((bottom, entry) => Math.max(bottom, entry.y + entry.h), 0)
}

/*
 * localStorage can throw (private windows, blocked site data). The shown
 * profile is a convenience, so a failure is logged and the first profile shown.
 */
function readStoredProfileId() {
  try {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY)
    return stored === null ? null : Number(stored)
  } catch (err) {
    console.warn('Could not read the remembered profile', err)
    return null
  }
}

function storeProfileId(id) {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, String(id))
  } catch (err) {
    console.warn('Could not remember the shown profile', err)
  }
}

/**
 * The one owner of board state: the card library, the profiles, which profile
 * is shown, and every change to them.
 *
 * Writes are optimistic. Each is computed from refs holding the latest state
 * (not a render's closure: the grid keeps its handlers across renders), names
 * the profile it was made for, and sends the whole board. Writes go to the
 * server one at a time, in the order they were made, because each replaces the
 * whole board and two in flight could land in either order. A failed write is
 * logged and the profiles reloaded, so the screen returns to what was saved.
 */
export default function useBoard() {
  const [cards, setCards] = useState([])
  const [profiles, setProfiles] = useState([])
  const [shownId, setShownId] = useState(readStoredProfileId)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // The card being dragged from the library. The grid cannot read
  // dataTransfer while a drag is over it, so the id is handed over here.
  const [draggingCardId, setDraggingCardId] = useState(null)

  const profilesRef = useRef(profiles)
  const shownIdRef = useRef(shownId)
  const queueRef = useRef(Promise.resolve())

  const actions = useMemo(() => {
    function replaceProfiles(next) {
      profilesRef.current = next
      setProfiles(next)
    }

    function selectProfile(id) {
      shownIdRef.current = id
      setShownId(id)
      storeProfileId(id)
    }

    function current() {
      return shownProfile(profilesRef.current, shownIdRef.current)
    }

    function enqueue(send) {
      const result = queueRef.current.then(send)
      // The next write waits for this one to settle either way. Its failure is
      // not dropped: `result` goes back to the caller, which handles it.
      queueRef.current = result.then(
        () => {},
        () => {},
      )
      return result
    }

    function reload() {
      enqueue(api.fetchProfiles)
        .then(replaceProfiles)
        .catch((err) => console.error('Failed to reload profiles', err))
    }

    function failed(message) {
      return (err) => {
        console.error(message, err)
        reload()
      }
    }

    function writeBoard(profileId, board) {
      replaceProfiles(
        profilesRef.current.map((p) =>
          p.id === profileId ? { ...p, board } : p,
        ),
      )
      enqueue(() => api.updateProfile(profileId, { board })).catch(
        failed('Failed to save the board'),
      )
    }

    /** Save where the grid has put the board's visible cards. */
    function saveLayout(gridItems) {
      const profile = current()
      if (!profile) return
      writeBoard(profile.id, withGridItems(profile.board, gridItems))
    }

    function hideCard(cardId) {
      const profile = current()
      const entry = profile?.board[cardId]
      if (!entry) return
      writeBoard(profile.id, {
        ...profile.board,
        [cardId]: { ...entry, hidden: true },
      })
    }

    /**
     * Put a card on the board at `place` ({x, y}), else at the bottom. A drop
     * also passes the grid's items, which hold where the other cards moved to
     * make room; without them, the card and the one it displaced would both
     * claim the spot and the grid would push the new card below.
     */
    function showCard(cardId, place, gridItems = []) {
      const profile = current()
      if (!profile) return
      const board = withGridItems(profile.board, gridItems)
      const { x, y } = place ?? { x: 0, y: bottomEdge(board) }
      writeBoard(profile.id, {
        ...board,
        [cardId]: { x, y, ...placedSize(board, cardId), hidden: false },
      })
    }

    /** Save the shown board under a new name, then show it. Rejects on failure. */
    function createProfile(name) {
      const board = current()?.board ?? EMPTY_BOARD
      return enqueue(() => api.createProfile(name, board)).then(
        (created) => {
          replaceProfiles([...profilesRef.current, created])
          selectProfile(created.id)
        },
        (err) => {
          console.error('Failed to create the profile', err)
          throw err
        },
      )
    }

    /** Rename a profile. Rejects on failure, so the caller can say why. */
    function renameProfile(id, name) {
      replaceProfiles(
        profilesRef.current.map((p) => (p.id === id ? { ...p, name } : p)),
      )
      return enqueue(() => api.updateProfile(id, { name })).catch((err) => {
        failed('Failed to rename the profile')(err)
        throw err
      })
    }

    /** Delete a profile (never the last one); show another if it was shown. */
    function deleteProfile(id) {
      if (profilesRef.current.length <= 1) return
      const wasShown = current()?.id === id
      const remaining = profilesRef.current.filter((p) => p.id !== id)
      replaceProfiles(remaining)
      if (wasShown) selectProfile(remaining[0].id)
      enqueue(() => api.deleteProfile(id)).catch(
        failed('Failed to delete the profile'),
      )
    }

    return {
      selectProfile,
      saveLayout,
      hideCard,
      showCard,
      createProfile,
      renameProfile,
      deleteProfile,
    }
  }, [])

  useEffect(() => {
    Promise.all([api.fetchCards(), api.fetchProfiles()])
      .then(([cardList, profileList]) => {
        setCards(cardList)
        profilesRef.current = profileList
        setProfiles(profileList)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const profile = shownProfile(profiles, shownId)

  return {
    cards,
    profiles,
    profile,
    board: profile?.board ?? EMPTY_BOARD,
    loading,
    error,
    draggingCardId,
    setDraggingCardId,
    ...actions,
  }
}
