import { useState, useCallback } from 'react'
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
    users: InteractionUser[],
    onSessionUpdate?: (session: BlueskySession) => void
  ) => Promise<string>
  reset: () => void
}

export function useStarterPack(): UseStarterPackReturn {
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const publish = useCallback(
    async (
      session: BlueskySession,
      name: string,
      description: string,
      users: InteractionUser[],
      onSessionUpdate?: (session: BlueskySession) => void
    ): Promise<string> => {
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
          })),
          onSessionUpdate
        )
        setPublishedUrl(url)
        return url
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create starter pack'
        setError(message)
        throw err
      } finally {
        setIsPublishing(false)
      }
    },
    []
  )

  const reset = useCallback(() => {
    setPublishedUrl(null)
    setError(null)
  }, [])

  return { isPublishing, publishedUrl, error, publish, reset }
}
