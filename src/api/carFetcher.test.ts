import { describe, it, expect, vi, beforeEach } from 'vitest'
import { downloadAndParseRepo, filterByPeriod } from './carFetcher'
import * as atcuteRepo from '@atcute/repo'
import * as atcuteCbor from '@atcute/cbor'

const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock('@atcute/repo', () => ({
  fromUint8Array: vi.fn(),
}))

vi.mock('@atcute/cbor', () => ({
  decode: vi.fn(),
}))

const mockRepoFromUint8Array = vi.mocked(atcuteRepo.fromUint8Array)
const mockDecode = vi.mocked(atcuteCbor.decode)

beforeEach(() => {
  mockFetch.mockReset()
  mockRepoFromUint8Array.mockReset()
  mockDecode.mockReset()
})

function mockPlcResponse() {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        service: [
          { id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example.com' },
        ],
      }),
  }
}

function mockCarResponse(chunks: Uint8Array[], rev = 'test-rev') {
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
  let chunkIndex = 0
  return {
    ok: true,
    headers: {
      get: (name: string) => {
        if (name === 'atproto-repo-rev') return rev
        return String(totalLength)
      },
    },
    body: {
      getReader: () => ({
        read: async () => {
          if (chunkIndex < chunks.length) {
            return { done: false, value: chunks[chunkIndex++] }
          }
          return { done: true, value: undefined }
        },
      }),
    },
  }
}

describe('downloadAndParseRepo', () => {
  it('downloads CAR file and parses likes', async () => {
    const mockCarData = new Uint8Array([1, 2, 3])

    // Mock PLC directory response
    mockFetch.mockResolvedValueOnce(mockPlcResponse())
    // Mock CAR download
    mockFetch.mockResolvedValueOnce(mockCarResponse([mockCarData]))

    const mockEntries = [{ collection: 'app.bsky.feed.like', bytes: new Uint8Array([1]) }]
    mockRepoFromUint8Array.mockReturnValueOnce(
      mockEntries as unknown as ReturnType<typeof atcuteRepo.fromUint8Array>
    )

    mockDecode.mockReturnValueOnce({
      $type: 'app.bsky.feed.like',
      subject: { uri: 'at://did:plc:other/app.bsky.feed.post/1', cid: 'cid1' },
      createdAt: new Date().toISOString(),
    })

    const result = await downloadAndParseRepo('did:plc:user')

    expect(mockFetch).toHaveBeenCalledWith('https://plc.directory/did%3Aplc%3Auser')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://pds.example.com/xrpc/com.atproto.sync.getRepo?did=did%3Aplc%3Auser'
    )
    expect(result.likes).toHaveLength(1)
    expect(result.likes[0].uri).toBe('at://did:plc:other/app.bsky.feed.post/1')
    expect(result.rev).toBe('test-rev')
  })

  it('parses replies from posts', async () => {
    const mockCarData = new Uint8Array([1, 2, 3])

    mockFetch.mockResolvedValueOnce(mockPlcResponse())
    mockFetch.mockResolvedValueOnce(mockCarResponse([mockCarData]))

    const mockEntries = [{ collection: 'app.bsky.feed.post', bytes: new Uint8Array([1]) }]
    mockRepoFromUint8Array.mockReturnValueOnce(
      mockEntries as unknown as ReturnType<typeof atcuteRepo.fromUint8Array>
    )

    mockDecode.mockReturnValueOnce({
      $type: 'app.bsky.feed.post',
      text: 'Reply text',
      reply: {
        parent: { uri: 'at://did:plc:parent/app.bsky.feed.post/1', cid: 'cid1' },
        root: { uri: 'at://did:plc:root/app.bsky.feed.post/1', cid: 'cid2' },
      },
      createdAt: new Date().toISOString(),
    })

    const result = await downloadAndParseRepo('did:plc:user')

    expect(result.replies).toHaveLength(1)
    expect(result.replies[0].parentUri).toBe('at://did:plc:parent/app.bsky.feed.post/1')
  })

  it('parses mentions from post text', async () => {
    const mockCarData = new Uint8Array([1, 2, 3])

    mockFetch.mockResolvedValueOnce(mockPlcResponse())
    mockFetch.mockResolvedValueOnce(mockCarResponse([mockCarData]))

    const mockEntries = [{ collection: 'app.bsky.feed.post', bytes: new Uint8Array([1]) }]
    mockRepoFromUint8Array.mockReturnValueOnce(
      mockEntries as unknown as ReturnType<typeof atcuteRepo.fromUint8Array>
    )

    mockDecode.mockReturnValueOnce({
      $type: 'app.bsky.feed.post',
      text: 'Hello @user.bsky.social and @other.bsky.social!',
      createdAt: new Date().toISOString(),
    })

    const result = await downloadAndParseRepo('did:plc:user')

    expect(result.mentions).toHaveLength(2)
    expect(result.mentions[0].handle).toBe('user.bsky.social')
    expect(result.mentions[1].handle).toBe('other.bsky.social')
  })

  it('parses reposts', async () => {
    const mockCarData = new Uint8Array([1, 2, 3])

    mockFetch.mockResolvedValueOnce(mockPlcResponse())
    mockFetch.mockResolvedValueOnce(mockCarResponse([mockCarData]))

    const mockEntries = [{ collection: 'app.bsky.feed.repost', bytes: new Uint8Array([1]) }]
    mockRepoFromUint8Array.mockReturnValueOnce(
      mockEntries as unknown as ReturnType<typeof atcuteRepo.fromUint8Array>
    )

    mockDecode.mockReturnValueOnce({
      $type: 'app.bsky.feed.repost',
      subject: { uri: 'at://did:plc:other/app.bsky.feed.post/1', cid: 'cid1' },
      createdAt: new Date().toISOString(),
    })

    const result = await downloadAndParseRepo('did:plc:user')

    expect(result.reposts).toHaveLength(1)
    expect(result.reposts[0].uri).toBe('at://did:plc:other/app.bsky.feed.post/1')
  })

  it('parses quote posts', async () => {
    const mockCarData = new Uint8Array([1, 2, 3])

    mockFetch.mockResolvedValueOnce(mockPlcResponse())
    mockFetch.mockResolvedValueOnce(mockCarResponse([mockCarData]))

    const mockEntries = [{ collection: 'app.bsky.feed.post', bytes: new Uint8Array([1]) }]
    mockRepoFromUint8Array.mockReturnValueOnce(
      mockEntries as unknown as ReturnType<typeof atcuteRepo.fromUint8Array>
    )

    mockDecode.mockReturnValueOnce({
      $type: 'app.bsky.feed.post',
      text: 'Check out this post!',
      embed: {
        $type: 'app.bsky.embed.record',
        record: { uri: 'at://did:plc:quoted/app.bsky.feed.post/1', cid: 'cid1' },
      },
      createdAt: new Date().toISOString(),
    })

    const result = await downloadAndParseRepo('did:plc:user')

    expect(result.quotes).toHaveLength(1)
    expect(result.quotes[0].uri).toBe('at://did:plc:quoted/app.bsky.feed.post/1')
  })

  it('calls progress callback', async () => {
    const onProgress = vi.fn()
    const mockCarData = new Uint8Array([1, 2, 3])

    mockFetch.mockResolvedValueOnce(mockPlcResponse())
    mockFetch.mockResolvedValueOnce(mockCarResponse([mockCarData]))

    mockRepoFromUint8Array.mockReturnValueOnce(
      [] as unknown as ReturnType<typeof atcuteRepo.fromUint8Array>
    )

    await downloadAndParseRepo('did:plc:user', onProgress)

    expect(onProgress).toHaveBeenCalledWith('Resolving PDS...')
    expect(onProgress).toHaveBeenCalledWith('Parsing repository...')
  })

  it('throws error on failed DID resolution', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    })

    await expect(downloadAndParseRepo('did:plc:invalid')).rejects.toThrow('Failed to resolve DID: 404')
  })

  it('throws error on failed repo download', async () => {
    mockFetch.mockResolvedValueOnce(mockPlcResponse())
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    })

    await expect(downloadAndParseRepo('did:plc:invalid')).rejects.toThrow('Failed to download repo: 404')
  })
})

describe('filterByPeriod', () => {
  it('filters records by time period', () => {
    const now = new Date()
    const oldDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
    const recentDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) // 3 days ago

    const parsed = {
      likes: [
        { uri: 'old', createdAt: oldDate.toISOString() },
        { uri: 'recent', createdAt: recentDate.toISOString() },
      ],
      replies: [{ parentUri: 'old', createdAt: oldDate.toISOString() }],
      reposts: [{ uri: 'recent', createdAt: recentDate.toISOString() }],
      mentions: [
        { handle: 'old', createdAt: oldDate.toISOString() },
        { handle: 'recent', createdAt: recentDate.toISOString() },
      ],
      quotes: [
        { uri: 'old', createdAt: oldDate.toISOString() },
        { uri: 'recent', createdAt: recentDate.toISOString() },
      ],
      rev: 'test-rev',
    }

    const filtered = filterByPeriod(parsed, '7d')

    expect(filtered.likes).toHaveLength(1)
    expect(filtered.likes[0].uri).toBe('recent')
    expect(filtered.replies).toHaveLength(0)
    expect(filtered.reposts).toHaveLength(1)
    expect(filtered.mentions).toHaveLength(1)
    expect(filtered.quotes).toHaveLength(1)
    expect(filtered.quotes[0].uri).toBe('recent')
    expect(filtered.rev).toBe('test-rev')
  })

  it('returns all records for "all" period', () => {
    const oldDate = new Date('2020-01-01')
    const recentDate = new Date()

    const parsed = {
      likes: [
        { uri: 'old', createdAt: oldDate.toISOString() },
        { uri: 'recent', createdAt: recentDate.toISOString() },
      ],
      replies: [],
      reposts: [],
      mentions: [],
      quotes: [],
      rev: 'test-rev',
    }

    const filtered = filterByPeriod(parsed, 'all')

    expect(filtered.likes).toHaveLength(2)
  })
})
