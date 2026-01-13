import { describe, it, expect, vi, beforeEach } from 'vitest'
import { publicGet, authenticatedPost, authenticatedGet, unauthenticatedPost, BlueskyApiError } from './client'

const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
})

describe('BlueskyApiError', () => {
  it('creates error with status, error code, and message', () => {
    const error = new BlueskyApiError(401, 'AuthRequired', 'Authentication required')
    expect(error.status).toBe(401)
    expect(error.error).toBe('AuthRequired')
    expect(error.message).toBe('Authentication required')
    expect(error.name).toBe('BlueskyApiError')
  })
})

describe('publicGet', () => {
  it('makes GET request to public API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    })

    const result = await publicGet<{ data: string }>('test.endpoint')
    expect(result).toEqual({ data: 'test' })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://public.api.bsky.app/xrpc/test.endpoint'
    )
  })

  it('includes query parameters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    })

    await publicGet('test.endpoint', { foo: 'bar', num: 123 })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://public.api.bsky.app/xrpc/test.endpoint?foo=bar&num=123'
    )
  })

  it('excludes undefined parameters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    })

    await publicGet('test.endpoint', { foo: 'bar', missing: undefined })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://public.api.bsky.app/xrpc/test.endpoint?foo=bar'
    )
  })

  it('throws BlueskyApiError on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ error: 'NotFound', message: 'Resource not found' }),
    })

    const error = await publicGet('test.endpoint').catch((e) => e)
    expect(error).toBeInstanceOf(BlueskyApiError)
    expect(error.status).toBe(404)
    expect(error.error).toBe('NotFound')
    expect(error.message).toBe('Resource not found')
  })

  it('handles JSON parse error in error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: () => Promise.reject(new Error('parse error')),
    })

    const error = await publicGet('test.endpoint').catch((e) => e)
    expect(error).toBeInstanceOf(BlueskyApiError)
    expect(error.status).toBe(500)
    expect(error.error).toBe('Unknown')
  })
})

describe('authenticatedPost', () => {
  it('makes POST request with auth header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })

    const result = await authenticatedPost('test.endpoint', 'jwt-token', { data: 'test' })
    expect(result).toEqual({ success: true })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://bsky.social/xrpc/test.endpoint',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer jwt-token',
        },
        body: JSON.stringify({ data: 'test' }),
      }
    )
  })

  it('handles empty body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    })

    await authenticatedPost('test.endpoint', 'jwt-token')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://bsky.social/xrpc/test.endpoint',
      expect.objectContaining({
        body: undefined,
      })
    )
  })
})

describe('authenticatedGet', () => {
  it('makes GET request with auth header and params', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    })

    const result = await authenticatedGet('test.endpoint', 'jwt-token', { param: 'value' })
    expect(result).toEqual({ data: 'test' })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://bsky.social/xrpc/test.endpoint?param=value',
      {
        headers: {
          Authorization: 'Bearer jwt-token',
        },
      }
    )
  })
})

describe('unauthenticatedPost', () => {
  it('makes POST request without auth header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: 'ok' }),
    })

    const result = await unauthenticatedPost('test.endpoint', { user: 'test' })
    expect(result).toEqual({ result: 'ok' })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://bsky.social/xrpc/test.endpoint',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user: 'test' }),
      }
    )
  })
})
