import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UserRow } from './UserRow'
import type { InteractionUser } from '../../types'

const mockUser: InteractionUser = {
  did: 'did:plc:test123',
  handle: 'test.bsky.social',
  displayName: 'Test User',
  avatar: 'https://example.com/avatar.jpg',
  interactionCount: 42,
  interactions: { likes: 20, replies: 10, reposts: 8, mentions: 4 },
}

describe('UserRow', () => {
  it('renders user info', () => {
    render(<UserRow user={mockUser} isSelected={false} onToggle={vi.fn()} />)

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('@test.bsky.social')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('interactions')).toBeInTheDocument()
  })

  it('shows avatar image', () => {
    const { container } = render(<UserRow user={mockUser} isSelected={false} onToggle={vi.fn()} />)

    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg')
  })

  it('shows default avatar when none provided', () => {
    const userNoAvatar = { ...mockUser, avatar: undefined }
    const { container } = render(<UserRow user={userNoAvatar} isSelected={false} onToggle={vi.fn()} />)

    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toContain('default-avatar')
  })

  it('falls back to handle when no display name', () => {
    const userNoName = { ...mockUser, displayName: undefined }
    render(<UserRow user={userNoName} isSelected={false} onToggle={vi.fn()} />)

    const handleElements = screen.getAllByText(/test.bsky.social/)
    expect(handleElements.length).toBeGreaterThanOrEqual(1)
  })

  it('checkbox reflects isSelected prop', () => {
    const { rerender } = render(
      <UserRow user={mockUser} isSelected={false} onToggle={vi.fn()} />
    )

    expect(screen.getByRole('checkbox')).not.toBeChecked()

    rerender(<UserRow user={mockUser} isSelected={true} onToggle={vi.fn()} />)

    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('calls onToggle when checkbox clicked', () => {
    const onToggle = vi.fn()
    render(<UserRow user={mockUser} isSelected={false} onToggle={onToggle} />)

    fireEvent.click(screen.getByRole('checkbox'))

    expect(onToggle).toHaveBeenCalledWith('did:plc:test123')
  })

  it('calls onToggle when row clicked', () => {
    const onToggle = vi.fn()
    render(<UserRow user={mockUser} isSelected={false} onToggle={onToggle} />)

    fireEvent.click(screen.getByText('Test User'))

    expect(onToggle).toHaveBeenCalledWith('did:plc:test123')
  })

  it('does not double-toggle when checkbox clicked directly', () => {
    const onToggle = vi.fn()
    render(<UserRow user={mockUser} isSelected={false} onToggle={onToggle} />)

    fireEvent.click(screen.getByRole('checkbox'))

    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
