import { describe, it, expect } from 'vitest'
import { calculateWeightedScore, rankUsers, DEFAULT_WEIGHTS } from './scoring'
import type { InteractionUser } from '../types'

const createUser = (
  did: string,
  likes = 0,
  replies = 0,
  reposts = 0,
  mentions = 0
): InteractionUser => ({
  did,
  handle: `user${did}.bsky.social`,
  displayName: `User ${did}`,
  interactionCount: likes + replies + reposts + mentions,
  interactions: { likes, replies, reposts, mentions },
})

describe('calculateWeightedScore', () => {
  it('calculates score with default weights', () => {
    const user = createUser('1', 10, 5, 3, 2)
    const score = calculateWeightedScore(user, DEFAULT_WEIGHTS)
    // likes*1 + replies*3 + reposts*2 + mentions*2 = 10 + 15 + 6 + 4 = 35
    expect(score).toBe(35)
  })

  it('calculates score with custom weights', () => {
    const user = createUser('1', 10, 5, 3, 2)
    const weights = { likes: 2, replies: 1, reposts: 1, mentions: 1 }
    const score = calculateWeightedScore(user, weights)
    // 10*2 + 5*1 + 3*1 + 2*1 = 20 + 5 + 3 + 2 = 30
    expect(score).toBe(30)
  })

  it('returns 0 for user with no interactions', () => {
    const user = createUser('1')
    const score = calculateWeightedScore(user, DEFAULT_WEIGHTS)
    expect(score).toBe(0)
  })

  it('handles single interaction type', () => {
    const user = createUser('1', 5, 0, 0, 0)
    const score = calculateWeightedScore(user, DEFAULT_WEIGHTS)
    expect(score).toBe(5)
  })
})

describe('rankUsers', () => {
  it('ranks users by weighted score descending', () => {
    const users = [
      createUser('1', 1, 0, 0, 0), // score: 1
      createUser('2', 0, 2, 0, 0), // score: 6 (replies * 3)
      createUser('3', 5, 0, 0, 0), // score: 5
    ]
    const ranked = rankUsers(users)
    expect(ranked.map((u) => u.did)).toEqual(['2', '3', '1'])
  })

  it('updates interactionCount with weighted score', () => {
    const users = [createUser('1', 10, 5, 0, 0)]
    const ranked = rankUsers(users)
    // Original count was 15, but weighted should be 10 + 15 = 25
    expect(ranked[0].interactionCount).toBe(25)
  })

  it('does not mutate original array', () => {
    const users = [createUser('1', 5, 0, 0, 0), createUser('2', 10, 0, 0, 0)]
    const original = [...users]
    rankUsers(users)
    expect(users[0].did).toBe(original[0].did)
    expect(users[1].did).toBe(original[1].did)
  })

  it('handles empty array', () => {
    const ranked = rankUsers([])
    expect(ranked).toEqual([])
  })

  it('handles single user', () => {
    const users = [createUser('1', 5, 3, 2, 1)]
    const ranked = rankUsers(users)
    expect(ranked.length).toBe(1)
    expect(ranked[0].did).toBe('1')
  })

  it('uses custom weights when provided', () => {
    const users = [
      createUser('1', 10, 0, 0, 0), // likes only
      createUser('2', 0, 3, 0, 0), // replies only
    ]
    // With high like weight, user1 wins
    const rankedHighLikes = rankUsers(users, { likes: 5, replies: 1, reposts: 1, mentions: 1 })
    expect(rankedHighLikes[0].did).toBe('1')

    // With high reply weight, user2 wins
    const rankedHighReplies = rankUsers(users, { likes: 1, replies: 5, reposts: 1, mentions: 1 })
    expect(rankedHighReplies[0].did).toBe('2')
  })
})
