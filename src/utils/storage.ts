import type { BlueskySession } from '../types'

const STORAGE_KEYS = {
  SESSION: 'selfstarter_session',
} as const

export async function saveSession(session: BlueskySession): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session))
  } catch {
    // localStorage might be unavailable (private browsing, etc.)
  }
}

export async function getSession(): Promise<BlueskySession | null> {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSION)
    if (!stored) return null

    const session = JSON.parse(stored) as BlueskySession
    if (session && session.did && session.handle && session.accessJwt && session.refreshJwt) {
      return session
    }
  } catch {
    // Invalid JSON or localStorage unavailable
  }
  return null
}

export async function clearSession(): Promise<void> {
  try {
    localStorage.removeItem(STORAGE_KEYS.SESSION)
  } catch {
    // localStorage might be unavailable
  }
}
