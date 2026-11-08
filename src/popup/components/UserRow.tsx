// pattern: Imperative Shell
import type { InteractionUser } from '../../types'

interface UserRowProps {
  user: InteractionUser
  isSelected: boolean
  onToggle: (did: string) => void
  disabled?: boolean
}

export function UserRow({ user, isSelected, onToggle, disabled }: UserRowProps) {
  const counts = [
    ['likes', user.interactions.likes],
    ['replies', user.interactions.replies],
    ['reposts', user.interactions.reposts],
    ['mentions', user.interactions.mentions],
    ['quotes', user.interactions.quotes || 0],
  ] as const
  const total = counts.reduce((sum, [, count]) => sum + count, 0)
  const breakdown = counts.map(([label, count]) => `${count} ${label}`).join(', ')
  return (
    <label
      className={`profile-card ${isSelected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`}
    >
      <input
        type="checkbox"
        aria-label={`Select @${user.handle}`}
        checked={isSelected}
        disabled={disabled}
        onChange={() => onToggle(user.did)}
      />
      <span className="avatar" aria-hidden="true">
        {user.avatar ? (
          <img src={user.avatar} alt="" loading="lazy" />
        ) : (
          (user.displayName || user.handle).charAt(0).toUpperCase()
        )}
      </span>
      <span className="profile-info">
        <span className="profile-name">{user.displayName || user.handle}</span>
        <span className="profile-handle">@{user.handle}</span>
        <span className="raw-total">{total} interactions</span>
        <span className="interaction-breakdown" title={breakdown} aria-label={breakdown}>
          {counts.map(([label, count]) => (
            <span key={label}>
              {count} {label}
            </span>
          ))}
        </span>
      </span>
      <span className="profile-score">
        <strong>{user.interactionCount}</strong>
        <span>score</span>
      </span>
    </label>
  )
}
