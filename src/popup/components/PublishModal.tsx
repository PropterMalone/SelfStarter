import { useState, useMemo } from 'react'
import type { TimePeriod } from '../../types'

interface PublishModalProps {
  selectedCount: number
  handle: string
  period: TimePeriod
  onPublish: (name: string, description: string) => void
  onCancel: () => void
  isPublishing: boolean
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
  handle,
  period,
  onPublish,
  onCancel,
  isPublishing,
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

  const [name, setName] = useState(defaultName)
  const [description, setDescription] = useState(defaultDescription)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onPublish(name.trim(), description.trim())
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Create Starter Pack</h2>
            <p className="text-sm text-gray-500">
              {selectedCount} users will be added
            </p>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              onChange={(e) => setDescription(e.target.value)}
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
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              disabled={isPublishing}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50"
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
