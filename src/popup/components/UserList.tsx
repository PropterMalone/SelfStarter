// pattern: Imperative Shell
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
  disabled?: boolean
}

export function UserList({
  users,
  selectedDids,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onSelectTopN,
  disabled,
}: UserListProps) {
  const [topNValue, setTopNValue] = useState('50')
  const [query, setQuery] = useState('')
  const [selectedOnly, setSelectedOnly] = useState(false)
  const count = Number(topNValue)
  const validCount = Number.isInteger(count) && count > 0 && count <= Math.min(users.length, 150)
  const visible = users.filter(
    (user) =>
      (!selectedOnly || selectedDids.has(user.did)) &&
      `${user.displayName || ''} ${user.handle}`.toLowerCase().includes(query.trim().toLowerCase())
  )
  if (!users.length) return <p className="list-empty">No accounts yet</p>
  return (
    <div>
      <div className="results-toolbar">
        <div className="filter-controls">
          <input
            type="search"
            aria-label="Filter profiles"
            placeholder="Find a name or handle…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <label className="selected-filter">
            <input
              type="checkbox"
              checked={selectedOnly}
              onChange={(event) => setSelectedOnly(event.target.checked)}
            />{' '}
            Selected only
          </label>
        </div>
        <div className="bulk-controls">
          <span className="results-count">{users.length} users found</span>
          <div className="top-controls">
            <label htmlFor="top-count">Select top</label>
            <input
              id="top-count"
              type="number"
              min="1"
              max={Math.min(users.length, 150)}
              value={topNValue}
              onChange={(event) => setTopNValue(event.target.value)}
              disabled={disabled}
            />
            <button
              className="button button-small button-secondary"
              disabled={disabled || !validCount}
              onClick={() => {
                if (validCount) onSelectTopN(count)
              }}
            >
              Go
            </button>
          </div>
          <button
            className="text-button"
            onClick={onSelectAll}
            disabled={disabled || users.length > 150}
            title={users.length > 150 ? '150 profile limit' : undefined}
          >
            All
          </button>
          <button className="text-button" onClick={onDeselectAll} disabled={disabled}>
            None
          </button>
        </div>
      </div>
      <div className="profile-list">
        {visible.map((user) => (
          <UserRow
            key={user.did}
            user={user}
            isSelected={selectedDids.has(user.did)}
            onToggle={onToggle}
            disabled={disabled || (!selectedDids.has(user.did) && selectedDids.size >= 150)}
          />
        ))}
        {!visible.length && <p className="list-empty">No matching accounts</p>}
      </div>
    </div>
  )
}
