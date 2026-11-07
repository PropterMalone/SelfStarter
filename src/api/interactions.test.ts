import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveHandle, getProfile, fetchInteractions, _resetCache } from './interactions'
import * as carFetcher from './carFetcher'
import { DEFAULT_WEIGHTS, rankUsers } from '../utils/scoring'

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
      quotes: [],
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
      quotes: [],
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
      quotes: [],
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
      quotes: [],
      rev: 'test-rev',
    })

    // filterByPeriod returns empty (simulating filtering)
    mockFilterByPeriod.mockReturnValueOnce({
      likes: [],
      replies: [],
      reposts: [],
      mentions: [],
      quotes: [],
      rev: 'test-rev',
    })

    const users = await fetchInteractions('user.bsky.social', '7d')
    expect(users.length).toBe(0)
    expect(mockFilterByPeriod).toHaveBeenCalledWith(expect.any(Object), '7d')
  })

  function prepareAccounts(likeAccounts: number, quoteAccounts = 0) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ did: 'did:plc:self' }),
    })
    mockGetLatestCommit.mockResolvedValue({ rev: 'test-rev', pdsUrl: 'https://pds.invalid' })
    const createdAt = '2026-01-01T00:00:00.000Z'
    const parsed: carFetcher.ParsedInteractions = {
      likes: Array.from({ length: likeAccounts }, (_, i) =>
        [0, 1].map((j) => ({
          uri: `at://did:plc:like${i}/app.bsky.feed.post/${j}`,
          createdAt,
        }))
      ).flat(),
      replies: [],
      reposts: [],
      mentions: [],
      quotes: Array.from({ length: quoteAccounts }, (_, i) => ({
        uri: `at://did:plc:quote${i}/app.bsky.feed.post/0`,
        createdAt,
      })),
      rev: 'test-rev',
    }
    mockDownloadAndParseRepo.mockResolvedValue(parsed)
    mockFetch.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => ({
        profiles: new URL(url).searchParams.getAll('actors').map((did) => ({
          did,
          handle: `${did.slice('did:plc:'.length)}.invalid`,
        })),
      }),
    }))
    return parsed
  }

  it('retains all 251 accounts below the safety limit instead of truncating to 200', async () => {
    prepareAccounts(251)
    const users = await fetchInteractions('self.invalid', 'all')
    expect(users).toHaveLength(251)
    const requested = mockFetch.mock.calls.slice(1).map(([url]) =>
      new URL(url).searchParams.getAll('actors')
    )
    expect(requested.every((batch) => batch.length <= 20)).toBe(true)
    expect(new Set(requested.flat()).size).toBe(251)
    expect(requested.flat()).toHaveLength(251)
  })

  it.each([200, 250])('keeps a quote account behind %i two-like accounts for weighted ranking', async (count) => {
    prepareAccounts(count, 1)
    const users = await fetchInteractions('self.invalid', 'all')
    expect(users).toHaveLength(count + 1)
    expect(rankUsers(users)[0].did).toBe('did:plc:quote0')
    expect(rankUsers(users)[0].interactionCount).toBe(5)
  })

  it('reranks previously low candidates when weights change without fetching again', async () => {
    prepareAccounts(250, 1)
    const users = await fetchInteractions('self.invalid', 'all')
    const calls = mockFetch.mock.calls.length
    const likesFirst = rankUsers(users, { ...DEFAULT_WEIGHTS, quotes: 0 })
    expect(likesFirst.at(-1)?.did).toBe('did:plc:quote0')
    const quotesFirst = rankUsers(users, { ...DEFAULT_WEIGHTS, quotes: 10 })
    expect(quotesFirst[0].did).toBe('did:plc:quote0')
    expect(users.find((user) => user.did === 'did:plc:quote0')?.interactions.quotes).toBe(1)
    expect(mockFetch).toHaveBeenCalledTimes(calls)
  })

  it('accepts exactly 5000 accounts and batches every distinct author once', async () => {
    vi.useFakeTimers()
    try {
      prepareAccounts(5000)
      const result = fetchInteractions('self.invalid', 'all')
      await vi.runAllTimersAsync()
      const users = await result
      expect(users).toHaveLength(5000)
      const requested = mockFetch.mock.calls.slice(1).flatMap(([url]) =>
        new URL(url).searchParams.getAll('actors')
      )
      expect(requested).toHaveLength(5000)
      expect(new Set(requested).size).toBe(5000)
      expect(mockFetch).toHaveBeenCalledTimes(251)
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects excessive mention lookups before requesting any profiles', async () => {
    const parsed = prepareAccounts(1)
    parsed.mentions = Array.from({ length: 5001 }, (_, i) => ({
      handle: `mention${i}.invalid`,
      createdAt: '2026-01-01T00:00:00.000Z',
    }))
    await expect(fetchInteractions('self.invalid', 'all')).rejects.toThrow(/5,000.*shorter time period/)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('merges repeated mentions and URI interactions for the same author', async () => {
    const parsed = prepareAccounts(1)
    parsed.mentions = [0, 1].map(() => ({
      handle: 'like0.invalid',
      createdAt: '2026-01-01T00:00:00.000Z',
    }))
    mockFetch.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ profiles: [{ did: 'did:plc:like0', handle: 'like0.invalid' }] }),
    }))
    const users = await fetchInteractions('self.invalid', 'all')
    expect(users).toHaveLength(1)
    expect(users[0].interactions).toEqual({ likes: 2, replies: 0, reposts: 0, quotes: 0, mentions: 2 })
    expect(new URL(mockFetch.mock.calls[2][0]).searchParams.getAll('actors')).toEqual(['like0.invalid'])
  })

  it('rejects more than 5000 distinct accounts before requesting profiles', async () => {
    prepareAccounts(5001)
    await expect(fetchInteractions('self.invalid', 'all')).rejects.toThrow(/5,000.*shorter time period/)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it.each([0, 1])('rejects a profile 503 after %i successful batches instead of returning partial users', async (successfulBatches) => {
    prepareAccounts(41)
    for (let i = 0; i < successfulBatches; i++) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          profiles: Array.from({ length: 20 }, (_, j) => ({
            did: `did:plc:like${i * 20 + j}`,
            handle: `like${i * 20 + j}.invalid`,
          })),
        }),
      })
    }
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({ error: 'Unavailable', message: 'Profile service unavailable' }),
    })
    await expect(fetchInteractions('self.invalid', 'all')).rejects.toThrow('Profile service unavailable')
    expect(mockFetch).toHaveBeenCalledTimes(successfulBatches + 2)
  })

  it('propagates a profile network rejection', async () => {
    prepareAccounts(1)
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(fetchInteractions('self.invalid', 'all')).rejects.toThrow('Failed to fetch')
  })

  it('allows a successful profile response to omit a deleted account', async () => {
    prepareAccounts(2)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ profiles: [{ did: 'did:plc:like0', handle: 'like0.invalid' }] }),
    })
    const users = await fetchInteractions('self.invalid', 'all')
    expect(users.map((user) => user.did)).toEqual(['did:plc:like0'])
    expect(users[0].interactions.likes).toBe(2)
  })

  it('retains mention-only accounts beyond the old 100-handle window', async () => {
    const parsed = prepareAccounts(0)
    parsed.mentions = Array.from({ length: 101 }, (_, i) => ({
      handle: `mention${i}.invalid`,
      createdAt: '2026-01-01T00:00:00.000Z',
    }))
    mockFetch.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => ({
        profiles: new URL(url).searchParams.getAll('actors').map((handle) => ({
          did: `did:plc:${handle.split('.')[0]}`,
          handle,
        })),
      }),
    }))
    const users = await fetchInteractions('self.invalid', 'all')
    expect(users).toHaveLength(101)
    expect(users.at(-1)?.interactions.mentions).toBe(1)
  })

  it('propagates a mention-profile batch failure', async () => {
    const parsed = prepareAccounts(0)
    parsed.mentions = [{ handle: 'mention.invalid', createdAt: '2026-01-01T00:00:00.000Z' }]
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({ message: 'Mention lookup unavailable' }),
    })
    await expect(fetchInteractions('self.invalid', 'all')).rejects.toThrow('Mention lookup unavailable')
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
      quotes: [],
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
      quotes: [],
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
      quotes: [],
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
      quotes: [],
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
