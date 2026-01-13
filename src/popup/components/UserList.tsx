import { useState } from 'react'
import type { InteractionUser } from '../../types'
import { UserRow } from './UserRow'

interface UserListProps {
  users: InteractionUser[]
  selectedDids: Set<string>
  onToggle: (did: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onSelectTopN: (n: number) => void
}

export function UserList({ users, selectedDids, onToggle, onSelectAll, onDeselectAll, onSelectTopN }: UserListProps) {
  const [topNValue, setTopNValue] = useState('50')

  if (users.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No users found. Try a different time period.
      </div>
    )
  }

  const handleSelectTopN = () => {
    const n = parseInt(topNValue, 10)
    if (n > 0) {
      onSelectTopN(n)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center px-2 py-1 border-b bg-gray-50">
        <span className="text-xs text-gray-600">
          {users.length} users found
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-600">Select top</span>
            <input
              type="number"
              min="1"
              max={users.length}
              value={topNValue}
              onChange={(e) => setTopNValue(e.target.value)}
              className="w-14 px-1 py-0.5 text-xs border rounded"
            />
            <button
              onClick={handleSelectTopN}
              className="text-xs text-blue-500 hover:text-blue-700"
            >
              Go
            </button>
          </div>
          <span className="text-gray-300">|</span>
          <button
            onClick={onSelectAll}
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            Select all
          </button>
          <button
            onClick={onDeselectAll}
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            Deselect all
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {users.map((user) => (
          <UserRow
            key={user.did}
            user={user}
            isSelected={selectedDids.has(user.did)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  )
}
