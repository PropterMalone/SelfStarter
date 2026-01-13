import { fromUint8Array as repoFromUint8Array } from '@atcute/repo'
import { decode } from '@atcute/cbor'
import type { TimePeriod } from '../types'

const PLC_DIRECTORY = 'https://plc.directory'

interface DidDocument {
  service?: Array<{
    id: string
    type: string
    serviceEndpoint: string
  }>
}

interface LatestCommitResponse {
  cid: string
  rev: string
}

async function resolvePds(did: string): Promise<string> {
  const response = await fetch(`${PLC_DIRECTORY}/${encodeURIComponent(did)}`)
  if (!response.ok) {
    throw new Error(`Failed to resolve DID: ${response.status}`)
  }
  const doc: DidDocument = await response.json()
  const pdsService = doc.service?.find((s) => s.type === 'AtprotoPersonalDataServer')
  if (!pdsService) {
    throw new Error('No PDS found in DID document')
  }
  return pdsService.serviceEndpoint
}

export async function getLatestCommit(did: string): Promise<{ rev: string; pdsUrl: string }> {
  const pdsUrl = await resolvePds(did)
  const response = await fetch(
    `${pdsUrl}/xrpc/com.atproto.sync.getLatestCommit?did=${encodeURIComponent(did)}`
  )
  if (!response.ok) {
    throw new Error(`Failed to get latest commit: ${response.status}`)
  }
  const data: LatestCommitResponse = await response.json()
  return { rev: data.rev, pdsUrl }
}

interface LikeRecord {
  $type: 'app.bsky.feed.like'
  subject: {
    uri: string
    cid: string
  }
  createdAt: string
}

interface PostRecord {
  $type: 'app.bsky.feed.post'
  text: string
  reply?: {
    parent: { uri: string; cid: string }
    root: { uri: string; cid: string }
  }
  createdAt: string
}

interface RepostRecord {
  $type: 'app.bsky.feed.repost'
  subject: {
    uri: string
    cid: string
  }
  createdAt: string
}

export interface ParsedInteractions {
  likes: { uri: string; createdAt: string }[]
  replies: { parentUri: string; createdAt: string }[]
  reposts: { uri: string; createdAt: string }[]
  mentions: { handle: string; createdAt: string }[]
  rev: string
}

export function getTimeCutoff(period: TimePeriod): Date | null {
  const now = new Date()
  switch (period) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    case '1y':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    case 'all':
      return null
  }
}

function isWithinPeriod(dateStr: string, cutoff: Date | null): boolean {
  if (!cutoff) return true
  return new Date(dateStr) >= cutoff
}

export function filterByPeriod(
  parsed: ParsedInteractions,
  period: TimePeriod
): ParsedInteractions {
  const cutoff = getTimeCutoff(period)
  return {
    likes: parsed.likes.filter((l) => isWithinPeriod(l.createdAt, cutoff)),
    replies: parsed.replies.filter((r) => isWithinPeriod(r.createdAt, cutoff)),
    reposts: parsed.reposts.filter((r) => isWithinPeriod(r.createdAt, cutoff)),
    mentions: parsed.mentions.filter((m) => isWithinPeriod(m.createdAt, cutoff)),
    rev: parsed.rev,
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export async function downloadAndParseRepo(
  did: string,
  onProgress?: (stage: string) => void,
  knownPdsUrl?: string
): Promise<ParsedInteractions> {
  let pdsUrl = knownPdsUrl
  if (!pdsUrl) {
    onProgress?.('Resolving PDS...')
    pdsUrl = await resolvePds(did)
  }

  onProgress?.('Downloading repository...')

  const response = await fetch(`${pdsUrl}/xrpc/com.atproto.sync.getRepo?did=${encodeURIComponent(did)}`)

  if (!response.ok) {
    throw new Error(`Failed to download repo: ${response.status}`)
  }

  // Get the revision from the response header (atproto-repo-rev)
  const rev = response.headers.get('atproto-repo-rev') || ''

  // Stream the response to show download progress
  const contentLength = response.headers.get('content-length')
  const totalBytes = contentLength ? parseInt(contentLength, 10) : null

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Failed to get response reader')
  }

  const chunks: Uint8Array[] = []
  let receivedBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    chunks.push(value)
    receivedBytes += value.length

    if (totalBytes) {
      const percent = Math.round((receivedBytes / totalBytes) * 100)
      onProgress?.(`Downloading repository... ${formatBytes(receivedBytes)} / ${formatBytes(totalBytes)} (${percent}%)`)
    } else {
      onProgress?.(`Downloading repository... ${formatBytes(receivedBytes)}`)
    }
  }

  // Combine chunks into single Uint8Array
  const carData = new Uint8Array(receivedBytes)
  let offset = 0
  for (const chunk of chunks) {
    carData.set(chunk, offset)
    offset += chunk.length
  }

  onProgress?.('Parsing repository...')

  const repo = repoFromUint8Array(carData)

  const interactions: ParsedInteractions = {
    likes: [],
    replies: [],
    reposts: [],
    mentions: [],
    rev,
  }

  const mentionRegex = /@([a-zA-Z0-9.-]+)/g

  for (const entry of repo) {
    const record = decode(entry.bytes) as { $type?: string; createdAt?: string }

    if (!record.createdAt) {
      continue
    }

    switch (entry.collection) {
      case 'app.bsky.feed.like': {
        const like = record as LikeRecord
        interactions.likes.push({
          uri: like.subject.uri,
          createdAt: like.createdAt,
        })
        break
      }

      case 'app.bsky.feed.post': {
        const post = record as PostRecord
        if (post.reply) {
          interactions.replies.push({
            parentUri: post.reply.parent.uri,
            createdAt: post.createdAt,
          })
        }
        if (post.text) {
          const mentions = post.text.match(mentionRegex)
          if (mentions) {
            for (const mention of mentions) {
              interactions.mentions.push({
                handle: mention.slice(1),
                createdAt: post.createdAt,
              })
            }
          }
        }
        break
      }

      case 'app.bsky.feed.repost': {
        const repost = record as RepostRecord
        interactions.reposts.push({
          uri: repost.subject.uri,
          createdAt: repost.createdAt,
        })
        break
      }
    }
  }

  onProgress?.(`Found ${interactions.likes.length} likes, ${interactions.replies.length} replies, ${interactions.reposts.length} reposts, ${interactions.mentions.length} mentions`)

  return interactions
}
