// pattern: Imperative Shell
import { useState } from 'react'

interface AuthFormProps {
  onLogin: (handle: string) => Promise<void>
  onLogout: () => void | Promise<void>
  isAuthenticated: boolean
  isInitializing?: boolean
  currentHandle?: string
  error?: string
}

export function AuthForm({
  onLogin,
  onLogout,
  isAuthenticated,
  isInitializing,
  currentHandle,
  error,
}: AuthFormProps) {
  const [handle, setHandle] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  if (isInitializing) return <p role="status">Checking your sign-in session…</p>
  const failure = error || localError
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setLocalError(null)
    try {
      await onLogin(handle.trim().replace(/^@/, ''))
    } catch {
      setLocalError('Could not sign in. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="auth-form">
      {failure && (
        <p role="alert" className="text-sm text-red-600">
          {failure}
        </p>
      )}
      {isAuthenticated ? (
        <div className="space-y-2">
          <p className="text-sm">
            Signed in as <strong>@{currentHandle}</strong>
          </p>
          <button
            className="text-sm text-blue-600 underline"
            onClick={() => {
              void Promise.resolve(onLogout()).catch(() =>
                setLocalError('Could not sign out. Please try again.')
              )
            }}
          >
            Logout
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm font-medium">Sign in to publish starter packs</p>
          <p className="text-sm text-gray-600">
            We redirect you to your account’s authorization server. SelfStarter never collects your
            password. Public analysis needs no sign in.
          </p>
          <label htmlFor="login-handle" className="block text-sm">
            Your account handle
          </label>
          <input
            id="login-handle"
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="user.bsky.social"
            autoComplete="username"
            disabled={busy}
            required
            className="w-full px-3 py-2 text-sm border rounded-md"
          />
          <button
            type="submit"
            disabled={busy || !handle.trim()}
            className="button button-secondary auth-button"
          >
            {busy ? 'Redirecting…' : 'Sign in with Bluesky'}
          </button>
        </form>
      )}
    </div>
  )
}
