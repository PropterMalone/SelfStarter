import { useState, useEffect, useCallback } from 'react'
import type { BlueskySession } from '../../types'
import { createSession } from '../../api/auth'
import { saveSession, getSession, clearSession } from '../../utils/storage'

interface UseBlueskyAuthReturn {
  session: BlueskySession | null
  isLoading: boolean
  error: string | null
  login: (handle: string, appPassword: string) => Promise<void>
  logout: () => Promise<void>
}

export function useBlueskyAuth(): UseBlueskyAuthReturn {
  const [session, setSession] = useState<BlueskySession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSession()
      .then((saved) => {
        if (saved) {
          setSession(saved)
        }
      })
      .catch(() => {
        // Storage error, ignore
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const login = useCallback(async (handle: string, appPassword: string) => {
    setError(null)
    try {
      const newSession = await createSession(handle, appPassword)
      await saveSession(newSession)
      setSession(newSession)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    await clearSession()
    setSession(null)
    setError(null)
  }, [])

  return { session, isLoading, error, login, logout }
}
