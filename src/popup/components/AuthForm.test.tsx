import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AuthForm } from './AuthForm'

describe('AuthForm', () => {
  it('renders login form when not authenticated', () => {
    render(
      <AuthForm
        onLogin={vi.fn()}
        onLogout={vi.fn()}
        isAuthenticated={false}
      />
    )

    expect(screen.getByPlaceholderText(/handle/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/app password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
  })

  it('shows logged in state when authenticated', () => {
    render(
      <AuthForm
        onLogin={vi.fn()}
        onLogout={vi.fn()}
        isAuthenticated={true}
        currentHandle="test.bsky.social"
      />
    )

    expect(screen.getByText(/logged in as/i)).toBeInTheDocument()
    expect(screen.getByText(/@test.bsky.social/)).toBeInTheDocument()
    expect(screen.getByText('Logout')).toBeInTheDocument()
  })

  it('calls onLogin with handle and password', async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined)
    render(
      <AuthForm
        onLogin={onLogin}
        onLogout={vi.fn()}
        isAuthenticated={false}
      />
    )

    fireEvent.change(screen.getByPlaceholderText(/handle/i), {
      target: { value: 'user.bsky.social' },
    })
    fireEvent.change(screen.getByPlaceholderText(/app password/i), {
      target: { value: 'secret-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith('user.bsky.social', 'secret-password')
    })
  })

  it('strips @ from handle', async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined)
    render(
      <AuthForm
        onLogin={onLogin}
        onLogout={vi.fn()}
        isAuthenticated={false}
      />
    )

    fireEvent.change(screen.getByPlaceholderText(/handle/i), {
      target: { value: '@user.bsky.social' },
    })
    fireEvent.change(screen.getByPlaceholderText(/app password/i), {
      target: { value: 'password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith('user.bsky.social', 'password')
    })
  })

  it('calls onLogout when logout clicked', () => {
    const onLogout = vi.fn()
    render(
      <AuthForm
        onLogin={vi.fn()}
        onLogout={onLogout}
        isAuthenticated={true}
        currentHandle="test.bsky.social"
      />
    )

    fireEvent.click(screen.getByText('Logout'))

    expect(onLogout).toHaveBeenCalled()
  })

  it('disables login button when handle is empty', () => {
    render(
      <AuthForm
        onLogin={vi.fn()}
        onLogout={vi.fn()}
        isAuthenticated={false}
      />
    )

    fireEvent.change(screen.getByPlaceholderText(/app password/i), {
      target: { value: 'password' },
    })

    expect(screen.getByRole('button', { name: 'Login' })).toBeDisabled()
  })

  it('disables login button when password is empty', () => {
    render(
      <AuthForm
        onLogin={vi.fn()}
        onLogout={vi.fn()}
        isAuthenticated={false}
      />
    )

    fireEvent.change(screen.getByPlaceholderText(/handle/i), {
      target: { value: 'user.bsky.social' },
    })

    expect(screen.getByRole('button', { name: 'Login' })).toBeDisabled()
  })

  it('displays error message', () => {
    render(
      <AuthForm
        onLogin={vi.fn()}
        onLogout={vi.fn()}
        isAuthenticated={false}
        error="Invalid credentials"
      />
    )

    expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
  })

  it('shows Logging in... during login', async () => {
    const onLogin = vi.fn().mockImplementation(() => new Promise(() => {}))
    render(
      <AuthForm
        onLogin={onLogin}
        onLogout={vi.fn()}
        isAuthenticated={false}
      />
    )

    fireEvent.change(screen.getByPlaceholderText(/handle/i), {
      target: { value: 'user' },
    })
    fireEvent.change(screen.getByPlaceholderText(/app password/i), {
      target: { value: 'pass' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Logging in...' })).toBeDisabled()
    })
  })

  it('includes link to create app password', () => {
    render(
      <AuthForm
        onLogin={vi.fn()}
        onLogout={vi.fn()}
        isAuthenticated={false}
      />
    )

    const link = screen.getByText('Create App Password')
    expect(link).toHaveAttribute('href', 'https://bsky.app/settings/app-passwords')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('clears inputs after successful login', async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined)
    render(
      <AuthForm
        onLogin={onLogin}
        onLogout={vi.fn()}
        isAuthenticated={false}
      />
    )

    const handleInput = screen.getByPlaceholderText(/handle/i)
    const passwordInput = screen.getByPlaceholderText(/app password/i)

    fireEvent.change(handleInput, { target: { value: 'user' } })
    fireEvent.change(passwordInput, { target: { value: 'pass' } })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(handleInput).toHaveValue('')
      expect(passwordInput).toHaveValue('')
    })
  })
})
