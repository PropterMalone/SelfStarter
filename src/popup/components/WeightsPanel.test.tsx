import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WeightsPanel } from './WeightsPanel'
import { DEFAULT_WEIGHTS } from '../../utils/scoring'

describe('WeightsPanel', () => {
  it('renders all weight sliders with labels', () => {
    render(<WeightsPanel weights={DEFAULT_WEIGHTS} onChange={vi.fn()} />)

    expect(screen.getByText('Likes')).toBeInTheDocument()
    expect(screen.getByText('Replies')).toBeInTheDocument()
    expect(screen.getByText('Reposts')).toBeInTheDocument()
    expect(screen.getByText('Mentions')).toBeInTheDocument()
    expect(screen.getByText('Quotes')).toBeInTheDocument()
  })

  it('displays current weight values', () => {
    render(<WeightsPanel weights={DEFAULT_WEIGHTS} onChange={vi.fn()} />)

    expect(screen.getByText('1')).toBeInTheDocument() // likes
    expect(screen.getAllByText('3')).toHaveLength(2) // replies, mentions
    expect(screen.getAllByText('5')).toHaveLength(2) // reposts, quotes
  })

  it('calls onChange with updated weights when slider changes', () => {
    const onChange = vi.fn()
    render(<WeightsPanel weights={DEFAULT_WEIGHTS} onChange={onChange} />)

    const sliders = screen.getAllByRole('slider')
    fireEvent.change(sliders[0], { target: { value: '7' } }) // likes slider

    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_WEIGHTS, likes: 7 })
  })

  it('disables sliders when disabled prop is true', () => {
    render(<WeightsPanel weights={DEFAULT_WEIGHTS} onChange={vi.fn()} disabled />)

    const sliders = screen.getAllByRole('slider')
    sliders.forEach((slider) => {
      expect(slider).toBeDisabled()
    })
  })

  it('renders five sliders', () => {
    render(<WeightsPanel weights={DEFAULT_WEIGHTS} onChange={vi.fn()} />)

    const sliders = screen.getAllByRole('slider')
    expect(sliders).toHaveLength(5)
  })
})
