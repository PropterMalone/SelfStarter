import type { BlueskySession } from '../types'
import { unauthenticatedPost, authenticatedPost } from './client'

interface CreateSessionResponse {
  did: string
  handle: string
  accessJwt: string
  refreshJwt: string
}

interface RefreshSessionResponse {
  did: string
  handle: string
  accessJwt: string
  refreshJwt: string
}

export async function createSession(
  identifier: string,
  password: string
): Promise<BlueskySession> {
  const response = await unauthenticatedPost<CreateSessionResponse>(
    'com.atproto.server.createSession',
    { identifier, password }
  )
  return {
    did: response.did,
    handle: response.handle,
    accessJwt: response.accessJwt,
    refreshJwt: response.refreshJwt,
  }
}

export async function refreshSession(refreshJwt: string): Promise<BlueskySession> {
  const response = await authenticatedPost<RefreshSessionResponse>(
    'com.atproto.server.refreshSession',
    refreshJwt
  )
  return {
    did: response.did,
    handle: response.handle,
    accessJwt: response.accessJwt,
    refreshJwt: response.refreshJwt,
  }
}
