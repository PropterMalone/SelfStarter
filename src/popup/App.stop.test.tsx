import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { App } from './App'

const state = vi.hoisted(() => ({ isLoading: true, cancel: vi.fn() }))
vi.mock('./hooks', () => ({
  useBlueskyAuth: () => ({ session: null, isLoading: false, error: null }),
  useInteractions: () => ({
    users: [],
    isLoading: state.isLoading,
    error: null,
    progress: state.isLoading ? 'Fetching profiles: 5020 / 5021 (100%)' : null,
    analyze: vi.fn(),
    reset: vi.fn(),
    cancel: state.cancel,
  }),
  useStarterPack: () => ({ isPublishing: false, publishedUrl: null, error: null, reset: vi.fn() }),
}))
vi.mock('./components', () => ({
  AuthForm: () => null,
  HandleInput: () => null,
  WeightsPanel: () => null,
  SelectionBar: () => null,
  UserList: () => null,
  PublishModal: () => null,
}))

beforeEach(() => {
  sessionStorage.clear()
  state.isLoading = true
  state.cancel.mockClear()
})

it('shows profile progress and dispatches Stop to analysis cancellation', () => {
  render(<App />)
  expect(screen.getByText('Fetching profiles: 5020 / 5021 (100%)')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
  expect(state.cancel).toHaveBeenCalledOnce()
})

it('does not show Stop when analysis is idle', () => {
  state.isLoading = false
  render(<App />)
  expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull()
})
