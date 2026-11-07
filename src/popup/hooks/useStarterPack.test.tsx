import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { BlueskySession } from '../../types'
import { useStarterPack } from './useStarterPack'
import { createStarterPack } from '../../api/starterPack'
vi.mock('../../api/starterPack', () => ({ createStarterPack: vi.fn() }))
it('does not resurrect publication success after reset or account invalidation', async () => {
  let complete!: (url: string) => void
  vi.mocked(createStarterPack).mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve
      })
  )
  const { result } = renderHook(useStarterPack)
  let pending!: Promise<string>
  act(() => {
    pending = result.current.publish({ did: 'did:plc:test' } as BlueskySession, 'Name', '', [])
  })
  act(() => result.current.reset())
  await act(async () => {
    complete('https://bsky.app/starter-pack/synthetic/test')
    await pending
  })
  expect(result.current.publishedUrl).toBeNull()
  expect(result.current.isPublishing).toBe(false)
})
