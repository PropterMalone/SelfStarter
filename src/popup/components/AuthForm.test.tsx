import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthForm } from './AuthForm'

describe('OAuth login form', () => {
  it('collects only a handle and explains authorization redirect', async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <AuthForm onLogin={onLogin} onLogout={vi.fn()} isAuthenticated={false} />
    )
    expect(container.querySelector('input[type="password"]')).toBeNull()
    expect(screen.getByText(/redirect.*account.*server/i)).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '@test.example' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith('test.example'))
  })
  it('blocks login until initialization finishes', () => {
    render(<AuthForm onLogin={vi.fn()} onLogout={vi.fn()} isAuthenticated={false} isInitializing />)
    expect(screen.getByRole('status')).toHaveTextContent(/checking/i)
    expect(screen.queryByRole('textbox')).toBeNull()
  })
  it('handles rejected login without an unhandled promise', async () => {
    render(
      <AuthForm
        onLogin={vi.fn().mockRejectedValue(new Error('offline'))}
        onLogout={vi.fn()}
        isAuthenticated={false}
      />
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test.example' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/sign in/i))
  })
  it('calls logout explicitly', () => {
    const onLogout = vi.fn()
    render(
      <AuthForm
        onLogin={vi.fn()}
        onLogout={onLogout}
        isAuthenticated
        currentHandle="test.example"
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /logout/i }))
    expect(onLogout).toHaveBeenCalledOnce()
  })
})
