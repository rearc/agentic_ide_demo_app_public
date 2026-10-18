import { useState, useEffect, useCallback } from 'react'
import { XIcon } from '@phosphor-icons/react'
import LoadingDots from '../LoadingDots'
import { createTodo, deleteTodo, fetchTodos, updateTodo } from '../../api'

export default function TodoCard({ card, onNote }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newText, setNewText] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    return fetchTodos(card.id)
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [card.id])

  useEffect(() => {
    load()
  }, [load])

  const doneCount = items.filter((t) => t.done).length
  useEffect(() => {
    onNote?.(items.length ? `${doneCount} of ${items.length} done` : null)
  }, [onNote, doneCount, items.length])

  async function handleAdd(e) {
    e.preventDefault()
    const text = newText.trim()
    if (!text) return
    setError(null)
    try {
      const todo = await createTodo(card.id, text)
      setItems((prev) => [...prev, todo])
      setNewText('')
    } catch (err) {
      setError(err.message)
    }
  }

  function toggleDone(todoId) {
    const todo = items.find((x) => x.id === todoId)
    if (!todo) return
    const nextDone = !todo.done
    setError(null)
    setItems((prev) =>
      prev.map((x) => (x.id === todoId ? { ...x, done: nextDone } : x)),
    )
    updateTodo(todoId, { done: nextDone })
      .then((updated) => {
        setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
      })
      .catch((err) => {
        setError(err.message)
        setItems((prev) =>
          prev.map((x) => (x.id === todoId ? { ...x, done: todo.done } : x)),
        )
      })
  }

  async function remove(id) {
    setError(null)
    try {
      await deleteTodo(id)
      setItems((prev) => prev.filter((t) => t.id !== id))
      if (editingId === id) {
        setEditingId(null)
        setEditText('')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  function startEdit(todo) {
    setEditingId(todo.id)
    setEditText(todo.text)
  }

  async function commitEdit() {
    if (editingId == null) return
    const trimmed = editText.trim()
    if (!trimmed) {
      setEditingId(null)
      setEditText('')
      setError(null)
      return
    }
    setError(null)
    try {
      const updated = await updateTodo(editingId, { text: trimmed })
      setItems((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setEditingId(null)
    } catch (err) {
      setError(err.message)
    }
  }

  function cancelEdit() {
    setEditingId(null)
    setEditText('')
    setError(null)
  }

  if (loading) {
    return <LoadingDots label="Loading todos" className="py-8" />
  }

  return (
    // Only the list scrolls: the error and the add form stay in view.
    <div className="h-full flex flex-col gap-3">
      {error && <p className="text-xs text-danger shrink-0">{error}</p>}
      <form onSubmit={handleAdd} className="flex gap-2 shrink-0">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Add a task…"
          maxLength={500}
          className="flex-1 min-w-0 border border-hairline-strong bg-surface px-2.5 py-1.5 min-h-9 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-secondary"
        />
        <button
          type="submit"
          className="shrink-0 px-4 min-h-9 text-[13px] font-semibold text-surface bg-text-primary hover:bg-text-primary/90 transition-colors"
        >
          Add
        </button>
      </form>
      <ul className="flex-1 min-h-0 overflow-auto card-scroll -mx-1 px-1">
        {items.length === 0 ? (
          <li className="text-sm text-text-muted py-2">No tasks yet.</li>
        ) : (
          items.map((todo) => (
            <li
              key={todo.id}
              className="flex items-center gap-2.5 py-1 border-b border-hairline last:border-b-0"
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={todo.done}
                aria-label={`Mark "${todo.text}" ${todo.done ? 'not done' : 'done'}`}
                onClick={() => toggleDone(todo.id)}
                className={`h-[18px] w-[18px] shrink-0 border text-[10px] leading-none flex items-center justify-center transition-colors ${
                  todo.done
                    ? 'border-live bg-live text-surface'
                    : 'border-text-muted text-transparent hover:border-text-secondary'
                }`}
              >
                {todo.done ? '✓' : ''}
              </button>
              {editingId === todo.id ? (
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitEdit()
                    }
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  aria-label={`Edit "${todo.text}"`}
                  maxLength={500}
                  autoFocus
                  className="flex-1 min-w-0 border border-hairline-strong bg-surface px-2 py-0.5 text-sm text-text-primary focus:outline-none focus:border-text-secondary"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(todo)}
                  className={`flex-1 min-w-0 text-left text-sm leading-snug rounded px-1 py-0.5 -mx-1 -my-0.5 hover:bg-surface transition-colors ${
                    todo.done
                      ? 'text-text-muted line-through'
                      : 'text-text-primary'
                  }`}
                >
                  {todo.text}
                </button>
              )}
              <button
                type="button"
                // Deleting while this row's editor is open would otherwise blur
                // it first, committing an edit against the row being deleted
                // and surfacing a 404 for an action the user never took.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => remove(todo.id)}
                className="shrink-0 grid place-items-center h-7 w-7 text-text-secondary hover:text-danger transition-colors"
                title="Delete"
                aria-label={`Delete "${todo.text}"`}
              >
                <XIcon size={16} aria-hidden />
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
