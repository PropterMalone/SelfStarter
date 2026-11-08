import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useInteractions } from './useInteractions'
import { fetchInteractions } from '../../api/interactions'
import type { InteractionUser } from '../../types'

vi.mock('../../api/interactions', () => ({ fetchInteractions: vi.fn() }))
beforeEach(() => { vi.mocked(fetchInteractions).mockReset() })

it('aborts pending work and ignores stale completion after reset/logout', async () => {
  let complete!: (users: InteractionUser[]) => void
  let signal: AbortSignal | undefined
  vi.mocked(fetchInteractions).mockImplementation((_handle, _period, _progress, inputSignal) => {
    signal = inputSignal
    return new Promise((resolve) => { complete = resolve })
  })
  const { result } = renderHook(useInteractions)
  let pending!: Promise<unknown>
  act(() => { pending = result.current.analyze('test.invalid', '30d') })
  act(() => result.current.reset())
  expect(signal?.aborted).toBe(true)
  await act(async () => {
    complete([{ did: 'did:plc:stale' }] as InteractionUser[])
    await pending
  })
  expect(result.current.users).toEqual([])
  expect(result.current.isLoading).toBe(false)
})

it('cancels a run without displaying a generic error', async () => {
  vi.mocked(fetchInteractions).mockImplementation((_handle, _period, progress, signal) => {
    progress?.('Fetching profiles 20 of 41', 20, 41)
    return new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')))
    })
  })
  const { result } = renderHook(useInteractions)
  let pending!: Promise<unknown>
  act(() => { pending = result.current.analyze('test.invalid', '30d') })
  expect(result.current.progress).toBe('Fetching profiles 20 of 41')
  expect(result.current.analysisProgress).toEqual({
    stage: 'analyzing', message: 'Fetching profiles 20 of 41', progress: 20 / 41 * 100,
  })
  await act(async () => { result.current.cancel(); await pending })
  expect(result.current.isLoading).toBe(false)
  expect(result.current.users).toEqual([])
  expect(result.current.error).toBeNull()
  expect(result.current.progress).toBeNull()
  expect(result.current.analysisProgress).toBeNull()
})

it('aborts the previous run and prevents its callbacks changing the new run', async () => {
  const requests: { signal?: AbortSignal; progress?: Parameters<typeof fetchInteractions>[2]; resolve: (users: InteractionUser[]) => void }[] = []
  vi.mocked(fetchInteractions).mockImplementation((_handle, _period, progress, signal) =>
    new Promise((resolve) => { requests.push({ signal, progress, resolve }) })
  )
  const { result } = renderHook(useInteractions)
  let first!: Promise<unknown>
  let second!: Promise<unknown>
  act(() => { first = result.current.analyze('first.invalid', '30d') })
  act(() => { second = result.current.analyze('second.invalid', '30d') })
  expect(requests[0].signal?.aborted).toBe(true)
  expect(requests[1].signal?.aborted).toBe(false)
  await act(async () => {
    requests[0].progress?.('Stale progress', 1)
    requests[0].resolve([{ did: 'did:plc:stale' }] as InteractionUser[])
    await first
  })
  expect(result.current.users).toEqual([])
  expect(result.current.isLoading).toBe(true)
  expect(result.current.progress).toBe('Starting analysis...')
  await act(async () => { requests[1].resolve([]); await second })
  expect(result.current.isLoading).toBe(false)
})

it('aborts the active transport on unmount', async () => {
  let signal: AbortSignal | undefined
  vi.mocked(fetchInteractions).mockImplementation((_handle, _period, _progress, inputSignal) => {
    signal = inputSignal
    return new Promise(() => {})
  })
  const { result, unmount } = renderHook(useInteractions)
  act(() => { void result.current.analyze('test.invalid', '30d') })
  unmount()
  expect(signal?.aborted).toBe(true)
})
