export interface BlueskyProfile {
  did: string
  handle: string
  displayName?: string
  avatar?: string
  description?: string
}

export interface BlueskySession {
  did: string
  handle: string
  accessJwt: string
  refreshJwt: string
}

export interface InteractionUser {
  did: string
  handle: string
  displayName?: string
  avatar?: string
  interactionCount: number
  interactions: {
    likes: number
    replies: number
    reposts: number
    mentions: number
  }
}

export interface StarterPackUser {
  did: string
  handle: string
  displayName?: string
  avatar?: string
}

export type TimePeriod = '7d' | '30d' | '90d' | '1y' | 'all'

export interface AnalysisProgress {
  stage: 'resolving' | 'fetching_likes' | 'fetching_posts' | 'analyzing' | 'complete' | 'error'
  message: string
  progress?: number
}

export interface ApiError {
  error: string
  message: string
}

// Background service worker message types
export type AnalysisStatus = 'idle' | 'running' | 'complete' | 'error'

export interface AnalysisState {
  status: AnalysisStatus
  handle: string | null
  period: TimePeriod | null
  progress: string | null
  users: InteractionUser[]
  error: string | null
}

export type BackgroundMessage =
  | { type: 'START_ANALYSIS'; handle: string; period: TimePeriod }
  | { type: 'GET_STATUS' }
  | { type: 'RESET' }

export type BackgroundResponse =
  | { type: 'STATUS'; state: AnalysisState }
  | { type: 'ERROR'; error: string }
