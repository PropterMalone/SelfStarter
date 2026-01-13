import { useState } from 'react'

interface AuthFormProps {
  onLogin: (handle: string, appPassword: string) => Promise<void>
  onLogout: () => void
  isAuthenticated: boolean
  currentHandle?: string
  error?: string
}

export function AuthForm({ onLogin, onLogout, isAuthenticated, currentHandle, error }: AuthFormProps) {
  const [handle, setHandle] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await onLogin(handle.trim().replace(/^@/, ''), appPassword)
      setHandle('')
      setAppPassword('')
    } finally {
      setIsLoading(false)
    }
  }

  if (isAuthenticated && currentHandle) {
    return (
      <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-sm text-green-700">
            Logged in as <strong>@{currentHandle}</strong>
          </span>
        </div>
        <button
          onClick={onLogout}
          className="text-sm text-green-700 hover:text-green-900 underline"
        >
          Logout
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-3 bg-gray-50 rounded-md">
      <div className="text-sm font-medium text-gray-700">
        Login to publish starter packs
      </div>
      {error && (
        <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
      <input
        type="text"
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        placeholder="Handle (e.g., user.bsky.social)"
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
        disabled={isLoading}
      />
      <input
        type="password"
        value={appPassword}
        onChange={(e) => setAppPassword(e.target.value)}
        placeholder="App Password"
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
        disabled={isLoading}
      />
      <div className="flex items-center justify-between">
        <a
          href="https://bsky.app/settings/app-passwords"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:underline"
        >
          Create App Password
        </a>
        <button
          type="submit"
          disabled={isLoading || !handle.trim() || !appPassword}
          className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      </div>
    </form>
  )
}
