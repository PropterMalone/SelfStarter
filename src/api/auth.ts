// pattern: Imperative Shell
import {
  BrowserOAuthClient,
  buildAtprotoLoopbackClientMetadata,
} from '@atproto/oauth-client-browser'
import type { BlueskySession } from '../types'
import metadata from '../../public/oauth-client-metadata.json'
import { publicGet } from './client'
import { purgeLegacySession } from '../utils/storage'
import { LimitedPermissionsError, requirePublishPermissions } from './permissions'

export const OAUTH_SCOPE = metadata.scope
const deletedListeners = new Set<(did: string) => void>()
let client: BrowserOAuthClient | undefined
let initialization: Promise<BlueskySession | null> | undefined

export function authErrorMessage(error: unknown): string {
  if (error instanceof LimitedPermissionsError) return new LimitedPermissionsError().message
  const text = error instanceof Error ? `${error.name} ${error.message}` : ''
  if (/access_denied|cancel|denied|navigated back/i.test(text))
    return 'Sign in was cancelled or denied. Your selection is unchanged.'
  if (/expired|revoked|invalid.?token|invalid_grant/i.test(text))
    return 'Your session expired or was revoked. Please sign in again.'
  if (/crypto|indexeddb|not.?supported|secure context/i.test(text))
    return 'This browser cannot securely sign in. Use a current browser with secure storage enabled.'
  return 'Could not sign in or restore your session. Please try signing in again.'
}

function getClient(): BrowserOAuthClient {
  if (!client) {
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
    if (!loopback && window.location.origin + window.location.pathname !== metadata.client_uri) {
      throw new Error('Unsupported OAuth deployment URL')
    }
    const localRedirect = new URL(window.location.pathname, window.location.origin)
    if (localRedirect.hostname === 'localhost') localRedirect.hostname = '127.0.0.1'
    client = new BrowserOAuthClient({
      // The loopback client ID has no path; its IP callback retains Vite's subpath.
      clientMetadata: loopback
        ? buildAtprotoLoopbackClientMetadata({
            scope: OAUTH_SCOPE,
            redirect_uris: [localRedirect.href],
          })
        : {
            ...metadata,
            redirect_uris: [metadata.redirect_uris[0]],
            response_types: ['code'],
            grant_types: ['authorization_code', 'refresh_token'],
            token_endpoint_auth_method: 'none',
            application_type: 'web',
          },
      handleResolver: 'https://bsky.social',
      onSessionDeleted: (did) => {
        deletedListeners.forEach((listener) => listener(did))
      },
    })
  }
  return client
}

export function initializeAuth(): Promise<BlueskySession | null> {
  if (!initialization) {
    initialization = (async () => {
      try {
        purgeLegacySession()
        // SDK consumes callback parameters and scrubs them before returning.
        const params = new URLSearchParams(window.location.hash.slice(1))
        const callback = params.has('state') && (params.has('code') || params.has('error'))
        const remaining = new URLSearchParams(params)
        for (const key of ['state', 'code', 'error', 'error_description', 'error_uri', 'iss'])
          remaining.delete(key)
        let result: Awaited<ReturnType<BrowserOAuthClient['init']>>
        try {
          result = await getClient().init()
        } finally {
          if (callback && !window.location.hash && remaining.size) {
            window.history.replaceState(
              window.history.state,
              '',
              `${window.location.pathname}${window.location.search}#${remaining}`
            )
          }
        }
        if (!result) return null
        const oauth = result.session
        await requirePublishPermissions(oauth)
        let handle: string = oauth.sub
        try {
          handle = (
            await publicGet<{ handle: string }>(
              'app.bsky.actor.getProfile',
              { actor: oauth.sub },
              AbortSignal.timeout(10_000)
            )
          ).handle
        } catch {
          /* A public profile failure must not invalidate authorization. */
        }
        return { did: oauth.sub, handle, oauth }
      } catch (error) {
        throw new Error(authErrorMessage(error))
      }
    })()
  }
  return initialization
}

export async function signIn(handle: string): Promise<void> {
  try {
    await getClient().signIn(handle.trim().replace(/^@/, ''), { scope: OAUTH_SCOPE })
  } catch (error) {
    throw new Error(authErrorMessage(error))
  }
}

export async function signOut(session: BlueskySession): Promise<void> {
  await session.oauth.signOut()
}

export function onSessionDeleted(listener: (did: string) => void): () => void {
  deletedListeners.add(listener)
  return () => {
    deletedListeners.delete(listener)
  }
}
