import { useState, useCallback } from 'react'
import type { InteractionUser, TimePeriod } from '../../types'
import { fetchInteractions } from '../../api/interactions'

interface UseInteractionsReturn {
  users: InteractionUser[]
  isLoading: boolean
  error: string | null
  progress: string | null
  analyze: (handle: string, period: TimePeriod) => Promise<void>
  reset: () => void
}

export function useInteractions(): UseInteractionsReturn {
  const [users, setUsers] = useState<InteractionUser[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)

  const analyze = useCallback(async (handle: string, period: TimePeriod) => {
    setIsLoading(true)
    setError(null)
    setProgress('Starting analysis...')
    setUsers([])

    try {
      const result = await fetchInteractions(handle, period, (stage, count) => {
        setProgress(`${stage} (${count})`)
      })
      setUsers(result)
      setProgress(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed'
      setError(message)
      setProgress(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setUsers([])
    setError(null)
    setProgress(null)
  }, [])

  return { users, isLoading, error, progress, analyze, reset }
}
