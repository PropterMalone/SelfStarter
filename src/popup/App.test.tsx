import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { BlueskySession } from '../types'
import { App } from './App'
import { saveRedirectDraft } from '../utils/redirectDraft'
const state = vi.hoisted(() => ({
  session: null as BlueskySession | null,
  analyze: vi.fn(),
  publish: vi.fn(),
  reset: vi.fn(),
}))
vi.mock('./hooks', () => ({
  useBlueskyAuth: () => ({
    session: state.session,
    isLoading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
  useInteractions: () => ({
    users: [],
    isLoading: false,
    error: null,
    progress: null,
    analyze: state.analyze,
    reset: state.reset,
  }),
  useStarterPack: () => ({
    isPublishing: false,
    publishedUrl: null,
    error: null,
    publish: state.publish,
    reset: vi.fn(),
  }),
}))
vi.mock('./components', () => ({
  AuthForm: () => <div>OAuth form</div>,
  HandleInput: ({ onAnalyze }: { onAnalyze: (handle: string, period: string) => void }) => (
    <button onClick={() => onAnalyze('public.example', '30d')}>Analyze public</button>
  ),
  WeightsPanel: ({ onChange }: { onChange: (weights: object) => void }) => (
    <button onClick={() => onChange({ likes: 10, replies: 3, reposts: 5, mentions: 3, quotes: 5 })}>
      Change weights
    </button>
  ),
  SelectionBar: ({
    selectedCount,
    onPublish,
  }: {
    selectedCount: number
    onPublish: () => void
  }) => <button onClick={onPublish}>Publish {selectedCount}</button>,
  UserList: ({ onDeselectAll }: { onDeselectAll: () => void }) => (
    <div>
      Reviewed results<button onClick={onDeselectAll}>None</button>
    </div>
  ),
  PublishModal: () => <div>Publication confirmation</div>,
}))
beforeEach(() => {
  sessionStorage.clear()
  state.session = null
  state.publish.mockReset()
  state.analyze.mockReset()
  state.analyze.mockResolvedValue([
    {
      did: 'did:plc:member',
      handle: 'member.example',
      interactionCount: 1,
      interactions: { likes: 1, replies: 0, reposts: 0, mentions: 0, quotes: 0 },
    },
  ])
})
it('shows functional headings without marketing or explanatory copy', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Accounts' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Account', exact: true })).toBeInTheDocument()
  expect(screen.getByText('No accounts yet')).toBeInTheDocument()
  expect(
    screen.queryByText(
      /good conversations|great starting point|good place to start|made for bluesky|who’s in the conversation|make it yours|nothing is published|public data only|review before publishing|your interactions\. your starter pack/i
    )
  ).not.toBeInTheDocument()
})
it('supports public analysis and preserves explicit None through reranking', async () => {
  render(<App />)
  fireEvent.click(screen.getByText('Analyze public'))
  await screen.findByText('Reviewed results')
  fireEvent.click(screen.getByText('None'))
  fireEvent.click(screen.getByText('Change weights'))
  expect(screen.getByText('Publish 0')).toBeInTheDocument()
  expect(state.publish).not.toHaveBeenCalled()
})
it('restores the reviewed public selection only for the intended OAuth account without auto-publishing', () => {
  saveRedirectDraft({
    handle: 'public.example',
    period: '30d',
    users: [
      {
        did: 'did:plc:member',
        handle: 'member.example',
        interactionCount: 1,
        interactions: { likes: 1, replies: 0, reposts: 0, mentions: 0, quotes: 0 },
      },
    ],
    selectedDids: [],
    loginHint: 'a.example',
    ownerDid: null,
    name: 'Reviewed draft',
    description: 'Keep this text',
  })
  state.session = { did: 'did:plc:a', handle: 'a.example' } as BlueskySession
  render(<App />)
  expect(screen.getByText('Reviewed results')).toBeInTheDocument()
  expect(screen.getByText('Publish 0')).toBeInTheDocument()
  expect(screen.queryByText('Publication confirmation')).toBeNull()
  expect(state.analyze).not.toHaveBeenCalled()
  expect(state.publish).not.toHaveBeenCalled()
})
it('invalidates old-account analysis and confirmation on account changes', async () => {
  state.session = { did: 'did:plc:a', handle: 'a.example' } as BlueskySession
  const view = render(<App />)
  fireEvent.click(screen.getByText('Analyze public'))
  await screen.findByText('Reviewed results')
  fireEvent.click(screen.getByText('Publish 1'))
  expect(screen.getByText('Publication confirmation')).toBeInTheDocument()
  state.session = { did: 'did:plc:b', handle: 'b.example' } as BlueskySession
  view.rerender(<App />)
  await waitFor(() => expect(screen.queryByText('Reviewed results')).toBeNull())
  expect(screen.queryByText('Publication confirmation')).toBeNull()
  expect(state.publish).not.toHaveBeenCalled()
})
