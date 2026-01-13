import { describe, it, expect } from 'vitest'
import { calculateWeightedScore, rankUsers, DEFAULT_WEIGHTS } from './scoring'
import type { InteractionUser } from '../types'

const createUser = (
  did: string,
  likes = 0,
  replies = 0,
  reposts = 0,
  mentions = 0,
  quotes = 0
): InteractionUser => ({
  did,
  handle: `user${did}.bsky.social`,
  displayName: `User ${did}`,
  interactionCount: likes + replies + reposts + mentions + quotes,
  interactions: { likes, replies, reposts, mentions, quotes },
})

describe('calculateWeightedScore', () => {
  it('calculates score with default weights', () => {
    const user = createUser('1', 10, 5, 3, 2, 1)
    const score = calculateWeightedScore(user, DEFAULT_WEIGHTS)
    // likes*1 + replies*3 + reposts*5 + mentions*3 + quotes*5 = 10 + 15 + 15 + 6 + 5 = 51
    expect(score).toBe(51)
  })

  it('calculates score with custom weights', () => {
    const user = createUser('1', 10, 5, 3, 2, 1)
    const weights = { likes: 2, replies: 1, reposts: 1, mentions: 1, quotes: 1 }
    const score = calculateWeightedScore(user, weights)
    // 10*2 + 5*1 + 3*1 + 2*1 + 1*1 = 20 + 5 + 3 + 2 + 1 = 31
    expect(score).toBe(31)
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
      createUser('1', 1, 0, 0, 0, 0), // score: 1
      createUser('2', 0, 2, 0, 0, 0), // score: 6 (replies * 3)
      createUser('3', 5, 0, 0, 0, 0), // score: 5
    ]
    const ranked = rankUsers(users)
    expect(ranked.map((u) => u.did)).toEqual(['2', '3', '1'])
  })

  it('updates interactionCount with weighted score', () => {
    const users = [createUser('1', 10, 5, 0, 0, 0)]
    const ranked = rankUsers(users)
    // likes*1 + replies*3 = 10 + 15 = 25
    expect(ranked[0].interactionCount).toBe(25)
  })

  it('does not mutate original array', () => {
    const users = [createUser('1', 5, 0, 0, 0, 0), createUser('2', 10, 0, 0, 0, 0)]
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
    const users = [createUser('1', 5, 3, 2, 1, 1)]
    const ranked = rankUsers(users)
    expect(ranked.length).toBe(1)
    expect(ranked[0].did).toBe('1')
  })

  it('uses custom weights when provided', () => {
    const users = [
      createUser('1', 10, 0, 0, 0, 0), // likes only
      createUser('2', 0, 3, 0, 0, 0), // replies only
    ]
    // With high like weight, user1 wins
    const rankedHighLikes = rankUsers(users, { likes: 5, replies: 1, reposts: 1, mentions: 1, quotes: 1 })
    expect(rankedHighLikes[0].did).toBe('1')

    // With high reply weight, user2 wins
    const rankedHighReplies = rankUsers(users, { likes: 1, replies: 5, reposts: 1, mentions: 1, quotes: 1 })
    expect(rankedHighReplies[0].did).toBe('2')
  })
})
