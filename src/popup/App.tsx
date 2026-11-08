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
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-content">
          <a className="brand" href="#main-content" aria-label="SelfStarter home">
            <span className="brand-mark" aria-hidden="true">
              <img
                src={`${import.meta.env.BASE_URL}selfstarter.svg`}
                alt=""
                width="44"
                height="44"
              />
            </span>
            <h1>SelfStarter</h1>
          </a>
        </div>
      </header>
      {auth.isLoading ? (
        <p role="status" className="session-loading" id="main-content">
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
    cancel,
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
    <main id="main-content" className={`main-content ${results.length ? 'has-selection-bar' : ''}`}>
      <section className="analysis-panel" aria-label="Analyze interactions">
        <HandleInput
          onAnalyze={handleAnalyze}
          isLoading={isLoading || isPublishing}
          handle={auth.session?.handle || ''}
        />
        {isLoading && (
          <div className="analysis-progress" role="status">
            <span className="spinner" aria-hidden="true" />
            <p>{progress || 'Analyzing...'}</p>
          </div>
        )}
        {isLoading && (
          <button type="button" className="button button-secondary mt-3" onClick={cancel}>
            Stop
          </button>
        )}
        {error && (
          <div role="alert" className="error-message">
            <p>{error}</p>
          </div>
        )}
      </section>
      {auth.notice && (
        <p role="status" className="max-w-6xl mx-auto px-4 pt-4 text-sm text-gray-600">
          {auth.notice}
        </p>
      )}
      <div className="workspace">
        <aside className="settings-sidebar" aria-label="Ranking and publishing settings">
          <div className="sidebar-panel">
            <WeightsPanel
              weights={weights}
              onChange={setWeights}
              disabled={isLoading || isPublishing}
            />
          </div>
          <div className="sidebar-panel account-panel" id="publishing-account">
            <h2>Account</h2>
            <AuthForm
              onLogin={login}
              onLogout={logout}
              isAuthenticated={!!auth.session}
              currentHandle={auth.session?.handle}
              error={auth.error || undefined}
            />
          </div>
        </aside>
        <section className="results-panel" aria-labelledby="results-title" aria-busy={isLoading}>
          <div className="results-heading">
            <h2 id="results-title">Accounts</h2>
          </div>
          {!results.length ? (
            <div className="empty-state">
              <div className="empty-art" aria-hidden="true">
                <span className="art-orbit" />
                <span className="art-avatar art-one">a</span>
                <span className="art-avatar art-two">b</span>
                <span className="art-avatar art-three">c</span>
                <span className="art-center">+</span>
              </div>
              <p>{isLoading ? 'Analyzing...' : 'No accounts yet'}</p>
            </div>
          ) : (
            <UserList
              users={users}
              selectedDids={selectedDids}
              onToggle={(did) =>
                setSelectedDids((previous) => {
                  const next = new Set(previous)
                  if (next.has(did)) next.delete(did)
                  else if (next.size < 150) next.add(did)
                  return next
                })
              }
              disabled={isPublishing}
              onSelectAll={() => {
                if (users.length <= 150) setSelectedDids(new Set(users.map((user) => user.did)))
              }}
              onDeselectAll={() => setSelectedDids(new Set())}
              onSelectTopN={(count) => {
                if (Number.isInteger(count) && count > 0 && count <= Math.min(150, users.length))
                  setSelectedDids(new Set(users.slice(0, count).map((user) => user.did)))
              }}
            />
          )}
        </section>
      </div>
      {!!results.length && (
        <div className="selection-bar">
          <SelectionBar
            selectedCount={selectedDids.size}
            onPublish={() => {
              if (auth.session && selectedUsers.length > 0 && selectedUsers.length <= 150)
                setShowPublishModal(true)
            }}
            isAuthenticated={!!auth.session}
            isPublishing={isPublishing}
            publisherHandle={auth.session?.handle}
          />
        </div>
      )}
      {showPublishModal && auth.session && (
        <PublishModal
          selectedCount={selectedUsers.length}
          selectedProfiles={selectedUsers}
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
