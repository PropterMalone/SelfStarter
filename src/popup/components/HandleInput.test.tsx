import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HandleInput } from './HandleInput'

const defaultProps = {
  onAnalyze: vi.fn(),
  isLoading: false,
  handle: 'testuser.bsky.social',
}

describe('HandleInput', () => {
  it('renders handle display and period selector', () => {
    render(<HandleInput {...defaultProps} />)

    expect(screen.getByText('@testuser.bsky.social')).toBeInTheDocument()
    expect(screen.getByLabelText('Time Period')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analyze My Interactions' })).toBeInTheDocument()
  })

  it('displays the logged-in user handle', () => {
    render(<HandleInput {...defaultProps} handle="myuser.bsky.social" />)

    expect(screen.getByText('@myuser.bsky.social')).toBeInTheDocument()
  })

  it('calls onAnalyze with handle and period on submit', () => {
    const onAnalyze = vi.fn()
    render(<HandleInput {...defaultProps} onAnalyze={onAnalyze} />)

    fireEvent.change(screen.getByLabelText('Time Period'), {
      target: { value: '7d' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Analyze My Interactions' }))

    expect(onAnalyze).toHaveBeenCalledWith('testuser.bsky.social', '7d')
  })

  it('disables select and shows loading state when isLoading', () => {
    render(<HandleInput {...defaultProps} isLoading={true} />)

    expect(screen.getByLabelText('Time Period')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Analyzing...' })).toBeDisabled()
  })

  it('defaults to 30d period', () => {
    render(<HandleInput {...defaultProps} />)

    expect(screen.getByLabelText('Time Period')).toHaveValue('30d')
  })

  it('includes all time period options', () => {
    render(<HandleInput {...defaultProps} />)

    const select = screen.getByLabelText('Time Period')
    expect(select).toContainHTML('<option value="7d">7 days</option>')
    expect(select).toContainHTML('<option value="30d">30 days</option>')
    expect(select).toContainHTML('<option value="90d">90 days</option>')
    expect(select).toContainHTML('<option value="1y">1 year</option>')
    expect(select).toContainHTML('<option value="all">All time</option>')
  })

  it('uses provided handle in onAnalyze call', () => {
    const onAnalyze = vi.fn()
    render(<HandleInput {...defaultProps} onAnalyze={onAnalyze} handle="specific.user.social" />)

    fireEvent.click(screen.getByRole('button', { name: 'Analyze My Interactions' }))

    expect(onAnalyze).toHaveBeenCalledWith('specific.user.social', '30d')
  })
})
