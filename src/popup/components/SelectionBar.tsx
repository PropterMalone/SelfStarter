const MAX_STARTER_PACK_SIZE = 150

interface SelectionBarProps {
  selectedCount: number
  onPublish: () => void
  isAuthenticated: boolean
  isPublishing: boolean
}

export function SelectionBar({ selectedCount, onPublish, isAuthenticated, isPublishing }: SelectionBarProps) {
  const isOverLimit = selectedCount > MAX_STARTER_PACK_SIZE
  const canPublish = selectedCount > 0 && selectedCount <= MAX_STARTER_PACK_SIZE && isAuthenticated && !isPublishing

  return (
    <div className="flex items-center justify-between p-3 border-t bg-white">
      <div className="flex items-center gap-2">
        <span
          className={`text-lg font-bold ${
            isOverLimit ? 'text-red-500' : 'text-gray-700'
          }`}
        >
          {selectedCount}
        </span>
        <span className="text-sm text-gray-500">
          / {MAX_STARTER_PACK_SIZE} selected
        </span>
        {isOverLimit && (
          <span className="text-xs text-red-500 ml-2">
            ({selectedCount - MAX_STARTER_PACK_SIZE} over limit)
          </span>
        )}
      </div>
      <button
        onClick={onPublish}
        disabled={!canPublish}
        className={`px-4 py-2 rounded-md text-white font-medium ${
          canPublish
            ? 'bg-blue-500 hover:bg-blue-600'
            : 'bg-gray-300 cursor-not-allowed'
        }`}
      >
        {isPublishing ? 'Publishing...' : isAuthenticated ? 'Publish' : 'Login to Publish'}
      </button>
    </div>
  )
}
