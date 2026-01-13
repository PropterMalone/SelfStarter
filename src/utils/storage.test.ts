import { describe, it, expect } from 'vitest'
import { saveSession, getSession, clearSession } from './storage'
import type { BlueskySession } from '../types'

const mockSession: BlueskySession = {
  did: 'did:plc:test123',
  handle: 'test.bsky.social',
  accessJwt: 'access-token-123',
  refreshJwt: 'refresh-token-123',
}

describe('storage', () => {
  describe('saveSession', () => {
    it('saves session to chrome storage', async () => {
      await saveSession(mockSession)
      const retrieved = await getSession()
      expect(retrieved).toEqual(mockSession)
    })
  })

  describe('getSession', () => {
    it('returns null when no session exists', async () => {
      const session = await getSession()
      expect(session).toBeNull()
    })

    it('returns session when it exists', async () => {
      await saveSession(mockSession)
      const session = await getSession()
      expect(session).toEqual(mockSession)
    })

    it('returns null for invalid session data', async () => {
      // Directly set invalid data
      await chrome.storage.local.set({ bluesky_session: { invalid: 'data' } })
      const session = await getSession()
      expect(session).toBeNull()
    })

    it('returns null for empty session', async () => {
      await chrome.storage.local.set({ bluesky_session: {} })
      const session = await getSession()
      expect(session).toBeNull()
    })
  })

  describe('clearSession', () => {
    it('removes session from storage', async () => {
      await saveSession(mockSession)
      await clearSession()
      const session = await getSession()
      expect(session).toBeNull()
    })

    it('does not throw when no session exists', async () => {
      await expect(clearSession()).resolves.not.toThrow()
    })
  })
})
