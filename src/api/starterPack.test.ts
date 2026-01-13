import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStarterPack } from './starterPack'
import type { BlueskySession, StarterPackUser } from '../types'

const mockFetch = vi.fn()
global.fetch = mockFetch

const mockSession: BlueskySession = {
  did: 'did:plc:creator',
  handle: 'creator.bsky.social',
  accessJwt: 'access-jwt',
  refreshJwt: 'refresh-jwt',
}

const mockUsers: StarterPackUser[] = [
  { did: 'did:plc:user1', handle: 'user1.bsky.social', displayName: 'User 1' },
  { did: 'did:plc:user2', handle: 'user2.bsky.social', displayName: 'User 2' },
]

beforeEach(() => {
  mockFetch.mockReset()
})

describe('createStarterPack', () => {
  it('creates list and starter pack', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        uri: 'at://did:plc:creator/app.bsky.graph.list/abc123',
        cid: 'cid123',
      }),
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ uri: 'at://item1', cid: 'cid1' }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ uri: 'at://item2', cid: 'cid2' }),
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        uri: 'at://did:plc:creator/app.bsky.graph.starterpack/xyz789',
        cid: 'cid789',
      }),
    })

    const url = await createStarterPack(mockSession, 'Test Pack', 'A test description', mockUsers)

    expect(url).toBe('https://bsky.app/starter-pack/creator.bsky.social/xyz789')
    expect(mockFetch).toHaveBeenCalledTimes(4)
  })

  it('handles user add failure gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        uri: 'at://did:plc:creator/app.bsky.graph.list/abc123',
        cid: 'cid123',
      }),
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ uri: 'at://item1', cid: 'cid1' }),
    })

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ error: 'InvalidSubject' }),
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        uri: 'at://did:plc:creator/app.bsky.graph.starterpack/xyz789',
        cid: 'cid789',
      }),
    })

    const url = await createStarterPack(mockSession, 'Test Pack', undefined, mockUsers)
    expect(url).toContain('bsky.app/starter-pack')
  })

  it('creates pack with single user', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ uri: 'at://list', cid: 'cid' }),
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ uri: 'at://item', cid: 'cid' }),
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        uri: 'at://did:plc:creator/app.bsky.graph.starterpack/abc',
        cid: 'cid',
      }),
    })

    const url = await createStarterPack(
      mockSession,
      'Single User Pack',
      'Description',
      [mockUsers[0]]
    )

    expect(url).toBeDefined()
    expect(url).toContain('starter-pack')
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('returns correct URL format', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        uri: 'at://did:plc:creator/app.bsky.graph.starterpack/testpack',
        cid: 'cid',
      }),
    })

    const url = await createStarterPack(mockSession, 'Test', undefined, [mockUsers[0]])

    expect(url).toBe('https://bsky.app/starter-pack/creator.bsky.social/testpack')
  })
})
