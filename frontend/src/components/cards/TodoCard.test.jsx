import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TodoCard from './TodoCard'
import { createTodo, deleteTodo, fetchTodos, updateTodo } from '../../api'
import { deferred } from '../../test/helpers'

vi.mock('../../api')

const CARD = { id: 5 }

function todo(overrides = {}) {
  return { id: 1, card_id: 5, text: 'A task', done: false, ...overrides }
}

/** Render and wait for the initial load to settle. */
async function renderCard(items = []) {
  fetchTodos.mockResolvedValue(items)
  const result = render(<TodoCard card={CARD} />)
  await waitFor(() =>
    expect(screen.queryByRole('status')).not.toBeInTheDocument(),
  )
  return result
}

/** The checkbox for a given todo, found by its accessible name. */
function checkboxFor(text) {
  return screen.getByRole('checkbox', { name: new RegExp(`"${text}"`) })
}

beforeEach(() => {
  fetchTodos.mockResolvedValue([])
})

describe('loading todos', () => {
  it('shows a loading indicator until the todos arrive', () => {
    fetchTodos.mockReturnValue(new Promise(() => {}))

    render(<TodoCard card={CARD} />)

    expect(
      screen.getByRole('status', { name: 'Loading todos' }),
    ).toBeInTheDocument()
  })

  it('requests the todos for its own card', async () => {
    await renderCard()

    expect(fetchTodos).toHaveBeenCalledWith(5)
  })

  it('renders each todo it loaded with its done state', async () => {
    await renderCard([
      todo({ id: 1, text: 'First', done: false }),
      todo({ id: 2, text: 'Second', done: true }),
    ])

    expect(screen.getByRole('button', { name: 'First' })).toBeInTheDocument()
    expect(checkboxFor('First')).not.toBeChecked()
    expect(checkboxFor('Second')).toBeChecked()
  })

  it('shows an empty state when there are no todos', async () => {
    await renderCard([])

    expect(screen.getByText('No tasks yet.')).toBeInTheDocument()
  })

  it('shows an error when loading fails', async () => {
    fetchTodos.mockRejectedValue(new Error('Card not found'))

    render(<TodoCard card={CARD} />)

    expect(await screen.findByText('Card not found')).toBeInTheDocument()
  })
})

describe('adding a todo', () => {
  it('creates the todo and appends it to the list', async () => {
    const user = userEvent.setup()
    await renderCard([])
    createTodo.mockResolvedValue(todo({ id: 2, text: 'Write tests' }))

    await user.type(screen.getByPlaceholderText('Add a task…'), 'Write tests')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(createTodo).toHaveBeenCalledWith(5, 'Write tests')
    expect(
      await screen.findByRole('button', { name: 'Write tests' }),
    ).toBeInTheDocument()
  })

  it('clears the input after a successful add', async () => {
    const user = userEvent.setup()
    await renderCard([])
    createTodo.mockResolvedValue(todo({ id: 2, text: 'Write tests' }))
    const input = screen.getByPlaceholderText('Add a task…')

    await user.type(input, 'Write tests')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(input).toHaveValue(''))
  })

  it('trims whitespace before sending', async () => {
    const user = userEvent.setup()
    await renderCard([])
    createTodo.mockResolvedValue(todo({ id: 2, text: 'Write tests' }))

    await user.type(
      screen.getByPlaceholderText('Add a task…'),
      '   Write tests   ',
    )
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(createTodo).toHaveBeenCalledWith(5, 'Write tests')
  })

  it('ignores a whitespace-only submission', async () => {
    const user = userEvent.setup()
    await renderCard([])

    await user.type(screen.getByPlaceholderText('Add a task…'), '   ')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(createTodo).not.toHaveBeenCalled()
  })

  it('caps the input at the length the API accepts', async () => {
    /* The server rejects longer text; without this attribute the user only
       finds out after submitting. */
    await renderCard([])

    expect(screen.getByPlaceholderText('Add a task…')).toHaveAttribute(
      'maxLength',
      '500',
    )
  })

  it('surfaces a failure and keeps the typed text', async () => {
    const user = userEvent.setup()
    await renderCard([])
    createTodo.mockRejectedValue(new Error('text is required'))
    const input = screen.getByPlaceholderText('Add a task…')

    await user.type(input, 'Write tests')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('text is required')).toBeInTheDocument()
    expect(input).toHaveValue('Write tests')
  })
})

describe('toggling a todo', () => {
  it('checks the box immediately, before the server confirms', async () => {
    /* The optimistic update. Asserting only the settled state would pass even
       with the optimistic update deleted, because the server response produces
       the same end state - so the assertion happens mid-flight. */
    const user = userEvent.setup()
    await renderCard([todo({ text: 'A task', done: false })])
    const pending = deferred()
    updateTodo.mockReturnValue(pending.promise)

    await user.click(checkboxFor('A task'))

    expect(checkboxFor('A task')).toBeChecked()
    expect(updateTodo).toHaveBeenCalledWith(1, { done: true })

    pending.resolve(todo({ done: true }))
    await waitFor(() => expect(checkboxFor('A task')).toBeChecked())
  })

  it('reopens a completed todo', async () => {
    const user = userEvent.setup()
    await renderCard([todo({ done: true })])
    updateTodo.mockResolvedValue(todo({ done: false }))

    await user.click(checkboxFor('A task'))

    expect(updateTodo).toHaveBeenCalledWith(1, { done: false })
  })

  it('adopts the server copy once it arrives', async () => {
    /* The response replaces the optimistic row, so a server-side correction
       wins over what the client guessed. */
    const user = userEvent.setup()
    await renderCard([todo({ id: 1, text: 'A task', done: false })])
    updateTodo.mockResolvedValue(
      todo({ id: 1, text: 'A task (corrected)', done: true }),
    )

    await user.click(checkboxFor('A task'))

    expect(
      await screen.findByRole('button', { name: 'A task (corrected)' }),
    ).toBeInTheDocument()
  })

  it('rolls the checkbox back when the request fails', async () => {
    const user = userEvent.setup()
    await renderCard([todo({ text: 'A task', done: false })])
    const pending = deferred()
    updateTodo.mockReturnValue(pending.promise)

    await user.click(checkboxFor('A task'))
    expect(checkboxFor('A task')).toBeChecked()

    pending.reject(new Error('done must be a boolean'))

    expect(
      await screen.findByText('done must be a boolean'),
    ).toBeInTheDocument()
    await waitFor(() => expect(checkboxFor('A task')).not.toBeChecked())
  })
})

describe('editing a todo', () => {
  /** Open a todo's inline editor, found by its accessible name. */
  async function openEditor(user, text) {
    await user.click(screen.getByRole('button', { name: text }))
    return screen.getByRole('textbox', { name: `Edit "${text}"` })
  }

  it('opens an editor seeded with the current text', async () => {
    const user = userEvent.setup()
    await renderCard([todo({ text: 'A task' })])

    const editor = await openEditor(user, 'A task')

    expect(editor).toHaveValue('A task')
  })

  it('caps the editor at the length the API accepts', async () => {
    const user = userEvent.setup()
    await renderCard([todo({ text: 'A task' })])

    const editor = await openEditor(user, 'A task')

    expect(editor).toHaveAttribute('maxLength', '500')
  })

  it('commits the edit on Enter', async () => {
    const user = userEvent.setup()
    await renderCard([todo({ text: 'A task' })])
    updateTodo.mockResolvedValue(todo({ text: 'Edited' }))

    const editor = await openEditor(user, 'A task')
    await user.clear(editor)
    await user.type(editor, 'Edited{Enter}')

    expect(updateTodo).toHaveBeenCalledWith(1, { text: 'Edited' })
    expect(
      await screen.findByRole('button', { name: 'Edited' }),
    ).toBeInTheDocument()
  })

  it('trims whitespace from the edited text', async () => {
    const user = userEvent.setup()
    await renderCard([todo({ text: 'A task' })])
    updateTodo.mockResolvedValue(todo({ text: 'Edited' }))

    const editor = await openEditor(user, 'A task')
    await user.clear(editor)
    await user.type(editor, '   Edited   {Enter}')

    expect(updateTodo).toHaveBeenCalledWith(1, { text: 'Edited' })
  })

  it('abandons the edit on Escape', async () => {
    const user = userEvent.setup()
    await renderCard([todo({ text: 'A task' })])

    const editor = await openEditor(user, 'A task')
    await user.type(editor, ' changed{Escape}')

    expect(updateTodo).not.toHaveBeenCalled()
    expect(
      await screen.findByRole('button', { name: 'A task' }),
    ).toBeInTheDocument()
  })

  it('discards an edit that empties the text', async () => {
    const user = userEvent.setup()
    await renderCard([todo({ text: 'A task' })])

    const editor = await openEditor(user, 'A task')
    await user.clear(editor)
    await user.keyboard('{Enter}')

    expect(updateTodo).not.toHaveBeenCalled()
    expect(
      await screen.findByRole('button', { name: 'A task' }),
    ).toBeInTheDocument()
  })

  it('commits the edit when the editor loses focus', async () => {
    const user = userEvent.setup()
    await renderCard([todo({ text: 'A task' })])
    updateTodo.mockResolvedValue(todo({ text: 'A taskEdited' }))

    const editor = await openEditor(user, 'A task')
    await user.type(editor, 'Edited')
    await user.tab()

    await waitFor(() =>
      expect(updateTodo).toHaveBeenCalledWith(1, { text: 'A taskEdited' }),
    )
  })

  it('surfaces a failed edit', async () => {
    const user = userEvent.setup()
    await renderCard([todo({ text: 'A task' })])
    updateTodo.mockRejectedValue(new Error('text must be a non-empty string'))

    const editor = await openEditor(user, 'A task')
    await user.type(editor, '!{Enter}')

    expect(
      await screen.findByText('text must be a non-empty string'),
    ).toBeInTheDocument()
  })
})

describe('deleting a todo', () => {
  it('removes the todo from the list', async () => {
    const user = userEvent.setup()
    await renderCard([
      todo({ id: 1, text: 'First' }),
      todo({ id: 2, text: 'Second' }),
    ])
    deleteTodo.mockResolvedValue(undefined)

    await user.click(screen.getByRole('button', { name: 'Delete "First"' }))

    expect(deleteTodo).toHaveBeenCalledWith(1)
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'First' }),
      ).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Second' })).toBeInTheDocument()
  })

  it('keeps the todo and shows an error when deletion fails', async () => {
    const user = userEvent.setup()
    await renderCard([todo({ text: 'A task' })])
    deleteTodo.mockRejectedValue(new Error('Todo not found'))

    await user.click(screen.getByRole('button', { name: 'Delete "A task"' }))

    expect(await screen.findByText('Todo not found')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'A task' })).toBeInTheDocument()
  })

  it('deletes the row being edited without committing its edit first', async () => {
    /* Pressing Delete would otherwise blur the open editor, committing an edit
       the user never made against the row being deleted. */
    const user = userEvent.setup()
    await renderCard([todo({ id: 1, text: 'A task' })])
    deleteTodo.mockResolvedValue(undefined)

    await user.click(screen.getByRole('button', { name: 'A task' }))
    expect(
      screen.getByRole('textbox', { name: 'Edit "A task"' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete "A task"' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('textbox', { name: 'Edit "A task"' }),
      ).not.toBeInTheDocument(),
    )
    expect(updateTodo).not.toHaveBeenCalled()
  })
})
