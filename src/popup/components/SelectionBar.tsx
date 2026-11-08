// pattern: Functional Core
const MAX_STARTER_PACK_SIZE = 150
interface SelectionBarProps {
  selectedCount: number
  onPublish: () => void
  isAuthenticated: boolean
  isPublishing: boolean
  publisherHandle?: string
}
export function SelectionBar({
  selectedCount,
  onPublish,
  isAuthenticated,
  isPublishing,
  publisherHandle,
}: SelectionBarProps) {
  const isOverLimit = selectedCount > MAX_STARTER_PACK_SIZE
  const canPublish = selectedCount > 0 && !isOverLimit && isAuthenticated && !isPublishing
  return (
    <div className="selection-content">
      <div className="selection-summary" role="status">
        <div className={isOverLimit ? 'limit-error' : ''}>
          <strong>{selectedCount}</strong>
          <span> / {MAX_STARTER_PACK_SIZE} selected</span>
        </div>
        <p>
          {isOverLimit
            ? `(${selectedCount - MAX_STARTER_PACK_SIZE} over limit) — remove profiles to continue.`
            : isAuthenticated
              ? `Publishing as @${publisherHandle || 'your account'}`
              : 'Sign in to publish. Your selection stays here.'}
        </p>
      </div>
      {isAuthenticated ? (
        <button className="button button-primary" disabled={!canPublish} onClick={onPublish}>
          {isPublishing ? 'Publishing...' : 'Review & publish'}
        </button>
      ) : (
        <a className="button button-primary" href="#publishing-account">
          Sign in to publish
        </a>
      )}
    </div>
  )
}
