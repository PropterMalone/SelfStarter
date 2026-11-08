// pattern: Imperative Shell
import { useState, useCallback, useRef, useEffect } from 'react'
import type { AnalysisProgress, InteractionUser, TimePeriod } from '../../types'
import { fetchInteractions } from '../../api/interactions'

export function useInteractions() {
  const [users, setUsers] = useState<InteractionUser[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null)
  const generation = useRef(0)
  const activeController = useRef<AbortController | null>(null)

  useEffect(() => () => {
    generation.current++
    activeController.current?.abort()
    activeController.current = null
  }, [])

  const analyze = useCallback(
    async (handle: string, period: TimePeriod): Promise<InteractionUser[] | null> => {
      const version = ++generation.current
      activeController.current?.abort()
      const controller = new AbortController()
      activeController.current = controller
      setIsLoading(true)
      setError(null)
      setProgress('Starting analysis...')
      setAnalysisProgress({ stage: 'resolving', message: 'Starting analysis...' })
      setUsers([])
      try {
        const result = await fetchInteractions(handle, period, (message, completed, total) => {
          if (version !== generation.current || controller.signal.aborted) return
          setProgress(message)
          setAnalysisProgress({
            stage: total === undefined ? 'fetching_posts' : 'analyzing',
            message,
            progress: total === undefined ? undefined : total === 0 ? 100 : completed / total * 100,
          })
        }, controller.signal)
        if (version !== generation.current || controller.signal.aborted) return null
        setUsers(result)
        return result
      } catch (err) {
        if (version === generation.current && !controller.signal.aborted &&
            !(err instanceof Error && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : 'Analysis failed')
        }
        return null
      } finally {
        if (version === generation.current) {
          activeController.current = null
          setIsLoading(false)
          setProgress(null)
          setAnalysisProgress(null)
        }
      }
    }, []
  )

  const cancel = useCallback(() => {
    generation.current++
    activeController.current?.abort()
    activeController.current = null
    setUsers([])
    setError(null)
    setProgress(null)
    setAnalysisProgress(null)
    setIsLoading(false)
  }, [])

  return { users, isLoading, error, progress, analysisProgress, analyze, reset: cancel, cancel }
}
