import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useInteractions } from './useInteractions'
import { fetchInteractions } from '../../api/interactions'
vi.mock('../../api/interactions', () => ({ fetchInteractions: vi.fn() }))
it('ignores stale analysis completion after reset/logout', async () => {
  let complete!: (users: never[]) => void
  vi.mocked(fetchInteractions).mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve
      })
  )
  const { result } = renderHook(useInteractions)
  let pending!: Promise<unknown>
  act(() => {
    pending = result.current.analyze('test.example', '30d')
  })
  act(() => result.current.reset())
  await act(async () => {
    complete([{ did: 'did:plc:stale' }] as never[])
    await pending
  })
  expect(result.current.users).toEqual([])
  expect(result.current.isLoading).toBe(false)
})
