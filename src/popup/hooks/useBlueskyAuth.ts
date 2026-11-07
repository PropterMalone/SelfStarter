// pattern: Imperative Shell
import { useState, useEffect, useCallback, useRef } from 'react'
import type { BlueskySession } from '../../types'
import { initializeAuth, signIn, signOut, onSessionDeleted, authErrorMessage } from '../../api/auth'

export function useBlueskyAuth() {
  const [session, setSession] = useState<BlueskySession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const current = useRef<BlueskySession | null>(null)
  const generation = useRef(0)

  useEffect(() => {
    let active = true
    const version = generation.current
    const unsubscribe = onSessionDeleted((did) => {
      if (current.current?.did !== did) return
      generation.current++
      current.current = null
      setSession(null)
      setError('Your session expired or was revoked. Please sign in again.')
    })
    initializeAuth()
      .then((restored) => {
        if (active && version === generation.current) {
          current.current = restored
          setSession(restored)
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : authErrorMessage(err))
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const login = useCallback(async (handle: string) => {
    setError(null)
    setNotice(null)
    try {
      await signIn(handle)
    } catch (err) {
      setError(err instanceof Error ? err.message : authErrorMessage(err))
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    const previous = current.current
    generation.current++
    current.current = null
    setSession(null)
    setError(null)
    setNotice('Signed out on this device. Manage connected-app access in Bluesky settings.')
    try {
      if (previous) await signOut(previous)
    } catch {
      setError(
        'Signed out locally, but server revocation could not be confirmed. Revoke SelfStarter in your account settings.'
      )
    }
  }, [])

  return { session, isLoading, error, notice, login, logout }
}
