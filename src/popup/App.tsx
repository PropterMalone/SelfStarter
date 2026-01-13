import { useState, useEffect, useMemo } from 'react'
import type { TimePeriod } from '../types'
import { HandleInput, UserList, SelectionBar, AuthForm, PublishModal } from './components'
import { useBlueskyAuth, useInteractions, useStarterPack } from './hooks'

type AppState = 'input' | 'results' | 'success'

export function App() {
  const [appState, setAppState] = useState<AppState>('input')
  const [selectedDids, setSelectedDids] = useState<Set<string>>(new Set())
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [preCheckCount] = useState(50)
  const [analyzedHandle, setAnalyzedHandle] = useState('')
  const [analyzedPeriod, setAnalyzedPeriod] = useState<TimePeriod>('30d')

  const { session, error: authError, login, logout } = useBlueskyAuth()
  const { users, isLoading, error: interactionError, progress, analyze } = useInteractions()
  const { isPublishing, publishedUrl, error: publishError, publish, reset: resetPublish } = useStarterPack()

  // Pre-check top N users when results come in
  useEffect(() => {
    if (users.length > 0 && selectedDids.size === 0) {
      const initialSelected = new Set(
        users.slice(0, Math.min(preCheckCount, 150)).map((u) => u.did)
      )
      setSelectedDids(initialSelected)
      setAppState('results')
    }
  }, [users, preCheckCount])

  const handleAnalyze = async (handle: string, period: TimePeriod) => {
    setSelectedDids(new Set())
    setAnalyzedHandle(handle)
    setAnalyzedPeriod(period)
    await analyze(handle, period)
  }

  const handleToggle = (did: string) => {
    setSelectedDids((prev) => {
      const next = new Set(prev)
      if (next.has(did)) {
        next.delete(did)
      } else {
        next.add(did)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    setSelectedDids(new Set(users.map((u) => u.did)))
  }

  const handleDeselectAll = () => {
    setSelectedDids(new Set())
  }

  const handleSelectTopN = (n: number) => {
    setSelectedDids(new Set(users.slice(0, n).map((u) => u.did)))
  }

  const handlePublishClick = () => {
    if (!session) return
    setShowPublishModal(true)
  }

  const handlePublish = async (name: string, description: string) => {
    if (!session) return

    const selectedUsers = users.filter((u) => selectedDids.has(u.did))
    try {
      await publish(session, name, description, selectedUsers)
      setShowPublishModal(false)
      setAppState('success')
    } catch {
      // Error handled in hook
    }
  }

  const handleReset = () => {
    setAppState('input')
    setSelectedDids(new Set())
    resetPublish()
  }

  const selectedUsers = useMemo(
    () => users.filter((u) => selectedDids.has(u.did)),
    [users, selectedDids]
  )

  const error = authError || interactionError || publishError

  if (appState === 'success' && publishedUrl) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 mx-auto">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Starter Pack Created!</h2>
          <p className="text-gray-600 mb-4">Your starter pack is now live on Bluesky.</p>
          <a
            href={publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline mb-6 break-all block"
          >
            {publishedUrl}
          </a>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            Create Another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">SelfStarter</h1>
          <p className="text-sm text-gray-500">Create Bluesky starter packs from your interactions</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <div className="max-w-2xl mx-auto w-full px-4 py-6 flex-1 flex flex-col">
          {/* Auth Section */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <AuthForm
              onLogin={login}
              onLogout={logout}
              isAuthenticated={!!session}
              currentHandle={session?.handle}
              error={authError || undefined}
            />
          </div>

          {/* Input or Results */}
          <div className="bg-white rounded-lg shadow-sm flex-1 flex flex-col overflow-hidden">
            {!session ? (
              <div className="p-4 text-center text-gray-500">
                <p>Please log in to analyze your interactions.</p>
                <p className="text-sm mt-2">You can only create starter packs from your own account.</p>
              </div>
            ) : appState === 'input' || users.length === 0 ? (
              <div className="p-4">
                <HandleInput onAnalyze={handleAnalyze} isLoading={isLoading} handle={session.handle} />
                {progress && (
                  <div className="mt-4 text-sm text-gray-500 text-center">
                    {progress}
                  </div>
                )}
                {error && !authError && (
                  <div className="mt-4 text-sm text-red-500 text-center">
                    {error}
                  </div>
                )}
              </div>
            ) : (
              <UserList
                users={users}
                selectedDids={selectedDids}
                onToggle={handleToggle}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
                onSelectTopN={handleSelectTopN}
              />
            )}
          </div>

          {/* Selection Bar */}
          {users.length > 0 && (
            <div className="mt-4">
              <SelectionBar
                selectedCount={selectedDids.size}
                onPublish={handlePublishClick}
                isAuthenticated={!!session}
                isPublishing={isPublishing}
              />
            </div>
          )}
        </div>
      </main>

      {/* Publish Modal */}
      {showPublishModal && (
        <PublishModal
          selectedCount={selectedUsers.length}
          handle={analyzedHandle}
          period={analyzedPeriod}
          onPublish={handlePublish}
          onCancel={() => setShowPublishModal(false)}
          isPublishing={isPublishing}
        />
      )}
    </div>
  )
}
