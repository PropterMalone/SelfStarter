import type { BlueskyProfile, TimePeriod, InteractionUser } from '../types'
import { publicGet } from './client'
import { downloadAndParseRepo, getLatestCommit, filterByPeriod, type ParsedInteractions } from './carFetcher'

// Cache for parsed repo data to avoid re-downloading
interface RepoCache {
  did: string
  rev: string
  parsed: ParsedInteractions
}

let repoCache: RepoCache | null = null

// For testing: allows resetting the module-level cache
export function _resetCache() {
  repoCache = null
}

interface ResolveHandleResponse {
  did: string
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

export async function resolveHandle(handle: string): Promise<string> {
  const response = await publicGet<ResolveHandleResponse>('com.atproto.identity.resolveHandle', {
    handle,
  })
  return response.did
}

export async function getProfile(actor: string): Promise<BlueskyProfile> {
  const response = await publicGet<ProfileView>('app.bsky.actor.getProfile', {
    actor,
  })
  return {
    did: response.did,
    handle: response.handle,
    displayName: response.displayName,
    avatar: response.avatar,
    description: response.description,
  }
}

// Extract DID from an AT URI (at://did:plc:xxx/collection/rkey)
function extractDidFromUri(uri: string): string | null {
  const match = uri.match(/^at:\/\/(did:[^/]+)\//)
  return match ? match[1] : null
}

interface InteractionCounts {
  likes: number
  replies: number
  reposts: number
  mentions: number
}

export async function fetchInteractions(
  handle: string,
  period: TimePeriod,
  onProgress?: (stage: string, count: number) => void
): Promise<InteractionUser[]> {
  const did = await resolveHandle(handle)
  onProgress?.('Resolving handle...', 0)

  // Check if we have a cached version and if the repo has changed
  let rawParsed: ParsedInteractions
  onProgress?.('Checking for updates...', 0)

  try {
    const { rev: latestRev, pdsUrl } = await getLatestCommit(did)

    if (repoCache && repoCache.did === did && repoCache.rev === latestRev) {
      // Repo hasn't changed, use cached data
      onProgress?.('Using cached data (no changes detected)...', 0)
      rawParsed = repoCache.parsed
    } else {
      // Need to download - either no cache or repo has changed
      if (repoCache && repoCache.did === did) {
        onProgress?.('Repository updated, downloading changes...', 0)
      }
      rawParsed = await downloadAndParseRepo(did, (stage) => {
        onProgress?.(stage, 0)
      }, pdsUrl)

      // Update cache with raw (unfiltered) data
      repoCache = { did, rev: rawParsed.rev, parsed: rawParsed }
    }
  } catch {
    // Fallback: if getLatestCommit fails, just download
    rawParsed = await downloadAndParseRepo(did, (stage) => {
      onProgress?.(stage, 0)
    })
    repoCache = { did, rev: rawParsed.rev, parsed: rawParsed }
  }

  // Apply time period filter
  const parsed = filterByPeriod(rawParsed, period)
  onProgress?.(`Filtered to ${parsed.likes.length} likes, ${parsed.replies.length} replies, ${parsed.reposts.length} reposts in selected period`, 0)

  // Step 1: Count interactions by DID without any API calls
  // We can extract DIDs directly from the post URIs
  const interactionCounts = new Map<string, InteractionCounts>()

  function addInteractionByDid(targetDid: string | null, type: keyof InteractionCounts) {
    if (!targetDid || targetDid === did) return // Skip self-interactions

    const existing = interactionCounts.get(targetDid)
    if (existing) {
      existing[type]++
    } else {
      interactionCounts.set(targetDid, { likes: 0, replies: 0, reposts: 0, mentions: 0, [type]: 1 })
    }
  }

  // Count likes by author DID (extracted from URI)
  for (const like of parsed.likes) {
    addInteractionByDid(extractDidFromUri(like.uri), 'likes')
  }

  // Count replies by parent author DID
  for (const reply of parsed.replies) {
    addInteractionByDid(extractDidFromUri(reply.parentUri), 'replies')
  }

  // Count reposts by author DID
  for (const repost of parsed.reposts) {
    addInteractionByDid(extractDidFromUri(repost.uri), 'reposts')
  }

  // For mentions, we need to resolve handles to DIDs
  // Group mentions by handle first to minimize lookups
  const mentionsByHandle = new Map<string, number>()
  for (const mention of parsed.mentions) {
    mentionsByHandle.set(mention.handle, (mentionsByHandle.get(mention.handle) || 0) + 1)
  }

  onProgress?.('Counting interactions...', 0)

  // Step 2: Sort DIDs by total interaction count and take top N
  const TOP_N = 250 // Fetch a bit more than 200 to account for failed lookups

  const sortedDids = Array.from(interactionCounts.entries())
    .map(([targetDid, counts]) => ({
      did: targetDid,
      counts,
      total: counts.likes + counts.replies + counts.reposts + counts.mentions,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_N)

  onProgress?.(`Found ${interactionCounts.size} unique accounts, fetching top ${sortedDids.length} profiles...`, 0)

  // Step 3: Batch fetch profiles for top DIDs using getProfiles (25 at a time)
  const profiles = new Map<string, ProfileView>()
  const didsToFetch = sortedDids.map((d) => d.did)

  for (let i = 0; i < didsToFetch.length; i += 25) {
    const batch = didsToFetch.slice(i, i + 25)
    try {
      const response = await publicGet<GetProfilesResponse>('app.bsky.actor.getProfiles', {
        actors: batch,
      })
      for (const profile of response.profiles) {
        profiles.set(profile.did, profile)
      }
    } catch {
      // Some profiles may not exist
    }
    onProgress?.(`Fetching profiles... ${Math.min(i + 25, didsToFetch.length)}/${didsToFetch.length}`, Math.min(i + 25, didsToFetch.length))

    // Small delay to avoid rate limiting
    if (i + 25 < didsToFetch.length) {
      await new Promise((r) => setTimeout(r, 50))
    }
  }

  // Step 4: Resolve mention handles and add to counts
  // Only resolve handles that might be in our top N
  const handlesToResolve = Array.from(mentionsByHandle.keys()).slice(0, 100) // Limit mention lookups

  if (handlesToResolve.length > 0) {
    onProgress?.('Resolving mentions...', 0)

    for (let i = 0; i < handlesToResolve.length; i += 25) {
      const batch = handlesToResolve.slice(i, i + 25)
      try {
        const response = await publicGet<GetProfilesResponse>('app.bsky.actor.getProfiles', {
          actors: batch,
        })
        for (const profile of response.profiles) {
          const mentionCount = mentionsByHandle.get(profile.handle) || 0
          if (mentionCount > 0) {
            profiles.set(profile.did, profile)
            const existing = interactionCounts.get(profile.did)
            if (existing) {
              existing.mentions += mentionCount
            } else {
              interactionCounts.set(profile.did, { likes: 0, replies: 0, reposts: 0, mentions: mentionCount })
            }
          }
        }
      } catch {
        // Some handles may not exist
      }
      onProgress?.(`Resolving mentions... ${Math.min(i + 25, handlesToResolve.length)}/${handlesToResolve.length}`, 0)
    }
  }

  // Step 5: Build final user list from profiles we successfully fetched
  const users: InteractionUser[] = []

  for (const [targetDid, counts] of interactionCounts) {
    const profile = profiles.get(targetDid)
    if (profile) {
      users.push({
        did: profile.did,
        handle: profile.handle,
        displayName: profile.displayName,
        avatar: profile.avatar,
        interactionCount: counts.likes + counts.replies + counts.reposts + counts.mentions,
        interactions: counts,
      })
    }
  }

  return users.sort((a, b) => b.interactionCount - a.interactionCount).slice(0, 200)
}
