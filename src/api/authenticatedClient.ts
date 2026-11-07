// pattern: Imperative Shell
import type { BlueskySession } from '../types'
import { BlueskyApiError } from './client'
import { requirePublishPermissions } from './permissions'

/** The SDK owns PDS routing, authorization proofs, refresh and nonce retries. */
export class AuthenticatedClient {
  private readonly session: BlueskySession
  constructor(session: BlueskySession) {
    this.session = session
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    await requirePublishPermissions(this.session.oauth)
    const response = await this.session.oauth.fetchHandler(`/xrpc/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok) {
      throw new BlueskyApiError(
        response.status,
        'PublishFailed',
        response.status === 401
          ? 'Your session expired or was revoked. Please sign in again.'
          : 'Publishing failed. No success was confirmed; check your account before retrying.'
      )
    }
    return response.json() as Promise<T>
  }
}
