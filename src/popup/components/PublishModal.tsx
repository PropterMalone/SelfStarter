// pattern: Imperative Shell
import { useState, useMemo, useEffect, useRef } from 'react'
import type { TimePeriod } from '../../types'

interface PublishModalProps {
  selectedCount: number
  selectedProfiles?: { did: string; handle: string; displayName?: string }[]
  handle: string
  period: TimePeriod
  onPublish: (name: string, description: string) => void
  onCancel: () => void
  isPublishing: boolean
  initialName?: string
  initialDescription?: string
  publisherHandle?: string
  onDraftChange?: (name: string, description: string) => void
}

function formatPeriodLabel(period: TimePeriod): string {
  switch (period) {
    case '7d':
      return 'last 7 days'
    case '30d':
      return 'last 30 days'
    case '90d':
      return 'last 90 days'
    case '1y':
      return 'last year'
    case 'all':
      return 'all time'
  }
}

function formatDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

export function PublishModal({
  selectedCount,
  selectedProfiles,
  handle,
  period,
  onPublish,
  onCancel,
  isPublishing,
  initialName,
  initialDescription,
  publisherHandle,
  onDraftChange,
}: PublishModalProps) {
  // Extract username from handle (remove .bsky.social or other domain)
  const username = useMemo(() => {
    const parts = handle.split('.')
    return parts[0] || handle
  }, [handle])

  // Generate default name: "username's interlocutors"
  const defaultName = useMemo(() => {
    return `${username}'s interlocutors`
  }, [username])

  // Generate default description
  const defaultDescription = useMemo(() => {
    const periodLabel = formatPeriodLabel(period)
    const dateStr = formatDate(new Date())
    // Capitalize the first letter of the username for the description
    const capitalizedUsername = username.charAt(0).toUpperCase() + username.slice(1)
    return `The ${selectedCount} accounts ${capitalizedUsername} interacted with the most in the ${periodLabel} as of ${dateStr}`
  }, [username, selectedCount, period])

  const [name, setName] = useState(initialName ?? defaultName)
  const [description, setDescription] = useState(initialDescription ?? defaultDescription)

  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.focus()
    return () => {
      document.body.style.overflow = oldOverflow
      previous?.focus()
    }
  }, [])
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onPublish(name.trim(), description.trim())
    }
  }

  return (
    <div className="modal-backdrop">
      <div
        className="publish-modal"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-title"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !isPublishing) onCancel()
          if (event.key !== 'Tab') return
          const controls = Array.from(
            dialog.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), summary'
            ) || []
          )
          const first = controls[0]
          const last = controls[controls.length - 1]
          if (!first) {
            event.preventDefault()
            return
          }
          if (
            event.shiftKey &&
            (document.activeElement === first || document.activeElement === dialog.current)
          ) {
            event.preventDefault()
            last.focus()
          } else if (
            !event.shiftKey &&
            (document.activeElement === last || document.activeElement === dialog.current)
          ) {
            event.preventDefault()
            first.focus()
          }
        }}
      >
        <form onSubmit={handleSubmit} className="publish-form">
          <div>
            <p className="eyebrow">ONE LAST LOOK</p>
            <h2 id="publish-title">Create Starter Pack</h2>
            <p>{selectedCount} users will be added</p>
          </div>
          <div className="publisher-review">
            <span>Publishing account</span>
            <strong>@{publisherHandle || handle}</strong>
            <p>This creates a public starter pack and list on this account.</p>
          </div>
          {selectedProfiles && (
            <details className="selected-review" open>
              <summary>Review {selectedProfiles.length} selected profiles</summary>
              <ul>
                {selectedProfiles.map((profile) => (
                  <li key={profile.did}>
                    <strong>{profile.displayName || profile.handle}</strong>
                    <span>@{profile.handle}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="review-context">
            <p>Based on public interactions for @{handle}. The account above will own the pack.</p>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                onDraftChange?.(e.target.value, description)
              }}
              placeholder="My Starter Pack"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isPublishing}
              maxLength={64}
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                onDraftChange?.(name, e.target.value)
              }}
              placeholder="A curated list of great accounts..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              disabled={isPublishing}
              rows={3}
              maxLength={300}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="button button-secondary flex-1"
              disabled={isPublishing}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button-primary flex-1"
              disabled={isPublishing || !name.trim()}
            >
              {isPublishing ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
