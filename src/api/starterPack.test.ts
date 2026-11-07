import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createStarterPack } from './starterPack'
import type { BlueskySession } from '../types'
import metadata from '../../public/oauth-client-metadata.json'
const fetchHandler = vi.fn()
const session = {
  did: 'did:plc:owner',
  handle: 'owner.example',
  oauth: { fetchHandler, getTokenInfo: () => Promise.resolve({ scope: metadata.scope }) },
} as unknown as BlueskySession
const user = (n: number) => ({ did: `did:plc:member${n}`, handle: `member${n}.example` })
beforeEach(() => {
  fetchHandler.mockReset()
  fetchHandler.mockResolvedValue(new Response('{}'))
})
describe('atomic publishing', () => {
  it.each([1, 2, 50, 149, 150])(
    'publishes exactly %i selected members in one atomic request',
    async (count) => {
      const users = Array.from({ length: count }, (_, n) => user(n))
      const url = await createStarterPack(session, 'Reviewed name', 'Description', users)
      expect(fetchHandler).toHaveBeenCalledOnce()
      const [path, request] = fetchHandler.mock.calls[0]
      expect(path).toBe('/xrpc/com.atproto.repo.applyWrites')
      const body = JSON.parse(request.body)
      expect(body.repo).toBe(session.did)
      expect(body.validate).toBe(true)
      expect(body.writes).toHaveLength(count + 2)
      expect(
        body.writes.every(
          (w: { $type: string }) => w.$type === 'com.atproto.repo.applyWrites#create'
        )
      ).toBe(true)
      expect(body.writes[0].value.name).toBe('Reviewed name')
      const listUri = `at://${session.did}/app.bsky.graph.list/${body.writes[0].rkey}`
      expect(
        body.writes.slice(1, -1).map((w: { value: { subject: string; list: string } }) => {
          expect(w.value.list).toBe(listUri)
          return w.value.subject
        })
      ).toEqual(users.map((u) => u.did))
      expect(body.writes.at(-1).value.list).toBe(listUri)
      expect(url).toBe(`https://bsky.app/starter-pack/${session.did}/${body.writes.at(-1).rkey}`)
    }
  )
  it.each(
    [
      [],
      Array.from({ length: 151 }, (_, n) => user(n)),
      [user(1), user(1)],
      [{ did: 'not-a-did', handle: 'x' }],
    ].map((users) => ({ users }))
  )('rejects invalid selection before any write', async ({ users }) => {
    await expect(createStarterPack(session, 'Name', '', users)).rejects.toThrow(
      /select|distinct|DID/i
    )
    expect(fetchHandler).not.toHaveBeenCalled()
  })
  it.each(['', 'x'.repeat(51)])('rejects invalid names', async (name) => {
    await expect(createStarterPack(session, name, '', [user(1)])).rejects.toThrow(/name/i)
    expect(fetchHandler).not.toHaveBeenCalled()
  })
  it('does not report success after a rejected batch or retry it', async () => {
    fetchHandler.mockResolvedValue(new Response('{}', { status: 429 }))
    await expect(createStarterPack(session, 'Name', '', [user(1)])).rejects.toThrow(/failed/i)
    expect(fetchHandler).toHaveBeenCalledOnce()
  })
})
