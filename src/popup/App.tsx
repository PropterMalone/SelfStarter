// pattern: Imperative Shell
import { useState, useEffect, useMemo, useRef } from 'react'
import type { InteractionUser, TimePeriod } from '../types'
import {
  HandleInput,
  UserList,
  SelectionBar,
  AuthForm,
  PublishModal,
  WeightsPanel,
} from './components'
import { useBlueskyAuth, useInteractions, useStarterPack } from './hooks'
import { rankUsers, DEFAULT_WEIGHTS, type ScoringWeights } from '../utils/scoring'
import { saveRedirectDraft, readRedirectDraft, clearRedirectDraft } from '../utils/redirectDraft'

type Auth = ReturnType<typeof useBlueskyAuth>
export function App() {
  const auth = useBlueskyAuth()
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">SelfStarter</h1>
          <p className="text-sm text-gray-500">
            Create Bluesky starter packs from public interactions
          </p>
        </div>
      </header>
      {auth.isLoading ? (
        <p role="status" className="p-6">
          Checking your sign-in session…
        </p>
      ) : (
        <Workflow key={auth.session?.did || 'public'} auth={auth} />
      )}
    </div>
  )
}

function Workflow({ auth }: { auth: Auth }) {
  const [restored] = useState(() => readRedirectDraft(auth.session))
  const [results, setResults] = useState<InteractionUser[]>(restored?.users || [])
  const [selectedDids, setSelectedDids] = useState<Set<string>>(
    () => new Set(restored?.selectedDids || [])
  )
  const [analyzedHandle, setAnalyzedHandle] = useState(restored?.handle || '')
  const [analyzedPeriod, setAnalyzedPeriod] = useState<TimePeriod>(restored?.period || '30d')
  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_WEIGHTS)
  const [draftName, setDraftName] = useState(restored?.name || '')
  const [draftDescription, setDraftDescription] = useState(restored?.description || '')
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const {
    isLoading,
    error: interactionError,
    progress,
    analyze,
    reset: resetAnalysis,
  } = useInteractions()
  const {
    isPublishing,
    publishedUrl,
    error: publishError,
    publish,
    reset: resetPublish,
  } = useStarterPack()
  const generation = useRef(0)
  const publishing = useRef(false)
  useEffect(() => {
    clearRedirectDraft()
    return () => {
      generation.current++
    }
  }, [])
  const users = useMemo(() => rankUsers(results, weights), [results, weights])
  const selectedUsers = users.filter((user) => selectedDids.has(user.did))

  const handleAnalyze = async (handle: string, period: TimePeriod) => {
    const version = ++generation.current
    setResults([])
    setSelectedDids(new Set())
    setShowPublishModal(false)
    setDraftName('')
    setDraftDescription('')
    setLocalError(null)
    resetPublish()
    const result = await analyze(handle, period)
    if (!result || version !== generation.current) return
    setAnalyzedHandle(handle)
    setAnalyzedPeriod(period)
    setResults(result)
    // Initialize once per completed analysis, never on rerank or explicit None.
    setSelectedDids(
      new Set(
        rankUsers(result, weights)
          .slice(0, 50)
          .map((user) => user.did)
      )
    )
  }
  const login = async (handle: string) => {
    try {
      if (results.length)
        saveRedirectDraft({
          handle: analyzedHandle,
          period: analyzedPeriod,
          users: results,
          selectedDids: [...selectedDids],
          loginHint: handle,
          ownerDid: auth.session?.did || null,
          name: draftName,
          description: draftDescription,
        })
      await auth.login(handle)
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : 'Could not preserve your selection for sign in.'
      )
      throw error
    }
  }
  const logout = async () => {
    generation.current++
    clearRedirectDraft()
    resetAnalysis()
    setResults([])
    setSelectedDids(new Set())
    setShowPublishModal(false)
    await auth.logout()
  }
  const handlePublish = async (name: string, description: string) => {
    if (
      !auth.session ||
      !showPublishModal ||
      publishing.current ||
      !selectedUsers.length ||
      selectedUsers.length > 150
    )
      return
    const version = generation.current
    publishing.current = true
    try {
      await publish(auth.session, name, description, selectedUsers)
      if (version === generation.current) setShowPublishModal(false)
    } catch {
      /* The hook reports failure; confirmation remains available. */
    } finally {
      publishing.current = false
    }
  }
  const reset = () => {
    generation.current++
    resetAnalysis()
    resetPublish()
    setResults([])
    setSelectedDids(new Set())
    clearRedirectDraft()
  }
  if (publishedUrl)
    return (
      <main className="p-8 text-center space-y-4">
        <h2 className="text-xl font-semibold">Starter Pack Created!</h2>
        <p>Your starter pack is now live on Bluesky.</p>
        <a
          href={publishedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-blue-600 underline"
        >
          {publishedUrl}
        </a>
        <button onClick={reset} className="px-4 py-2 bg-white border rounded">
          Create Another
        </button>
      </main>
    )
  const error = localError || interactionError || publishError
  return (
    <main className="flex-1">
      {auth.notice && (
        <p role="status" className="max-w-6xl mx-auto px-4 pt-4 text-sm text-gray-600">
          {auth.notice}
        </p>
      )}
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6 p-4">
        <aside className="w-full lg:w-80 lg:flex-shrink-0 space-y-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <AuthForm
              onLogin={login}
              onLogout={logout}
              isAuthenticated={!!auth.session}
              currentHandle={auth.session?.handle}
              error={auth.error || undefined}
            />
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <HandleInput
              onAnalyze={handleAnalyze}
              isLoading={isLoading || isPublishing}
              handle={auth.session?.handle || ''}
            />
            {progress && (
              <p role="status" className="mt-3 text-sm text-gray-500">
                {progress}
              </p>
            )}
            {error && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {error}
              </p>
            )}
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <WeightsPanel
              weights={weights}
              onChange={setWeights}
              disabled={isLoading || isPublishing}
            />
          </div>
          {results.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm">
              <SelectionBar
                selectedCount={selectedDids.size}
                onPublish={() => {
                  if (auth.session) setShowPublishModal(true)
                }}
                isAuthenticated={!!auth.session}
                isPublishing={isPublishing}
              />
              {!auth.session && (
                <p className="px-4 pb-4 text-sm text-gray-600">
                  Sign in above to keep this selection and publish. Signing in does not publish
                  anything.
                </p>
              )}
            </div>
          )}
        </aside>
        <div className="flex-1 bg-white rounded-lg shadow-sm min-h-[400px] p-4">
          {!results.length ? (
            <p className="text-gray-500">
              Enter a public handle and click Analyze. No sign in is needed.
            </p>
          ) : (
            <UserList
              users={users}
              selectedDids={selectedDids}
              onToggle={(did) =>
                setSelectedDids((previous) => {
                  const next = new Set(previous)
                  if (next.has(did)) next.delete(did)
                  else next.add(did)
                  return next
                })
              }
              onSelectAll={() => setSelectedDids(new Set(users.map((user) => user.did)))}
              onDeselectAll={() => setSelectedDids(new Set())}
              onSelectTopN={(count) =>
                setSelectedDids(new Set(users.slice(0, count).map((user) => user.did)))
              }
            />
          )}
        </div>
      </div>
      {showPublishModal && auth.session && (
        <PublishModal
          selectedCount={selectedUsers.length}
          handle={analyzedHandle}
          period={analyzedPeriod}
          onPublish={handlePublish}
          onCancel={() => setShowPublishModal(false)}
          isPublishing={isPublishing}
          initialName={draftName || undefined}
          initialDescription={draftDescription || undefined}
          onDraftChange={(name, description) => {
            setDraftName(name)
            setDraftDescription(description)
          }}
          publisherHandle={auth.session.handle}
        />
      )}
    </main>
  )
}
