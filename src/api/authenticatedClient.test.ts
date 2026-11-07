import { describe, expect, it, vi } from 'vitest'
import { AuthenticatedClient } from './authenticatedClient'
import type { BlueskySession } from '../types'
import metadata from '../../public/oauth-client-metadata.json'
const getTokenInfo = () => Promise.resolve({ scope: metadata.scope })

describe('OAuth XRPC transport', () => {
  it('blocks a reduced current grant before any write request', async () => {
    const fetchHandler = vi.fn()
    const session = {
      oauth: { fetchHandler, getTokenInfo: vi.fn().mockResolvedValue({ scope: 'atproto' }) },
    } as unknown as BlueskySession
    await expect(
      new AuthenticatedClient(session).post('com.atproto.repo.applyWrites', {})
    ).rejects.toThrow(/permissions.*sign in/i)
    expect(fetchHandler).not.toHaveBeenCalled()
  })
  it('uses the SDK relative fetch handler without adding bearer tokens or choosing a PDS', async () => {
    const fetchHandler = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })))
    const session = {
      did: 'did:plc:test',
      handle: 'test.example',
      oauth: { fetchHandler, getTokenInfo },
    } as unknown as BlueskySession
    const client = new AuthenticatedClient(session)
    expect(await client.post('com.atproto.repo.applyWrites', { writes: [] })).toEqual({ ok: true })
    expect(fetchHandler).toHaveBeenCalledWith('/xrpc/com.atproto.repo.applyWrites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes: [] }),
    })
  })
  it('surfaces failures without custom refresh or retry of writes', async () => {
    const fetchHandler = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: 'InvalidToken' }), { status: 401 }))
    const session = { oauth: { fetchHandler, getTokenInfo } } as unknown as BlueskySession
    await expect(
      new AuthenticatedClient(session).post('com.atproto.repo.applyWrites', {})
    ).rejects.toThrow(/sign in/i)
    expect(fetchHandler).toHaveBeenCalledOnce()
  })
})
