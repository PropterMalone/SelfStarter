// pattern: Imperative Shell
import { TID } from '@atproto/common-web'
import type { BlueskySession, StarterPackUser } from '../types'
import { AuthenticatedClient } from './authenticatedClient'

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
function validateText(value: string, field: string, graphemes: number, bytes: number): void {
  if (
    [...segmenter.segment(value)].length > graphemes ||
    new TextEncoder().encode(value).length > bytes
  ) {
    throw new Error(`${field} is too long (maximum ${graphemes} characters).`)
  }
}

export async function createStarterPack(
  session: BlueskySession,
  name: string,
  description: string | undefined,
  users: StarterPackUser[]
): Promise<string> {
  if (users.length < 1 || users.length > 150) throw new Error('Select between 1 and 150 accounts.')
  if (new Set(users.map((user) => user.did)).size !== users.length)
    throw new Error('Select distinct accounts.')
  if (users.some((user) => !/^did:[a-z]+:[A-Za-z0-9._:%-]+$/.test(user.did)))
    throw new Error('Each selected account must have a valid DID.')
  if (!name.trim()) throw new Error('A starter pack name is required.')
  validateText(name, 'Name', 50, 500)
  validateText(description || '', 'Description', 300, 3000)
  const now = new Date().toISOString()
  const listKey = TID.nextStr()
  const packKey = TID.nextStr()
  const list = `at://${session.did}/app.bsky.graph.list/${listKey}`
  const create = (collection: string, rkey: string, value: Record<string, unknown>) => ({
    $type: 'com.atproto.repo.applyWrites#create',
    collection,
    rkey,
    value: { $type: collection, ...value },
  })
  // One transaction: never claim a complete pack after a failed member addition.
  const writes = [
    create('app.bsky.graph.list', listKey, {
      purpose: 'app.bsky.graph.defs#curatelist',
      name,
      description: description || '',
      createdAt: now,
    }),
    ...users.map((user) =>
      create('app.bsky.graph.listitem', TID.nextStr(), { subject: user.did, list, createdAt: now })
    ),
    create('app.bsky.graph.starterpack', packKey, {
      name,
      description: description || '',
      list,
      createdAt: now,
    }),
  ]
  await new AuthenticatedClient(session).post('com.atproto.repo.applyWrites', {
    repo: session.did,
    validate: true,
    writes,
  })
  return `https://bsky.app/starter-pack/${session.did}/${packKey}`
}
