import type { BlueskySession } from '../types'

const STORAGE_KEYS = {
  SESSION: 'bluesky_session',
} as const

export async function saveSession(session: BlueskySession): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSION]: session })
}

export async function getSession(): Promise<BlueskySession | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SESSION)
  const session = result[STORAGE_KEYS.SESSION] as BlueskySession | undefined
  if (session && session.did && session.handle && session.accessJwt && session.refreshJwt) {
    return session
  }
  return null
}

export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.SESSION)
}
