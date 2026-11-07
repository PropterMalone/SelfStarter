// pattern: Imperative Shell
import type { InteractionUser, TimePeriod } from '../types'

const KEY = 'selfstarter_oauth_draft'
const MAX_BYTES = 2_000_000
const MAX_AGE = 30 * 60 * 1000
export interface RedirectDraft {
  handle: string
  period: TimePeriod
  users: InteractionUser[]
  selectedDids: string[]
  loginHint: string
  ownerDid: string | null
  name: string
  description: string
}
const shortString = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length <= max
const did = (value: unknown): value is string =>
  shortString(value, 2048) && /^did:[a-z]+:[A-Za-z0-9._:%-]+$/.test(value)

function valid(value: unknown): value is RedirectDraft {
  if (!value || typeof value !== 'object') return false
  const d = value as RedirectDraft
  if (
    !shortString(d.handle, 253) ||
    !d.handle ||
    !shortString(d.loginHint, 253) ||
    !d.loginHint ||
    !['7d', '30d', '90d', '1y', 'all'].includes(d.period) ||
    !(d.ownerDid === null || did(d.ownerDid)) ||
    !shortString(d.name, 500) ||
    !shortString(d.description, 3000) ||
    !Array.isArray(d.users) ||
    d.users.length > 5000 ||
    !Array.isArray(d.selectedDids) ||
    d.selectedDids.length > 150
  )
    return false
  const ids = new Set<string>()
  for (const user of d.users) {
    if (
      !user ||
      !did(user.did) ||
      ids.has(user.did) ||
      !shortString(user.handle, 253) ||
      !shortString(user.displayName ?? '', 1000) ||
      !shortString(user.avatar ?? '', 4096) ||
      !Number.isFinite(user.interactionCount) ||
      user.interactionCount < 0 ||
      !user.interactions ||
      !['likes', 'replies', 'reposts', 'mentions', 'quotes'].every(
        (key) =>
          Number.isSafeInteger(user.interactions[key as keyof typeof user.interactions]) &&
          user.interactions[key as keyof typeof user.interactions] >= 0
      )
    )
      return false
    ids.add(user.did)
  }
  return (
    new Set(d.selectedDids).size === d.selectedDids.length &&
    d.selectedDids.every((id) => ids.has(id))
  )
}

export function saveRedirectDraft(draft: RedirectDraft, now = Date.now()): void {
  if (!valid(draft))
    throw new Error(
      'Cannot preserve this selection for sign in. Select at most 150 distinct accounts.'
    )
  // Explicit fields only: never serialize an OAuth session or arbitrary caller data.
  const { handle, period, loginHint, ownerDid, name, description, selectedDids } = draft
  const users = draft.users.map(
    ({ did, handle, displayName, avatar, interactionCount, interactions }) => ({
      did,
      handle,
      displayName,
      avatar,
      interactionCount,
      interactions: {
        likes: interactions.likes,
        replies: interactions.replies,
        reposts: interactions.reposts,
        mentions: interactions.mentions,
        quotes: interactions.quotes,
      },
    })
  )
  const encoded = JSON.stringify({
    version: 1,
    savedAt: now,
    handle,
    period,
    loginHint,
    ownerDid,
    name,
    description,
    selectedDids,
    users,
  })
  if (new TextEncoder().encode(encoded).length > MAX_BYTES)
    throw new Error(
      'This analysis is too large to preserve across sign in. Sign in before analyzing.'
    )
  sessionStorage.setItem(KEY, encoded)
}

export function readRedirectDraft(
  account: { did: string; handle: string } | null,
  now = Date.now()
): RedirectDraft | null {
  try {
    const encoded = sessionStorage.getItem(KEY)
    if (
      !encoded ||
      encoded.length > MAX_BYTES ||
      new TextEncoder().encode(encoded).length > MAX_BYTES
    )
      return null
    const value: unknown = JSON.parse(encoded)
    if (!value || typeof value !== 'object') return null
    const envelope = value as { version?: number; savedAt?: number }
    if (
      envelope.version !== 1 ||
      typeof envelope.savedAt !== 'number' ||
      envelope.savedAt > now ||
      now - envelope.savedAt > MAX_AGE ||
      !valid(value)
    )
      return null
    if (
      account &&
      (value.ownerDid
        ? value.ownerDid !== account.did
        : value.loginHint.toLowerCase() !== account.handle.toLowerCase() &&
          value.loginHint !== account.did)
    )
      return null
    return value
  } catch {
    return null
  }
}

export function clearRedirectDraft(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* No credentials or persistent authority are stored here. */
  }
}
