import { useEffect, useRef, useState } from 'react'
import {
  CaretDownIcon,
  CheckIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from '@phosphor-icons/react'

const ICON_BUTTON =
  'inline-flex items-center justify-center h-8 w-8 shrink-0 text-text-muted hover:text-text-primary hover:bg-hairline disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-muted transition-colors'
const TEXT_BUTTON =
  'inline-flex items-center h-8 px-2.5 text-xs font-medium border transition-colors'
const QUIET_BUTTON = `${TEXT_BUTTON} border-hairline-strong text-text-primary hover:border-text-muted`
const ROW = 'flex items-center gap-1 px-1.5 min-h-10'

/** The profile name length the API accepts. */
const NAME_MAX = 50

/**
 * An inline name field. `onSubmit` returns a promise; when it rejects, its
 * message (a duplicate name, say) shows under the field.
 */
function NameForm({ initial = '', label, submitLabel, onSubmit, onCancel }) {
  const [name, setName] = useState(initial)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const trimmed = name.trim()

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSubmit(trimmed)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-1.5 py-1.5">
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={label}
          placeholder={label}
          maxLength={NAME_MAX}
          className="min-w-0 flex-1 h-8 px-2.5 bg-surface border border-hairline-strong text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-muted"
        />
        <button
          type="submit"
          disabled={!trimmed || saving}
          className={`${QUIET_BUTTON} disabled:opacity-40`}
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className={ICON_BUTTON}
        >
          <XIcon size={14} aria-hidden />
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 px-0.5 text-xs text-danger">
          {error}
        </p>
      )}
    </form>
  )
}

/** One profile in the menu: switch to it, rename it, or delete it. */
function ProfileRow({
  profile,
  shown,
  canDelete,
  mode,
  onSelect,
  onMode,
  onRename,
  onDelete,
}) {
  if (mode === 'rename') {
    return (
      <li>
        <NameForm
          initial={profile.name}
          label="Profile name"
          submitLabel="Rename"
          onSubmit={(name) =>
            onRename(profile.id, name).then(() => onMode(null))
          }
          onCancel={() => onMode(null)}
        />
      </li>
    )
  }

  if (mode === 'delete') {
    return (
      <li className={`${ROW} pl-3`}>
        <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">
          Delete &ldquo;{profile.name}&rdquo;?
        </span>
        <button
          type="button"
          onClick={() => onDelete(profile.id)}
          className={`${TEXT_BUTTON} border-danger/60 text-danger hover:border-danger`}
        >
          Delete
        </button>
        <button
          type="button"
          onClick={() => onMode(null)}
          className={QUIET_BUTTON}
        >
          Cancel
        </button>
      </li>
    )
  }

  return (
    <li className={ROW}>
      <button
        type="button"
        onClick={() => onSelect(profile.id)}
        aria-current={shown ? 'true' : undefined}
        className="min-w-0 flex-1 flex items-center gap-2 h-8 px-1.5 text-left text-[13px] text-text-primary hover:bg-hairline transition-colors"
      >
        <CheckIcon
          size={14}
          aria-hidden
          className={shown ? 'shrink-0' : 'shrink-0 invisible'}
        />
        <span className="truncate">{profile.name}</span>
      </button>
      <button
        type="button"
        onClick={() => onMode('rename')}
        aria-label={`Rename "${profile.name}"`}
        title="Rename"
        className={ICON_BUTTON}
      >
        <PencilSimpleIcon size={14} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onMode('delete')}
        disabled={!canDelete}
        aria-label={`Delete "${profile.name}"`}
        title={canDelete ? 'Delete' : 'The last profile cannot be deleted'}
        className={ICON_BUTTON}
      >
        <TrashIcon size={14} aria-hidden />
      </button>
    </li>
  )
}

/**
 * The header's title and profile switcher: "Control Center" and the shown
 * profile's name, opening a small menu to switch, save the board as a new
 * profile, rename or delete. Every name is typed inline, never in a prompt.
 */
export default function ProfileMenu({
  profiles,
  profile,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}) {
  const [open, setOpen] = useState(false)
  // What the menu is doing beyond listing: { kind: 'create' } or
  // { kind: 'rename' | 'delete', id }.
  const [editing, setEditing] = useState(null)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)

  function close() {
    setOpen(false)
    setEditing(null)
  }

  useEffect(() => {
    if (!open) return
    function handlePointer(e) {
      if (rootRef.current.contains(e.target)) return
      setOpen(false)
      setEditing(null)
    }
    function handleKey(e) {
      if (e.key !== 'Escape') return
      // Escape backs out of an inline field first, then closes the menu.
      if (editing) {
        setEditing(null)
      } else {
        setOpen(false)
        buttonRef.current.focus()
      }
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, editing])

  function select(id) {
    onSelect(id)
    close()
  }

  function remove(id) {
    onDelete(id)
    setEditing(null)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls="profile-menu"
        // Spelled out: the visible parts would otherwise run together.
        aria-label={
          profile ? `Control Center, profile ${profile.name}` : 'Control Center'
        }
        className="flex items-center gap-2 min-h-9 px-2 -mx-2 text-[15px] hover:bg-panel transition-colors"
      >
        {/* Below `lg` the header has room for the profile name only. */}
        <span className="hidden lg:inline shrink-0 font-medium text-text-secondary">
          Control Center
        </span>
        {profile && (
          <>
            <span aria-hidden className="hidden lg:inline text-text-muted">
              /
            </span>
            <span className="max-w-48 truncate font-medium text-text-primary">
              {profile.name}
            </span>
          </>
        )}
        <CaretDownIcon
          size={14}
          aria-hidden
          className={`shrink-0 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          id="profile-menu"
          role="region"
          aria-label="Profiles"
          className="absolute left-0 top-full mt-2 w-72 z-20 bg-panel border border-hairline-strong shadow-[0_12px_32px_rgb(0_0_0/0.45)]"
        >
          <p className="px-3 pt-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-text-muted">
            Profiles
          </p>
          <ul className="pb-1">
            {profiles.map((p) => (
              <ProfileRow
                key={p.id}
                profile={p}
                shown={p.id === profile?.id}
                canDelete={profiles.length > 1}
                mode={editing?.id === p.id ? editing.kind : null}
                onSelect={select}
                onMode={(kind) => setEditing(kind ? { kind, id: p.id } : null)}
                onRename={onRename}
                onDelete={remove}
              />
            ))}
          </ul>
          <div className="border-t border-hairline">
            {editing?.kind === 'create' ? (
              <NameForm
                label="New profile name"
                submitLabel="Save"
                onSubmit={(name) => onCreate(name).then(close)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className="px-1.5 py-1.5">
                <button
                  type="button"
                  onClick={() => setEditing({ kind: 'create' })}
                  className="w-full flex items-center gap-2 h-8 px-1.5 text-left text-[13px] text-text-primary hover:bg-hairline transition-colors"
                >
                  <PlusIcon size={14} aria-hidden className="shrink-0" />
                  Save as new profile
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
