import { beforeEach, expect, it } from 'vitest'
import { saveRedirectDraft, readRedirectDraft, clearRedirectDraft } from './redirectDraft'
const draft = {
  handle: 'public.example',
  period: '30d' as const,
  users: [
    {
      did: 'did:plc:member',
      handle: 'member.example',
      interactionCount: 1,
      interactions: { likes: 1, replies: 0, reposts: 0, mentions: 0, quotes: 0 },
    },
  ],
  selectedDids: ['did:plc:member'],
  loginHint: 'owner.example',
  ownerDid: null,
  name: 'Draft',
  description: 'Reviewed',
}
beforeEach(() => sessionStorage.clear())
it('restores reviewed selection and text for the intended account without credentials', () => {
  saveRedirectDraft(draft)
  expect(readRedirectDraft({ did: 'did:plc:owner', handle: 'owner.example' })).toMatchObject(draft)
  expect(sessionStorage.getItem('selfstarter_oauth_draft')).not.toMatch(
    /accessJwt|refreshJwt|password|oauth/
  )
  clearRedirectDraft()
  expect(readRedirectDraft(null)).toBeNull()
})
it('rejects another account, expired data, duplicates, and selected accounts absent from results', () => {
  saveRedirectDraft(draft)
  expect(readRedirectDraft({ did: 'did:plc:other', handle: 'other.example' })).toBeNull()
  saveRedirectDraft(draft, 0)
  expect(readRedirectDraft(null)).toBeNull()
  for (const selectedDids of [['did:plc:missing'], ['did:plc:member', 'did:plc:member']]) {
    expect(() => saveRedirectDraft({ ...draft, selectedDids })).toThrow()
  }
})
it('checks generated account bindings independently of selection contents', () => {
  for (let index = 0; index < 32; index++) {
    const ownerDid = index % 2 ? 'did:plc:owner' : null
    const intended = index % 4 < 2
    const selectedDids = index % 3 ? ['did:plc:member'] : []
    saveRedirectDraft({ ...draft, ownerDid, selectedDids })
    const account = intended
      ? { did: 'did:plc:owner', handle: 'owner.example' }
      : { did: 'did:plc:other', handle: 'other.example' }
    const restored = readRedirectDraft(account)
    expect(restored !== null).toBe(intended)
    if (restored) expect(restored.selectedDids).toEqual(selectedDids)
  }
})
it('never persists injected credential-like fields in a caller object', () => {
  saveRedirectDraft({ ...draft, oauth: { token: 'secret' }, accessJwt: 'secret' } as typeof draft)
  expect(sessionStorage.getItem('selfstarter_oauth_draft')).not.toContain('secret')
})
it('keeps an explicitly empty selection and rejects malformed/oversized stored data', () => {
  saveRedirectDraft({ ...draft, selectedDids: [] })
  expect(readRedirectDraft(null)?.selectedDids).toEqual([])
  sessionStorage.setItem('selfstarter_oauth_draft', 'x'.repeat(2_000_001))
  expect(readRedirectDraft(null)).toBeNull()
  sessionStorage.setItem('selfstarter_oauth_draft', '{bad')
  expect(readRedirectDraft(null)).toBeNull()
})
