import type { InteractionUser } from '../types'

export interface ScoringWeights {
  likes: number
  replies: number
  reposts: number
  mentions: number
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  likes: 1,
  replies: 3,
  reposts: 2,
  mentions: 2,
}

export function calculateWeightedScore(user: InteractionUser, weights: ScoringWeights): number {
  return (
    user.interactions.likes * weights.likes +
    user.interactions.replies * weights.replies +
    user.interactions.reposts * weights.reposts +
    user.interactions.mentions * weights.mentions
  )
}

export function rankUsers(users: InteractionUser[], weights: ScoringWeights = DEFAULT_WEIGHTS): InteractionUser[] {
  return [...users]
    .map((user) => ({
      ...user,
      interactionCount: calculateWeightedScore(user, weights),
    }))
    .sort((a, b) => b.interactionCount - a.interactionCount)
}
