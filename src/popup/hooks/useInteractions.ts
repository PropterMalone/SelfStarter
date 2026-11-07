// pattern: Imperative Shell
import { useState, useCallback, useRef, useEffect } from 'react'
import type { InteractionUser, TimePeriod } from '../../types'
import { fetchInteractions } from '../../api/interactions'

export function useInteractions() {
  const [users, setUsers] = useState<InteractionUser[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const generation = useRef(0)
  useEffect(
    () => () => {
      generation.current++
    },
    []
  )

  const analyze = useCallback(
    async (handle: string, period: TimePeriod): Promise<InteractionUser[] | null> => {
      const version = ++generation.current
      setIsLoading(true)
      setError(null)
      setProgress('Starting analysis...')
      setUsers([])
      try {
        const result = await fetchInteractions(handle, period, (stage, count) => {
          if (version === generation.current) setProgress(`${stage} (${count})`)
        })
        if (version !== generation.current) return null
        setUsers(result)
        return result
      } catch (err) {
        if (version === generation.current)
          setError(err instanceof Error ? err.message : 'Analysis failed')
        return null
      } finally {
        if (version === generation.current) {
          setIsLoading(false)
          setProgress(null)
        }
      }
    },
    []
  )

  const reset = useCallback(() => {
    generation.current++
    setUsers([])
    setError(null)
    setProgress(null)
    setIsLoading(false)
  }, [])

  return { users, isLoading, error, progress, analyze, reset }
}
