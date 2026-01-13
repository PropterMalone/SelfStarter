import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveHandle, getProfile, fetchInteractions, _resetCache } from './interactions'
import * as carFetcher from './carFetcher'

const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock('./carFetcher', () => ({
  downloadAndParseRepo: vi.fn(),
  getLatestCommit: vi.fn(),
  filterByPeriod: vi.fn((parsed) => parsed), // Pass through by default
}))

const mockDownloadAndParseRepo = vi.mocked(carFetcher.downloadAndParseRepo)
const mockGetLatestCommit = vi.mocked(carFetcher.getLatestCommit)
const mockFilterByPeriod = vi.mocked(carFetcher.filterByPeriod)

beforeEach(() => {
  mockFetch.mockReset()
  mockDownloadAndParseRepo.mockReset()
  mockGetLatestCommit.mockReset()
  mockFilterByPeriod.mockReset()
  _resetCache() // Reset the module-level cache between tests
  // Default: filterByPeriod passes through
  mockFilterByPeriod.mockImplementation((parsed) => parsed)
})

describe('resolveHandle', () => {
  it('resolves handle to DID', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ did: 'did:plc:abc123' }),
    })

    const did = await resolveHandle('user.bsky.social')
    expect(did).toBe('did:plc:abc123')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('com.atproto.identity.resolveHandle?handle=user.bsky.social')
    )
  })

  it('throws on invalid handle', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () =>
        Promise.resolve({
          error: 'InvalidHandle',
          message: 'Unable to resolve handle',
        }),
    })

    await expect(resolveHandle('invalid')).rejects.toThrow()
  })
})

describe('getProfile', () => {
  it('fetches profile by DID', async () => {
    const mockProfile = {
      did: 'did:plc:abc123',
      handle: 'user.bsky.social',
      displayName: 'Test User',
      avatar: 'https://example.com/avatar.jpg',
      description: 'Bio text',
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProfile),
    })

    const profile = await getProfile('did:plc:abc123')
    expect(profile).toEqual(mockProfile)
  })

  it('returns profile with optional fields undefined', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          did: 'did:plc:abc123',
          handle: 'user.bsky.social',
        }),
    })

    const profile = await getProfile('did:plc:abc123')
    expect(profile.displayName).toBeUndefined()
    expect(profile.avatar).toBeUndefined()
  })
})

describe('fetchInteractions', () => {
  it('fetches and aggregates interactions', async () => {
    // Mock resolveHandle
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ did: 'did:plc:user' }),
    })

    // Mock getLatestCommit
    mockGetLatestCommit.mockResolvedValueOnce({ rev: 'test-rev', pdsUrl: 'https://pds.example.com' })

    // Mock CAR parser with empty data
    mockDownloadAndParseRepo.mockResolvedValueOnce({
      likes: [],
      replies: [],
      reposts: [],
      mentions: [],
      rev: 'test-rev',
    })

    const users = await fetchInteractions('user.bsky.social', '30d')
    expect(users).toEqual([])
  })

  it('calls progress callback during fetch', async () => {
    const onProgress = vi.fn()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ did: 'did:plc:user' }),
    })

    mockGetLatestCommit.mockResolvedValueOnce({ rev: 'test-rev', pdsUrl: 'https://pds.example.com' })

    mockDownloadAndParseRepo.mockResolvedValueOnce({
      likes: [],
      replies: [],
      reposts: [],
      mentions: [],
      rev: 'test-rev',
    })

    await fetchInteractions('user.bsky.social', '7d', onProgress)

    expect(onProgress).toHaveBeenCalledWith('Resolving handle...', 0)
  })

  it('extracts DIDs from URIs and fetches profiles', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ did: 'did:plc:user' }),
    })

    mockGetLatestCommit.mockResolvedValueOnce({ rev: 'test-rev', pdsUrl: 'https://pds.example.com' })

    mockDownloadAndParseRepo.mockResolvedValueOnce({
      likes: [{ uri: 'at://did:plc:other/app.bsky.feed.post/1', createdAt: new Date().toISOString() }],
      replies: [],
      reposts: [],
      mentions: [],
      rev: 'test-rev',
    })

    // getProfiles response (batch endpoint)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          profiles: [
            {
              did: 'did:plc:other',
              handle: 'other.bsky.social',
              displayName: 'Other User',
            },
          ],
        }),
    })

    const users = await fetchInteractions('user.bsky.social', '30d')
    expect(users.length).toBe(1)
    expect(users[0].handle).toBe('other.bsky.social')
    expect(users[0].interactions.likes).toBe(1)
  })

  it('applies time period filter via filterByPeriod', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ did: 'did:plc:user' }),
    })

    mockGetLatestCommit.mockResolvedValueOnce({ rev: 'test-rev', pdsUrl: 'https://pds.example.com' })

    mockDownloadAndParseRepo.mockResolvedValueOnce({
      likes: [{ uri: 'at://did:plc:other/app.bsky.feed.post/1', createdAt: new Date().toISOString() }],
      replies: [],
      reposts: [],
      mentions: [],
      rev: 'test-rev',
    })

    // filterByPeriod returns empty (simulating filtering)
    mockFilterByPeriod.mockReturnValueOnce({
      likes: [],
      replies: [],
      reposts: [],
      mentions: [],
      rev: 'test-rev',
    })

    const users = await fetchInteractions('user.bsky.social', '7d')
    expect(users.length).toBe(0)
    expect(mockFilterByPeriod).toHaveBeenCalledWith(expect.any(Object), '7d')
  })

  it('limits results to 200 users', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ did: 'did:plc:user' }),
    })

    mockGetLatestCommit.mockResolvedValueOnce({ rev: 'test-rev', pdsUrl: 'https://pds.example.com' })

    // Create 250 likes to different users
    const likes = Array.from({ length: 250 }, (_, i) => ({
      uri: `at://did:plc:other${i}/app.bsky.feed.post/1`,
      createdAt: new Date().toISOString(),
    }))

    mockDownloadAndParseRepo.mockResolvedValueOnce({
      likes,
      replies: [],
      reposts: [],
      mentions: [],
      rev: 'test-rev',
    })

    // Mock getProfiles in batches of 25 (we fetch top 250 DIDs)
    for (let i = 0; i < 10; i++) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            profiles: Array.from({ length: 25 }, (_, j) => ({
              did: `did:plc:other${i * 25 + j}`,
              handle: `other${i * 25 + j}.bsky.social`,
            })),
          }),
      })
    }

    const users = await fetchInteractions('user.bsky.social', 'all')
    expect(users.length).toBeLessThanOrEqual(200)
  })

  it('uses cached data when repo revision matches', async () => {
    // First call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ did: 'did:plc:user' }),
    })
    mockGetLatestCommit.mockResolvedValueOnce({ rev: 'rev-1', pdsUrl: 'https://pds.example.com' })
    mockDownloadAndParseRepo.mockResolvedValueOnce({
      likes: [],
      replies: [],
      reposts: [],
      mentions: [],
      rev: 'rev-1',
    })

    await fetchInteractions('user.bsky.social', '30d')
    expect(mockDownloadAndParseRepo).toHaveBeenCalledTimes(1)

    // Second call with same revision - should use cache
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ did: 'did:plc:user' }),
    })
    mockGetLatestCommit.mockResolvedValueOnce({ rev: 'rev-1', pdsUrl: 'https://pds.example.com' })

    await fetchInteractions('user.bsky.social', '7d')
    // Should still be 1 - didn't download again
    expect(mockDownloadAndParseRepo).toHaveBeenCalledTimes(1)
  })

  it('re-downloads when repo revision changes', async () => {
    // First call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ did: 'did:plc:user' }),
    })
    mockGetLatestCommit.mockResolvedValueOnce({ rev: 'rev-1', pdsUrl: 'https://pds.example.com' })
    mockDownloadAndParseRepo.mockResolvedValueOnce({
      likes: [],
      replies: [],
      reposts: [],
      mentions: [],
      rev: 'rev-1',
    })

    await fetchInteractions('user.bsky.social', '30d')
    expect(mockDownloadAndParseRepo).toHaveBeenCalledTimes(1)

    // Second call with different revision - should re-download
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ did: 'did:plc:user' }),
    })
    mockGetLatestCommit.mockResolvedValueOnce({ rev: 'rev-2', pdsUrl: 'https://pds.example.com' })
    mockDownloadAndParseRepo.mockResolvedValueOnce({
      likes: [],
      replies: [],
      reposts: [],
      mentions: [],
      rev: 'rev-2',
    })

    await fetchInteractions('user.bsky.social', '7d')
    expect(mockDownloadAndParseRepo).toHaveBeenCalledTimes(2)
  })

  it('counts multiple interactions to same user', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ did: 'did:plc:user' }),
    })

    mockGetLatestCommit.mockResolvedValueOnce({ rev: 'test-rev', pdsUrl: 'https://pds.example.com' })

    // Multiple likes and a reply to the same user
    mockDownloadAndParseRepo.mockResolvedValueOnce({
      likes: [
        { uri: 'at://did:plc:other/app.bsky.feed.post/1', createdAt: new Date().toISOString() },
        { uri: 'at://did:plc:other/app.bsky.feed.post/2', createdAt: new Date().toISOString() },
        { uri: 'at://did:plc:other/app.bsky.feed.post/3', createdAt: new Date().toISOString() },
      ],
      replies: [
        { parentUri: 'at://did:plc:other/app.bsky.feed.post/4', createdAt: new Date().toISOString() },
      ],
      reposts: [],
      mentions: [],
      rev: 'test-rev',
    })

    // getProfiles response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          profiles: [
            {
              did: 'did:plc:other',
              handle: 'other.bsky.social',
              displayName: 'Other User',
            },
          ],
        }),
    })

    const users = await fetchInteractions('user.bsky.social', '30d')
    expect(users.length).toBe(1)
    expect(users[0].interactions.likes).toBe(3)
    expect(users[0].interactions.replies).toBe(1)
    expect(users[0].interactionCount).toBe(4)
  })
})
