import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SelectionBar } from './SelectionBar'

describe('SelectionBar', () => {
  it('displays selected count', () => {
    render(
      <SelectionBar
        selectedCount={42}
        onPublish={vi.fn()}
        isAuthenticated={true}
        isPublishing={false}
      />
    )

    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('/ 150 selected')).toBeInTheDocument()
  })

  it('shows Publish button when authenticated', () => {
    render(
      <SelectionBar
        selectedCount={50}
        onPublish={vi.fn()}
        isAuthenticated={true}
        isPublishing={false}
      />
    )

    expect(screen.getByRole('button', { name: 'Review' })).toBeInTheDocument()
  })

  it('shows Login to Publish when not authenticated', () => {
    render(
      <SelectionBar
        selectedCount={50}
        onPublish={vi.fn()}
        isAuthenticated={false}
        isPublishing={false}
      />
    )

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '#publishing-account'
    )
  })

  it('does not offer a publish action when signed out', () => {
    render(
      <SelectionBar
        selectedCount={50}
        onPublish={vi.fn()}
        isAuthenticated={false}
        isPublishing={false}
      />
    )

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('disables button when no users selected', () => {
    render(
      <SelectionBar
        selectedCount={0}
        onPublish={vi.fn()}
        isAuthenticated={true}
        isPublishing={false}
      />
    )

    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('disables button when over 150 selected', () => {
    render(
      <SelectionBar
        selectedCount={160}
        onPublish={vi.fn()}
        isAuthenticated={true}
        isPublishing={false}
      />
    )

    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('shows over limit warning when count exceeds 150', () => {
    render(
      <SelectionBar
        selectedCount={160}
        onPublish={vi.fn()}
        isAuthenticated={true}
        isPublishing={false}
      />
    )

    expect(screen.getByText(/10 over limit/)).toBeInTheDocument()
  })

  it('applies red color to count when over limit', () => {
    render(
      <SelectionBar
        selectedCount={160}
        onPublish={vi.fn()}
        isAuthenticated={true}
        isPublishing={false}
      />
    )

    const countElement = screen.getByText('160')
    expect(countElement.parentElement).toHaveClass('limit-error')
  })

  it('calls onPublish when button clicked', () => {
    const onPublish = vi.fn()
    render(
      <SelectionBar
        selectedCount={50}
        onPublish={onPublish}
        isAuthenticated={true}
        isPublishing={false}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Review' }))

    expect(onPublish).toHaveBeenCalled()
  })

  it('shows Publishing... text when publishing', () => {
    render(
      <SelectionBar
        selectedCount={50}
        onPublish={vi.fn()}
        isAuthenticated={true}
        isPublishing={true}
      />
    )

    expect(screen.getByRole('button', { name: 'Publishing...' })).toBeInTheDocument()
  })

  it('disables button while publishing', () => {
    render(
      <SelectionBar
        selectedCount={50}
        onPublish={vi.fn()}
        isAuthenticated={true}
        isPublishing={true}
      />
    )

    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('enables button at exactly 150 selected', () => {
    render(
      <SelectionBar
        selectedCount={150}
        onPublish={vi.fn()}
        isAuthenticated={true}
        isPublishing={false}
      />
    )

    expect(screen.getByRole('button')).not.toBeDisabled()
  })
})
