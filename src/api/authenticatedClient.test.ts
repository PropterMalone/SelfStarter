import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthenticatedClient } from './authenticatedClient'
import type { BlueskySession } from '../types'

const mockFetch = vi.fn()
global.fetch = mockFetch

const mockSession: BlueskySession = {
  did: 'did:plc:abc123',
  handle: 'user.bsky.social',
  accessJwt: 'access-jwt',
  refreshJwt: 'refresh-jwt',
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('AuthenticatedClient', () => {
  describe('post', () => {
    it('makes authenticated POST request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ uri: 'at://...' }),
      })

      const onSessionUpdate = vi.fn()
      const client = new AuthenticatedClient(mockSession, onSessionUpdate)
      const result = await client.post('com.atproto.repo.createRecord', { foo: 'bar' })

      expect(result).toEqual({ uri: 'at://...' })
      expect(mockFetch).toHaveBeenCalledWith(
        'https://bsky.social/xrpc/com.atproto.repo.createRecord',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer access-jwt',
          }),
          body: JSON.stringify({ foo: 'bar' }),
        })
      )
      expect(onSessionUpdate).not.toHaveBeenCalled()
    })

    it('refreshes token and retries on 401', async () => {
      // First call fails with 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'ExpiredToken', message: 'Token expired' }),
      })

      // Refresh succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            did: 'did:plc:abc123',
            handle: 'user.bsky.social',
            accessJwt: 'new-access-jwt',
            refreshJwt: 'new-refresh-jwt',
          }),
      })

      // Retry succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ uri: 'at://...' }),
      })

      const onSessionUpdate = vi.fn()
      const client = new AuthenticatedClient(mockSession, onSessionUpdate)
      const result = await client.post('com.atproto.repo.createRecord', { foo: 'bar' })

      expect(result).toEqual({ uri: 'at://...' })
      expect(mockFetch).toHaveBeenCalledTimes(3)

      // Verify refresh was called with refreshJwt
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://bsky.social/xrpc/com.atproto.server.refreshSession',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer refresh-jwt',
          }),
        })
      )

      // Verify retry used new access token
      expect(mockFetch).toHaveBeenNthCalledWith(
        3,
        'https://bsky.social/xrpc/com.atproto.repo.createRecord',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer new-access-jwt',
          }),
        })
      )

      // Verify session was updated
      expect(onSessionUpdate).toHaveBeenCalledWith({
        did: 'did:plc:abc123',
        handle: 'user.bsky.social',
        accessJwt: 'new-access-jwt',
        refreshJwt: 'new-refresh-jwt',
      })
    })

    it('throws user-friendly error when refresh fails', async () => {
      // First call fails with 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'ExpiredToken', message: 'Token expired' }),
      })

      // Refresh also fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'ExpiredToken', message: 'Refresh token expired' }),
      })

      const onSessionUpdate = vi.fn()
      const client = new AuthenticatedClient(mockSession, onSessionUpdate)

      await expect(client.post('com.atproto.repo.createRecord', { foo: 'bar' })).rejects.toThrow(
        'Session expired. Please log in again.'
      )
      expect(onSessionUpdate).not.toHaveBeenCalled()
    })
  })

  describe('get', () => {
    it('makes authenticated GET request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      })

      const onSessionUpdate = vi.fn()
      const client = new AuthenticatedClient(mockSession, onSessionUpdate)
      const result = await client.get('app.bsky.graph.getStarterPack', { starterPack: 'at://...' })

      expect(result).toEqual({ data: 'test' })
      expect(mockFetch).toHaveBeenCalledWith(
        'https://bsky.social/xrpc/app.bsky.graph.getStarterPack?starterPack=at%3A%2F%2F...',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer access-jwt',
          }),
        })
      )
    })

    it('refreshes token and retries on 401 for GET', async () => {
      // First call fails with 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'ExpiredToken', message: 'Token expired' }),
      })

      // Refresh succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            did: 'did:plc:abc123',
            handle: 'user.bsky.social',
            accessJwt: 'new-access-jwt',
            refreshJwt: 'new-refresh-jwt',
          }),
      })

      // Retry succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      })

      const onSessionUpdate = vi.fn()
      const client = new AuthenticatedClient(mockSession, onSessionUpdate)
      const result = await client.get('app.bsky.graph.getStarterPack')

      expect(result).toEqual({ data: 'test' })
      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(onSessionUpdate).toHaveBeenCalled()
    })
  })

  describe('getSession', () => {
    it('returns current session', () => {
      const client = new AuthenticatedClient(mockSession, vi.fn())
      expect(client.getSession()).toEqual(mockSession)
    })

    it('returns updated session after refresh', async () => {
      // First call fails with 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'ExpiredToken', message: 'Token expired' }),
      })

      // Refresh succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            did: 'did:plc:abc123',
            handle: 'user.bsky.social',
            accessJwt: 'new-access-jwt',
            refreshJwt: 'new-refresh-jwt',
          }),
      })

      // Retry succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ uri: 'at://...' }),
      })

      const client = new AuthenticatedClient(mockSession, vi.fn())
      await client.post('com.atproto.repo.createRecord')

      expect(client.getSession().accessJwt).toBe('new-access-jwt')
      expect(client.getSession().refreshJwt).toBe('new-refresh-jwt')
    })
  })
})
