// pattern: Imperative Shell
import type { BlueskyProfile, TimePeriod, InteractionUser } from '../types'
import { publicGet } from './client'
import { normalizeMentionHandle } from './mentionHandle'
import { downloadAndParseRepo, getLatestCommit, filterByPeriod, type ParsedInteractions } from './carFetcher'

const PROFILE_BATCH_SIZE = 20

function checkCancellation(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Analysis stopped', 'AbortError')
}

interface RepoCache {
  did: string
  rev: string
  parsed: ParsedInteractions
}
let repoCache: RepoCache | null = null

export function _resetCache() {
  repoCache = null
}

interface ProfileView {
  did: string
  handle: string
  displayName?: string
  avatar?: string
  description?: string
}
interface GetProfilesResponse {
  profiles: ProfileView[]
}

export async function resolveHandle(handle: string, signal?: AbortSignal): Promise<string> {
  checkCancellation(signal)
  const response = await publicGet<{ did: string }>('com.atproto.identity.resolveHandle', { handle }, signal)
  checkCancellation(signal)
  return response.did
}

export async function getProfile(actor: string, signal?: AbortSignal): Promise<BlueskyProfile> {
  checkCancellation(signal)
  const response = await publicGet<ProfileView>('app.bsky.actor.getProfile', { actor }, signal)
  checkCancellation(signal)
  return {
    did: response.did,
    handle: response.handle,
    displayName: response.displayName,
    avatar: response.avatar,
    description: response.description,
  }
}

function extractDidFromUri(uri: string): string | null {
  const match = uri.match(/^at:\/\/(did:[^/]+)\//)
  return match ? match[1] : null
}

interface InteractionCounts {
  likes: number
  replies: number
  reposts: number
  mentions: number
  quotes: number
}

export async function fetchInteractions(
  handle: string,
  period: TimePeriod,
  onProgress?: (message: string, completed: number, total?: number) => void,
  signal?: AbortSignal
): Promise<InteractionUser[]> {
  checkCancellation(signal)
  onProgress?.('Resolving handle...', 0)
  const did = await resolveHandle(handle, signal)
  checkCancellation(signal)
  onProgress?.('Checking for updates...', 0)

  let latest: Awaited<ReturnType<typeof getLatestCommit>> | undefined
  try {
    latest = await getLatestCommit(did, signal)
  } catch (error) {
    checkCancellation(signal)
    if (error instanceof Error && error.name === 'AbortError') throw error
    // A failed revision check may still allow a direct repository download.
  }
  checkCancellation(signal)

  let rawParsed: ParsedInteractions
  if (latest && repoCache?.did === did && repoCache.rev === latest.rev) {
    onProgress?.('Using cached data (no changes detected)...', 0)
    rawParsed = repoCache.parsed
  } else {
    rawParsed = await downloadAndParseRepo(did, (message) => {
      checkCancellation(signal)
      onProgress?.(message, 0)
    }, latest?.pdsUrl, signal)
    checkCancellation(signal)
    repoCache = { did, rev: latest?.rev ?? rawParsed.rev, parsed: rawParsed }
  }

  const parsed = filterByPeriod(rawParsed, period)
  checkCancellation(signal)
  onProgress?.('Counting interactions...', 0)
  const interactionCounts = new Map<string, InteractionCounts>()
  function addInteraction(targetDid: string | null, type: keyof InteractionCounts, count = 1) {
    if (!targetDid || targetDid === did || count === 0) return
    const counts = interactionCounts.get(targetDid) ?? { likes: 0, replies: 0, reposts: 0, mentions: 0, quotes: 0 }
    counts[type] += count
    interactionCounts.set(targetDid, counts)
  }
  for (const like of parsed.likes) addInteraction(extractDidFromUri(like.uri), 'likes')
  for (const reply of parsed.replies) addInteraction(extractDidFromUri(reply.parentUri), 'replies')
  for (const repost of parsed.reposts) addInteraction(extractDidFromUri(repost.uri), 'reposts')
  for (const quote of parsed.quotes) addInteraction(extractDidFromUri(quote.uri), 'quotes')

  const mentionsByHandle = new Map<string, number>()
  for (const mention of parsed.mentions) {
    const handle = normalizeMentionHandle(mention.handle)
    if (!handle) continue
    mentionsByHandle.set(handle, (mentionsByHandle.get(handle) ?? 0) + 1)
  }

  // Keep every aggregate: changing weights must be able to recover any candidate.
  const didsToFetch = Array.from(interactionCounts.keys())
  const handlesToResolve = Array.from(mentionsByHandle.keys())
  const total = didsToFetch.length + handlesToResolve.length
  let completed = 0
  const reportProfiles = () => {
    checkCancellation(signal)
    onProgress?.(`Fetching profiles ${completed} of ${total}`, completed, total)
    checkCancellation(signal)
  }
  reportProfiles()
  const profiles = new Map<string, ProfileView>()

  async function fetchProfiles(actors: string[], mentions: boolean) {
    for (let offset = 0; offset < actors.length; offset += PROFILE_BATCH_SIZE) {
      checkCancellation(signal)
      const batch = actors.slice(offset, offset + PROFILE_BATCH_SIZE)
      const response = await publicGet<GetProfilesResponse>('app.bsky.actor.getProfiles', { actors: batch }, signal)
      checkCancellation(signal)
      // A successful response may omit unavailable profiles. Failed requests reject the analysis.
      for (const profile of response.profiles) {
        profiles.set(profile.did, profile)
        if (mentions) addInteraction(profile.did, 'mentions', mentionsByHandle.get(profile.handle) ?? 0)
      }
      completed += batch.length
      reportProfiles()
    }
  }
  await fetchProfiles(didsToFetch, false)
  await fetchProfiles(handlesToResolve, true)
  checkCancellation(signal)

  const users: InteractionUser[] = []
  for (const [targetDid, counts] of interactionCounts) {
    const profile = profiles.get(targetDid)
    if (profile) users.push({
      did: profile.did,
      handle: profile.handle,
      displayName: profile.displayName,
      avatar: profile.avatar,
      interactionCount: counts.likes + counts.replies + counts.reposts + counts.mentions + counts.quotes,
      interactions: counts,
    })
  }
  return users.sort((a, b) => b.interactionCount - a.interactionCount)
}
