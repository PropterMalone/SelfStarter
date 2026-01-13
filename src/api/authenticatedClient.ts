import type { BlueskySession } from '../types'
import { authenticatedPost, authenticatedGet, BlueskyApiError } from './client'
import { refreshSession } from './auth'

type SessionUpdateCallback = (session: BlueskySession) => void

/**
 * Client that handles authenticated API calls with automatic token refresh.
 * When an access token expires, it automatically refreshes using the refresh token
 * and retries the request.
 */
export class AuthenticatedClient {
  private session: BlueskySession
  private onSessionUpdate: SessionUpdateCallback

  constructor(session: BlueskySession, onSessionUpdate: SessionUpdateCallback) {
    this.session = session
    this.onSessionUpdate = onSessionUpdate
  }

  private async refreshAndRetry<T>(request: (accessJwt: string) => Promise<T>): Promise<T> {
    try {
      const newSession = await refreshSession(this.session.refreshJwt)
      this.session = newSession
      this.onSessionUpdate(newSession)
      return await request(newSession.accessJwt)
    } catch (refreshError) {
      // Refresh failed - token is likely completely expired
      if (refreshError instanceof BlueskyApiError) {
        throw new BlueskyApiError(
          401,
          'ExpiredToken',
          'Session expired. Please log in again.'
        )
      }
      throw refreshError
    }
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    try {
      return await authenticatedPost<T>(endpoint, this.session.accessJwt, body)
    } catch (error) {
      if (error instanceof BlueskyApiError && error.status === 401) {
        return this.refreshAndRetry((jwt) => authenticatedPost<T>(endpoint, jwt, body))
      }
      throw error
    }
  }

  async get<T>(endpoint: string, params?: Record<string, string | number | undefined>): Promise<T> {
    try {
      return await authenticatedGet<T>(endpoint, this.session.accessJwt, params)
    } catch (error) {
      if (error instanceof BlueskyApiError && error.status === 401) {
        return this.refreshAndRetry((jwt) => authenticatedGet<T>(endpoint, jwt, params))
      }
      throw error
    }
  }

  getSession(): BlueskySession {
    return this.session
  }
}
