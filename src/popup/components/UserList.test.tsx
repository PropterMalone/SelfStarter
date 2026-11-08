import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UserList } from './UserList'
import type { InteractionUser } from '../../types'

const createMockUser = (id: string, count = 10): InteractionUser => ({
  did: `did:plc:${id}`,
  handle: `${id}.bsky.social`,
  displayName: `User ${id}`,
  interactionCount: count,
  interactions: { likes: count, replies: 0, reposts: 0, mentions: 0 },
})

describe('UserList', () => {
  it('filters locally without changing selection and rejects oversized bulk selections', () => {
    const onSelectTopN = vi.fn()
    const onSelectAll = vi.fn()
    const users = Array.from({ length: 151 }, (_, index) => createMockUser(String(index)))
    render(
      <UserList
        users={users}
        selectedDids={new Set(['did:plc:1'])}
        onToggle={vi.fn()}
        onSelectAll={onSelectAll}
        onDeselectAll={vi.fn()}
        onSelectTopN={onSelectTopN}
      />
    )
    expect(screen.getByRole('button', { name: 'All' })).toBeDisabled()
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '151' } })
    expect(screen.getByRole('button', { name: 'Go' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSelectTopN).not.toHaveBeenCalled()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter profiles' }), {
      target: { value: '1.bsky' },
    })
    expect(screen.getAllByRole('checkbox', { name: /^Select @/ }).length).toBeLessThan(151)
    expect(screen.getByRole('checkbox', { name: 'Select @1.bsky.social' })).toBeChecked()
    expect(onSelectAll).not.toHaveBeenCalled()
  })

  it('renders empty state when no users', () => {
    render(
      <UserList
        users={[]}
        selectedDids={new Set()}
        onToggle={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onSelectTopN={vi.fn()}
      />
    )

    expect(screen.getByText(/no accounts yet/i)).toBeInTheDocument()
  })

  it('renders list of users', () => {
    const users = [createMockUser('1'), createMockUser('2'), createMockUser('3')]

    render(
      <UserList
        users={users}
        selectedDids={new Set()}
        onToggle={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onSelectTopN={vi.fn()}
      />
    )

    expect(screen.getByText('User 1')).toBeInTheDocument()
    expect(screen.getByText('User 2')).toBeInTheDocument()
    expect(screen.getByText('User 3')).toBeInTheDocument()
  })

  it('shows user count', () => {
    const users = [createMockUser('1'), createMockUser('2')]

    render(
      <UserList
        users={users}
        selectedDids={new Set()}
        onToggle={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onSelectTopN={vi.fn()}
      />
    )

    expect(screen.getByText('2 users found')).toBeInTheDocument()
  })

  it('calls onToggle when user row clicked', () => {
    const users = [createMockUser('test')]
    const onToggle = vi.fn()

    render(
      <UserList
        users={users}
        selectedDids={new Set()}
        onToggle={onToggle}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onSelectTopN={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('User test'))

    expect(onToggle).toHaveBeenCalledWith('did:plc:test')
  })

  it('calls onSelectAll when select all clicked', () => {
    const users = [createMockUser('1')]
    const onSelectAll = vi.fn()

    render(
      <UserList
        users={users}
        selectedDids={new Set()}
        onToggle={vi.fn()}
        onSelectAll={onSelectAll}
        onDeselectAll={vi.fn()}
        onSelectTopN={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('All'))

    expect(onSelectAll).toHaveBeenCalled()
  })

  it('calls onDeselectAll when deselect all clicked', () => {
    const users = [createMockUser('1')]
    const onDeselectAll = vi.fn()

    render(
      <UserList
        users={users}
        selectedDids={new Set(['did:plc:1'])}
        onToggle={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={onDeselectAll}
        onSelectTopN={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('None'))

    expect(onDeselectAll).toHaveBeenCalled()
  })

  it('passes correct isSelected to UserRow', () => {
    const users = [createMockUser('selected'), createMockUser('unselected')]
    const selectedDids = new Set(['did:plc:selected'])

    render(
      <UserList
        users={users}
        selectedDids={selectedDids}
        onToggle={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onSelectTopN={vi.fn()}
      />
    )

    const checkboxes = screen.getAllByRole('checkbox', { name: /^Select @/ })
    expect(checkboxes[0]).toBeChecked()
    expect(checkboxes[1]).not.toBeChecked()
  })

  it('calls onSelectTopN when select top N is clicked', () => {
    const users = [createMockUser('1'), createMockUser('2'), createMockUser('3')]
    const onSelectTopN = vi.fn()

    render(
      <UserList
        users={users}
        selectedDids={new Set()}
        onToggle={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onSelectTopN={onSelectTopN}
      />
    )

    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '2' } })
    fireEvent.click(screen.getByText('Go'))

    expect(onSelectTopN).toHaveBeenCalledWith(2)
  })

  it('does not call onSelectTopN with invalid value', () => {
    const users = [createMockUser('1')]
    const onSelectTopN = vi.fn()

    render(
      <UserList
        users={users}
        selectedDids={new Set()}
        onToggle={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onSelectTopN={onSelectTopN}
      />
    )

    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.click(screen.getByText('Go'))

    expect(onSelectTopN).not.toHaveBeenCalled()
  })
})
