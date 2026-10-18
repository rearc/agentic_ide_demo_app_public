import { useState, useEffect, useCallback } from 'react'
import LoadingDots from '../LoadingDots'
import { createTodo, deleteTodo, fetchTodos, updateTodo } from '../../api'

export default function TodoCard({ card }) {
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
    <div className="flex flex-col gap-3 min-h-0">
      {error && <p className="text-xs text-red-400/90 shrink-0">{error}</p>}
      <form onSubmit={handleAdd} className="flex gap-2 shrink-0">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Add a task…"
          maxLength={500}
          className="flex-1 min-w-0 rounded-sm border border-border-subtle bg-surface px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-card-todo/50"
        />
        <button
          type="submit"
          className="shrink-0 rounded-sm px-4 py-1.5 text-xs font-bold text-surface bg-gradient-to-r from-card-todo to-card-todo-2 hover:opacity-90 transition-opacity"
        >
          Add
        </button>
      </form>
      <ul className="space-y-1.5 flex-1 min-h-0 overflow-auto pr-0.5">
        {items.length === 0 ? (
          <li className="text-sm text-text-muted py-2">No tasks yet.</li>
        ) : (
          items.map((todo) => (
            <li
              key={todo.id}
              className="flex items-start gap-2 rounded-sm border border-transparent px-1 py-0.5 hover:border-border-subtle/80 hover:bg-surface/50"
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={todo.done}
                aria-label={`Mark "${todo.text}" ${todo.done ? 'not done' : 'done'}`}
                onClick={() => toggleDone(todo.id)}
                className={`mt-0.5 h-4 w-4 shrink-0 rounded border text-[10px] leading-none flex items-center justify-center transition-colors ${
                  todo.done
                    ? 'border-card-todo bg-card-todo/30 text-card-todo'
                    : 'border-border-subtle text-transparent hover:border-text-muted'
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
                  className="flex-1 min-w-0 rounded border border-border-subtle bg-surface px-2 py-0.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-card-todo/50"
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
                className="shrink-0 p-1 text-text-muted hover:text-red-400/90 text-xs"
                title="Delete"
                aria-label={`Delete "${todo.text}"`}
              >
                ×
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
