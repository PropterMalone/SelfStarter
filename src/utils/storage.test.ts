import { expect, it } from 'vitest'
import { purgeLegacySession } from './storage'

it('deletes legacy app-password credentials without touching other application data', () => {
  localStorage.setItem('selfstarter_session', '{"accessJwt":"secret"}')
  localStorage.setItem('unrelated', 'keep')
  purgeLegacySession()
  expect(localStorage.getItem('selfstarter_session')).toBeNull()
  expect(localStorage.getItem('unrelated')).toBe('keep')
})
