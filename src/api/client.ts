import type { ApiError } from '../types'

const BSKY_PUBLIC_API = 'https://public.api.bsky.app'
const BSKY_API = 'https://bsky.social'

export class BlueskyApiError extends Error {
  status: number
  error: string

  constructor(status: number, error: string, message: string) {
    super(message)
    this.name = 'BlueskyApiError'
    this.status = status
    this.error = error
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as ApiError
    throw new BlueskyApiError(
      response.status,
      errorData.error || 'Unknown',
      errorData.message || response.statusText
    )
  }
  return response.json() as Promise<T>
}

export async function publicGet<T>(
  endpoint: string,
  params?: Record<string, string | number | string[] | undefined>
): Promise<T> {
  // com.atproto.* endpoints are on the PDS, not the public AppView
  const baseUrl = endpoint.startsWith('com.atproto.') ? BSKY_API : BSKY_PUBLIC_API
  const url = new URL(`${baseUrl}/xrpc/${endpoint}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          for (const v of value) {
            url.searchParams.append(key, v)
          }
        } else {
          url.searchParams.set(key, String(value))
        }
      }
    }
  }

  const response = await fetch(url.toString())
  return handleResponse<T>(response)
}

export async function authenticatedPost<T>(
  endpoint: string,
  accessJwt: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(`${BSKY_API}/xrpc/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessJwt}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(response)
}

export async function authenticatedGet<T>(
  endpoint: string,
  accessJwt: string,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const url = new URL(`${BSKY_API}/xrpc/${endpoint}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessJwt}`,
    },
  })
  return handleResponse<T>(response)
}

export async function unauthenticatedPost<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(`${BSKY_API}/xrpc/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return handleResponse<T>(response)
}
