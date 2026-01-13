import type { BlueskySession, StarterPackUser } from '../types'
import { authenticatedPost, authenticatedGet } from './client'

interface StarterPackRecord {
  $type: 'app.bsky.graph.starterpack'
  name: string
  description?: string
  list: string
  createdAt: string
}

interface ListRecord {
  $type: 'app.bsky.graph.list'
  purpose: 'app.bsky.graph.defs#curatelist'
  name: string
  description?: string
  createdAt: string
}

interface CreateRecordResponse {
  uri: string
  cid: string
}

interface ListItemRecord {
  $type: 'app.bsky.graph.listitem'
  subject: string
  list: string
  createdAt: string
}

export async function createStarterPack(
  session: BlueskySession,
  name: string,
  description: string | undefined,
  users: StarterPackUser[]
): Promise<string> {
  const now = new Date().toISOString()

  // First create a list to hold the users
  const listResponse = await authenticatedPost<CreateRecordResponse>(
    'com.atproto.repo.createRecord',
    session.accessJwt,
    {
      repo: session.did,
      collection: 'app.bsky.graph.list',
      record: {
        $type: 'app.bsky.graph.list',
        purpose: 'app.bsky.graph.defs#curatelist',
        name: `${name} - List`,
        description: description || '',
        createdAt: now,
      } satisfies ListRecord,
    }
  )

  // Add users to the list (max 150)
  const usersToAdd = users.slice(0, 150)

  for (const user of usersToAdd) {
    try {
      await authenticatedPost<CreateRecordResponse>(
        'com.atproto.repo.createRecord',
        session.accessJwt,
        {
          repo: session.did,
          collection: 'app.bsky.graph.listitem',
          record: {
            $type: 'app.bsky.graph.listitem',
            subject: user.did,
            list: listResponse.uri,
            createdAt: now,
          } satisfies ListItemRecord,
        }
      )
    } catch {
      // User might not exist or be blocked
    }

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 50))
  }

  // Create the starter pack referencing the list
  const starterPackResponse = await authenticatedPost<CreateRecordResponse>(
    'com.atproto.repo.createRecord',
    session.accessJwt,
    {
      repo: session.did,
      collection: 'app.bsky.graph.starterpack',
      record: {
        $type: 'app.bsky.graph.starterpack',
        name,
        description: description || '',
        list: listResponse.uri,
        createdAt: now,
      } satisfies StarterPackRecord,
    }
  )

  // Convert AT URI to Bluesky URL
  // at://did:plc:xxx/app.bsky.graph.starterpack/yyy -> https://bsky.app/starter-pack/handle/yyy
  const rkey = starterPackResponse.uri.split('/').pop()
  return `https://bsky.app/starter-pack/${session.handle}/${rkey}`
}

interface GetStarterPackResponse {
  starterPack: {
    uri: string
    cid: string
    record: StarterPackRecord
    creator: {
      did: string
      handle: string
      displayName?: string
      avatar?: string
    }
    listItemCount: number
  }
}

export async function getStarterPack(
  session: BlueskySession,
  uri: string
): Promise<GetStarterPackResponse> {
  return authenticatedGet<GetStarterPackResponse>(
    'app.bsky.graph.getStarterPack',
    session.accessJwt,
    { starterPack: uri }
  )
}
