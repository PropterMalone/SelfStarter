import type { InteractionUser } from '../../types'

interface UserRowProps {
  user: InteractionUser
  isSelected: boolean
  onToggle: (did: string) => void
}

export function UserRow({ user, isSelected, onToggle }: UserRowProps) {
  return (
    <div
      className="flex items-center gap-3 p-2 hover:bg-gray-50 cursor-pointer"
      onClick={() => onToggle(user.did)}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggle(user.did)}
        className="h-4 w-4 text-blue-500 rounded border-gray-300 focus:ring-blue-500"
        onClick={(e) => e.stopPropagation()}
      />
      <img
        src={user.avatar || 'https://bsky.app/static/default-avatar.png'}
        alt=""
        className="w-8 h-8 rounded-full bg-gray-200"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">
          {user.displayName || user.handle}
        </div>
        <div className="text-xs text-gray-500 truncate">@{user.handle}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-gray-700">{user.interactionCount}</div>
        <div className="text-xs text-gray-400">interactions</div>
      </div>
    </div>
  )
}
