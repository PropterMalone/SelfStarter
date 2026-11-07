import { beforeEach, describe, expect, it, vi } from 'vitest'
import { publicGet, BlueskyApiError } from './client'
const mockFetch = vi.fn()
beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
})
describe('public API client', () => {
  it('forwards an optional abort signal without changing unauthenticated requests', async () => {
    mockFetch.mockResolvedValue(new Response('{}'))
    const signal = new AbortController().signal
    await publicGet('app.bsky.actor.getProfile', { actor: 'did:plc:test' }, signal)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=did%3Aplc%3Atest',
      { signal }
    )
  })
  it('reads public profiles without authentication and encodes repeated parameters', async () => {
    mockFetch.mockResolvedValue(new Response('{}'))
    await publicGet('app.bsky.actor.getProfiles', {
      actors: ['did:plc:a', 'did:plc:b'],
      missing: undefined,
    })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://public.api.bsky.app/xrpc/app.bsky.actor.getProfiles?actors=did%3Aplc%3Aa&actors=did%3Aplc%3Ab'
    )
  })
  it('uses the public PDS endpoint for handle resolution', async () => {
    mockFetch.mockResolvedValue(new Response('{}'))
    await publicGet('com.atproto.identity.resolveHandle', { handle: 'test.example' })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=test.example'
    )
  })
  it('surfaces HTTP errors', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Missing', message: 'Not found' }), { status: 404 })
    )
    await expect(publicGet('app.bsky.actor.getProfile')).rejects.toBeInstanceOf(BlueskyApiError)
  })
  it('handles non-JSON errors', async () => {
    mockFetch.mockResolvedValue(new Response('offline', { status: 503, statusText: 'Unavailable' }))
    await expect(publicGet('app.bsky.actor.getProfile')).rejects.toThrow('Unavailable')
  })
})
