import { describe, expect, it } from 'vitest'
import { normalizeMentionHandle } from './mentionHandle'

describe('normalizeMentionHandle', () => {
  it('removes sentence-ending periods without changing the domain', () => {
    expect(normalizeMentionHandle('person.bsky.social.')).toBe('person.bsky.social')
    expect(normalizeMentionHandle('person.bsky.social...')).toBe('person.bsky.social')
    expect(normalizeMentionHandle('Person.Example')).toBe('person.example')
  })
  it('rejects malformed fragments before they can poison a profile batch', () => {
    for (const handle of ['hello', '.', 'person..example', '-person.example', 'person-.example', 'person.123', `${'a'.repeat(64)}.example`]) {
      expect(normalizeMentionHandle(handle)).toBeNull()
    }
  })
})
