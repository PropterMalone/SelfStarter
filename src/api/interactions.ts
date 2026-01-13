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

interface GetProfileResponse extends ProfileView {}

interface PostView {
  uri: string
  cid: string
  author: ProfileView
  record: {
    text?: string
    createdAt: string
  }
}

interface GetPostsResponse {
  posts: PostView[]
}

export async function resolveHandle(handle: string): Promise<string> {
  const response = await publicGet<ResolveHandleResponse>('com.atproto.identity.resolveHandle', {
    handle,
  })
  return response.did
}

export async function getProfile(actor: string): Promise<BlueskyProfile> {
  const response = await publicGet<GetProfileResponse>('app.bsky.actor.getProfile', {
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

  const interactions = new Map<string, { profile: ProfileView; counts: InteractionCounts }>()

  function addInteraction(
    profile: ProfileView,
    type: 'likes' | 'replies' | 'reposts' | 'mentions'
  ) {
    if (profile.did === did) return

    const existing = interactions.get(profile.did)
    if (existing) {
      existing.counts[type]++
    } else {
      interactions.set(profile.did, {
        profile,
        counts: { likes: 0, replies: 0, reposts: 0, mentions: 0, [type]: 1 },
      })
    }
  }

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

  // Collect all unique post URIs we need to resolve
  const postUris = new Set<string>()
  for (const like of parsed.likes) {
    postUris.add(like.uri)
  }
  for (const reply of parsed.replies) {
    postUris.add(reply.parentUri)
  }
  for (const repost of parsed.reposts) {
    postUris.add(repost.uri)
  }

  // Batch resolve posts to get author profiles
  const uriList = Array.from(postUris)
  const authorMap = new Map<string, ProfileView>()

  onProgress?.('Resolving post authors...', 0)
  for (let i = 0; i < uriList.length; i += 25) {
    const batch = uriList.slice(i, i + 25)
    try {
      const postsResponse = await publicGet<GetPostsResponse>('app.bsky.feed.getPosts', {
        uris: batch,
      })
      for (const post of postsResponse.posts) {
        authorMap.set(post.uri, post.author)
      }
    } catch {
      // Some posts deleted
    }
    onProgress?.('Resolving post authors...', Math.min(i + 25, uriList.length))
    // Small delay to avoid rate limiting
    if (i + 25 < uriList.length) {
      await new Promise((r) => setTimeout(r, 50))
    }
  }

  // Process likes
  for (const like of parsed.likes) {
    const author = authorMap.get(like.uri)
    if (author) {
      addInteraction(author, 'likes')
    }
  }

  // Process replies
  for (const reply of parsed.replies) {
    const author = authorMap.get(reply.parentUri)
    if (author) {
      addInteraction(author, 'replies')
    }
  }

  // Process reposts
  for (const repost of parsed.reposts) {
    const author = authorMap.get(repost.uri)
    if (author) {
      addInteraction(author, 'reposts')
    }
  }

  // Resolve mentions (need to look up handles)
  const uniqueHandles = [...new Set(parsed.mentions.map((m) => m.handle))]
  onProgress?.('Resolving mentions...', 0)

  for (let i = 0; i < uniqueHandles.length; i++) {
    const mentionHandle = uniqueHandles[i]
    try {
      const profile = await getProfile(mentionHandle)
      const mentionCount = parsed.mentions.filter((m) => m.handle === mentionHandle).length
      const existing = interactions.get(profile.did)
      if (existing) {
        existing.counts.mentions += mentionCount
      } else {
        interactions.set(profile.did, {
          profile: {
            did: profile.did,
            handle: profile.handle,
            displayName: profile.displayName,
            avatar: profile.avatar,
          },
          counts: { likes: 0, replies: 0, reposts: 0, mentions: mentionCount },
        })
      }
    } catch {
      // Invalid mention handle
    }
    onProgress?.('Resolving mentions...', i + 1)
  }

  const users: InteractionUser[] = Array.from(interactions.values()).map(({ profile, counts }) => ({
    did: profile.did,
    handle: profile.handle,
    displayName: profile.displayName,
    avatar: profile.avatar,
    interactionCount: counts.likes + counts.replies + counts.reposts + counts.mentions,
    interactions: counts,
  }))

  return users.sort((a, b) => b.interactionCount - a.interactionCount).slice(0, 200)
}
