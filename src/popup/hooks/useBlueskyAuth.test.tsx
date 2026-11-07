import { StrictMode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { BlueskySession } from '../../types'
import { useBlueskyAuth } from './useBlueskyAuth'
const api = vi.hoisted(() => ({
  initializeAuth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  deleted: null as ((did: string) => void) | null,
}))
vi.mock('../../api/auth', () => ({
  ...api,
  authErrorMessage: () => 'Could not sign in',
  onSessionDeleted: (listener: (did: string) => void) => {
    api.deleted = listener
    return () => {
      api.deleted = null
    }
  },
}))
const session = { did: 'did:plc:test', handle: 'test.example', oauth: {} } as BlueskySession
beforeEach(() => {
  vi.clearAllMocks()
  api.initializeAuth.mockResolvedValue(session)
  api.signOut.mockResolvedValue(undefined)
})
it('does not expose authenticated state until initialization resolves, including StrictMode', async () => {
  let resolve!: (session: BlueskySession) => void
  api.initializeAuth.mockReturnValue(
    new Promise((done) => {
      resolve = done
    })
  )
  const { result } = renderHook(useBlueskyAuth, { wrapper: StrictMode })
  expect(result.current.session).toBeNull()
  expect(result.current.isLoading).toBe(true)
  await act(async () => resolve(session))
  expect(result.current.session).toBe(session)
  expect(result.current.isLoading).toBe(false)
})
it('clears revoked sessions and ignores deletion of another account', async () => {
  const { result } = renderHook(useBlueskyAuth)
  await waitFor(() => expect(result.current.session).toBe(session))
  act(() => api.deleted?.('did:plc:other'))
  expect(result.current.session).toBe(session)
  act(() => api.deleted?.(session.did))
  expect(result.current.session).toBeNull()
  expect(result.current.error).toMatch(/revoked/)
})
it('calls SDK signout boundary and clears UI even if revocation fails', async () => {
  api.signOut.mockRejectedValue(new Error('offline'))
  const { result } = renderHook(useBlueskyAuth)
  await waitFor(() => expect(result.current.session).toBe(session))
  await act(async () => result.current.logout())
  expect(api.signOut).toHaveBeenCalledWith(session)
  expect(result.current.session).toBeNull()
  expect(result.current.error).toMatch(/revocation could not be confirmed/)
})
it('describes local signout without claiming server revocation when SDK resolves', async () => {
  const { result } = renderHook(useBlueskyAuth)
  await waitFor(() => expect(result.current.session).toBe(session))
  await act(async () => result.current.logout())
  expect(result.current.notice).toBe(
    'Signed out on this device. Manage connected-app access in Bluesky settings.'
  )
  expect(result.current.error).toBeNull()
  expect(result.current.session).toBeNull()
  await act(async () => result.current.login('test.example'))
  expect(api.signIn).toHaveBeenCalledWith('test.example')
  expect(result.current.session).toBeNull()
})
it('reports failed restore instead of silently treating it as a valid session', async () => {
  api.initializeAuth.mockRejectedValue(new Error('Session expired'))
  const { result } = renderHook(useBlueskyAuth)
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.session).toBeNull()
  expect(result.current.error).toBe('Session expired')
})
