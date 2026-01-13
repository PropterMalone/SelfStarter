import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSession, refreshSession } from './auth'

const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
})

describe('createSession', () => {
  it('creates session with identifier and password', async () => {
    const mockResponse = {
      did: 'did:plc:abc123',
      handle: 'user.bsky.social',
      accessJwt: 'access-jwt',
      refreshJwt: 'refresh-jwt',
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    })

    const session = await createSession('user.bsky.social', 'app-password')

    expect(session).toEqual({
      did: 'did:plc:abc123',
      handle: 'user.bsky.social',
      accessJwt: 'access-jwt',
      refreshJwt: 'refresh-jwt',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://bsky.social/xrpc/com.atproto.server.createSession',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          identifier: 'user.bsky.social',
          password: 'app-password',
        }),
      })
    )
  })

  it('throws on invalid credentials', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({
        error: 'AuthenticationRequired',
        message: 'Invalid identifier or password',
      }),
    })

    await expect(createSession('user', 'wrong')).rejects.toThrow('Invalid identifier or password')
  })
})

describe('refreshSession', () => {
  it('refreshes session with refresh token', async () => {
    const mockResponse = {
      did: 'did:plc:abc123',
      handle: 'user.bsky.social',
      accessJwt: 'new-access-jwt',
      refreshJwt: 'new-refresh-jwt',
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    })

    const session = await refreshSession('old-refresh-jwt')

    expect(session).toEqual({
      did: 'did:plc:abc123',
      handle: 'user.bsky.social',
      accessJwt: 'new-access-jwt',
      refreshJwt: 'new-refresh-jwt',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://bsky.social/xrpc/com.atproto.server.refreshSession',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer old-refresh-jwt',
        }),
      })
    )
  })

  it('throws on expired refresh token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve({
        error: 'ExpiredToken',
        message: 'Token has expired',
      }),
    })

    await expect(refreshSession('expired-token')).rejects.toThrow('Token has expired')
  })
})
