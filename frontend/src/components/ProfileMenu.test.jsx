import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import ProfileMenu from './ProfileMenu'
import { profileRecord } from '../test/helpers'

const PROFILES = [
  profileRecord({ id: 10, name: 'Default' }),
  profileRecord({ id: 11, name: 'Focus' }),
]

function renderMenu(props = {}) {
  const all = {
    profiles: PROFILES,
    profile: PROFILES[0],
    onSelect: vi.fn(),
    onCreate: vi.fn().mockResolvedValue(undefined),
    onRename: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn(),
    ...props,
  }
  render(<ProfileMenu {...all} />)
  return all
}

/** Open the menu and return the user driving it. */
async function openMenu() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /Control Center/ }))
  return user
}

function menu() {
  return screen.queryByRole('region', { name: 'Profiles' })
}

it("shows the title and the shown profile's name", () => {
  renderMenu({ profile: PROFILES[1] })

  expect(
    screen.getByRole('button', { name: 'Control Center, profile Focus' }),
  ).toHaveAttribute('aria-expanded', 'false')
})

describe('switching', () => {
  it('lists the profiles, marking the one shown', async () => {
    renderMenu()

    await openMenu()

    expect(
      within(menu()).getByRole('button', { name: 'Default' }),
    ).toHaveAttribute('aria-current', 'true')
    expect(
      within(menu()).getByRole('button', { name: 'Focus' }),
    ).not.toHaveAttribute('aria-current')
  })

  it('switches to a profile and closes', async () => {
    const { onSelect } = renderMenu()
    const user = await openMenu()

    await user.click(within(menu()).getByRole('button', { name: 'Focus' }))

    expect(onSelect).toHaveBeenCalledWith(11)
    expect(menu()).not.toBeInTheDocument()
  })

  it('closes on a click outside it', async () => {
    renderMenu()
    const user = await openMenu()

    await user.click(document.body)

    expect(menu()).not.toBeInTheDocument()
  })

  it('backs out of a name field on Escape, then closes on a second', async () => {
    renderMenu()
    const user = await openMenu()
    await user.click(screen.getByRole('button', { name: 'Rename "Focus"' }))

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(menu()).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(menu()).not.toBeInTheDocument()
  })
})

describe('saving as a new profile', () => {
  it('creates one from the typed name, trimmed, and closes', async () => {
    const { onCreate } = renderMenu()
    const user = await openMenu()

    await user.click(
      screen.getByRole('button', { name: 'Save as new profile' }),
    )
    await user.type(
      screen.getByRole('textbox', { name: 'New profile name' }),
      '  Morning  ',
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onCreate).toHaveBeenCalledWith('Morning')
    expect(menu()).not.toBeInTheDocument()
  })

  it('shows why a name was refused and keeps the field open', async () => {
    const { onCreate } = renderMenu()
    onCreate.mockRejectedValue(new Error('Name already in use'))
    const user = await openMenu()

    await user.click(
      screen.getByRole('button', { name: 'Save as new profile' }),
    )
    await user.type(screen.getByRole('textbox'), 'Focus{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Name already in use',
    )
    expect(screen.getByRole('textbox')).toHaveValue('Focus')
  })

  it('cannot save a blank name', async () => {
    renderMenu()
    const user = await openMenu()

    await user.click(
      screen.getByRole('button', { name: 'Save as new profile' }),
    )
    await user.type(screen.getByRole('textbox'), '   ')

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})

describe('renaming and deleting', () => {
  it('renames a profile inline', async () => {
    const { onRename } = renderMenu()
    const user = await openMenu()

    await user.click(screen.getByRole('button', { name: 'Rename "Focus"' }))
    const field = screen.getByRole('textbox', { name: 'Profile name' })
    await user.clear(field)
    await user.type(field, 'Deep work{Enter}')

    expect(onRename).toHaveBeenCalledWith(11, 'Deep work')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('asks before deleting, then deletes', async () => {
    const { onDelete } = renderMenu()
    const user = await openMenu()

    await user.click(screen.getByRole('button', { name: 'Delete "Focus"' }))

    expect(screen.getByText('Delete “Focus”?')).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onDelete).toHaveBeenCalledWith(11)
  })

  it('cannot delete the last profile', async () => {
    renderMenu({ profiles: [PROFILES[0]] })

    await openMenu()

    expect(
      screen.getByRole('button', { name: 'Delete "Default"' }),
    ).toBeDisabled()
  })
})
