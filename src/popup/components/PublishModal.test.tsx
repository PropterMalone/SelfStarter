import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PublishModal } from './PublishModal'

const defaultProps = {
  selectedCount: 50,
  handle: 'testuser.bsky.social',
  period: '30d' as const,
  onPublish: vi.fn(),
  onCancel: vi.fn(),
  isPublishing: false,
}

describe('PublishModal', () => {
  it('renders modal with form', () => {
    render(<PublishModal {...defaultProps} />)

    expect(screen.getByText('Create Starter Pack')).toBeInTheDocument()
    expect(screen.getByLabelText('Name *')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('shows selected count', () => {
    render(<PublishModal {...defaultProps} selectedCount={75} />)

    expect(screen.getByText('75 users will be added')).toBeInTheDocument()
  })

  it('generates default name from handle', () => {
    render(<PublishModal {...defaultProps} handle="proptermalone.bsky.social" />)

    const nameInput = screen.getByLabelText('Name *') as HTMLInputElement
    expect(nameInput.value).toBe("proptermalone's interlocutors")
  })

  it('generates default description with count and period', () => {
    render(
      <PublishModal {...defaultProps} handle="proptermalone.bsky.social" selectedCount={50} period="30d" />
    )

    const descriptionInput = screen.getByLabelText('Description') as HTMLTextAreaElement
    expect(descriptionInput.value).toContain('The 50 accounts Proptermalone interacted with the most')
    expect(descriptionInput.value).toContain('last 30 days')
  })

  it('handles different time periods in description', () => {
    render(<PublishModal {...defaultProps} period="7d" />)

    const descriptionInput = screen.getByLabelText('Description') as HTMLTextAreaElement
    expect(descriptionInput.value).toContain('last 7 days')
  })

  it('handles all time period in description', () => {
    render(<PublishModal {...defaultProps} period="all" />)

    const descriptionInput = screen.getByLabelText('Description') as HTMLTextAreaElement
    expect(descriptionInput.value).toContain('all time')
  })

  it('calls onPublish with name and description', () => {
    const onPublish = vi.fn()
    render(<PublishModal {...defaultProps} onPublish={onPublish} />)

    fireEvent.change(screen.getByLabelText('Name *'), {
      target: { value: 'My Starter Pack' },
    })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'A great collection of accounts' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(onPublish).toHaveBeenCalledWith('My Starter Pack', 'A great collection of accounts')
  })

  it('trims whitespace from inputs', () => {
    const onPublish = vi.fn()
    render(<PublishModal {...defaultProps} onPublish={onPublish} />)

    fireEvent.change(screen.getByLabelText('Name *'), {
      target: { value: '  My Pack  ' },
    })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: '  Description  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(onPublish).toHaveBeenCalledWith('My Pack', 'Description')
  })

  it('calls onCancel when cancel clicked', () => {
    const onCancel = vi.fn()
    render(<PublishModal {...defaultProps} onCancel={onCancel} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalled()
  })

  it('create button is enabled with default name', () => {
    render(<PublishModal {...defaultProps} />)

    // Default name is generated, so button should be enabled
    expect(screen.getByRole('button', { name: 'Create' })).not.toBeDisabled()
  })

  it('disables create button when name is cleared', () => {
    render(<PublishModal {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Name *'), {
      target: { value: '' },
    })

    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
  })

  it('shows Creating... when publishing', () => {
    render(<PublishModal {...defaultProps} isPublishing={true} />)

    expect(screen.getByRole('button', { name: 'Creating...' })).toBeInTheDocument()
  })

  it('disables inputs while publishing', () => {
    render(<PublishModal {...defaultProps} isPublishing={true} />)

    expect(screen.getByLabelText('Name *')).toBeDisabled()
    expect(screen.getByLabelText('Description')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })
})
