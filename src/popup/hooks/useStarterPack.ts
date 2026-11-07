import { useState, useCallback, useRef, useEffect } from 'react'
import type { BlueskySession, InteractionUser } from '../../types'
import { createStarterPack } from '../../api/starterPack'

interface UseStarterPackReturn {
  isPublishing: boolean
  publishedUrl: string | null
  error: string | null
  publish: (
    session: BlueskySession,
    name: string,
    description: string,
    users: InteractionUser[]
  ) => Promise<string>
  reset: () => void
}

export function useStarterPack(): UseStarterPackReturn {
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  useEffect(
    () => () => {
      generation.current++
    },
    []
  )

  const publish = useCallback(
    async (
      session: BlueskySession,
      name: string,
      description: string,
      users: InteractionUser[]
    ): Promise<string> => {
      const version = ++generation.current
      setIsPublishing(true)
      setError(null)

      try {
        const url = await createStarterPack(
          session,
          name,
          description || undefined,
          users.map((u) => ({
            did: u.did,
            handle: u.handle,
            displayName: u.displayName,
            avatar: u.avatar,
          }))
        )
        if (version === generation.current) setPublishedUrl(url)
        return url
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create starter pack'
        if (version === generation.current) setError(message)
        throw err
      } finally {
        if (version === generation.current) setIsPublishing(false)
      }
    },
    []
  )

  const reset = useCallback(() => {
    generation.current++
    setIsPublishing(false)
    setPublishedUrl(null)
    setError(null)
  }, [])

  return { isPublishing, publishedUrl, error, publish, reset }
}
