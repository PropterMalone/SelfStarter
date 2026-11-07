import { beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  signIn: vi.fn(),
  options: {} as Record<string, unknown>,
}))
vi.mock('@atproto/oauth-client-browser', () => ({
  buildAtprotoLoopbackClientMetadata: (config: object) => ({
    client_id: 'http://localhost',
    ...config,
  }),
  BrowserOAuthClient: class {
    constructor(options: Record<string, unknown>) {
      sdk.options = options
    }
    init = sdk.init
    signIn = sdk.signIn
  },
}))
vi.mock('./client', () => ({ publicGet: vi.fn().mockResolvedValue({ handle: 'test.example' }) }))

async function load() {
  return import('./auth')
}

describe('OAuth boundary', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    localStorage.clear()
    sdk.init.mockResolvedValue(undefined)
    sdk.signIn.mockResolvedValue(undefined)
  })
  it('purges legacy JWT storage and initializes the SDK once for concurrent callers', async () => {
    localStorage.setItem('selfstarter_session', 'legacy secret')
    const auth = await load()
    await Promise.all([auth.initializeAuth(), auth.initializeAuth()])
    expect(localStorage.getItem('selfstarter_session')).toBeNull()
    expect(sdk.init).toHaveBeenCalledTimes(1)
  })
  it('restores an SDK session without copying credentials', async () => {
    const oauth = {
      sub: 'did:plc:test',
      fetchHandler: vi.fn(),
      signOut: vi.fn(),
      getTokenInfo: vi.fn().mockResolvedValue({
        scope: (await import('../../public/oauth-client-metadata.json')).default.scope,
      }),
    }
    sdk.init.mockResolvedValue({ session: oauth })
    const auth = await load()
    expect(await auth.initializeAuth()).toEqual({ did: oauth.sub, handle: 'test.example', oauth })
  })
  it('rejects a restored atproto-only grant with an actionable fixed error', async () => {
    sdk.init.mockResolvedValue({
      session: {
        sub: 'did:plc:test',
        getTokenInfo: vi.fn().mockResolvedValue({ scope: 'atproto' }),
      },
    })
    const auth = await load()
    await expect(auth.initializeAuth()).rejects.toThrow(/permissions.*sign in/i)
  })
  it('bounds the optional public profile lookup and falls back to the authorized DID', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(new AbortController().signal)
    const { publicGet } = await import('./client')
    vi.mocked(publicGet).mockRejectedValueOnce(new DOMException('Timed out', 'TimeoutError'))
    const auth = await load()
    const oauth = {
      sub: 'did:plc:test',
      getTokenInfo: vi.fn().mockResolvedValue({ scope: auth.OAUTH_SCOPE }),
    }
    sdk.init.mockResolvedValue({ session: oauth })
    expect(await auth.initializeAuth()).toEqual({ did: oauth.sub, handle: oauth.sub, oauth })
    expect(timeout).toHaveBeenCalledWith(10_000)
    expect(publicGet).toHaveBeenCalledWith(
      'app.bsky.actor.getProfile',
      { actor: oauth.sub },
      expect.any(AbortSignal)
    )
    timeout.mockRestore()
  })
  it('redirects through SDK signIn with granular scope and no password', async () => {
    const auth = await load()
    await auth.signIn('@test.example')
    expect(sdk.signIn).toHaveBeenCalledWith('test.example', { scope: auth.OAUTH_SCOPE })
    expect(auth.OAUTH_SCOPE).not.toContain('transition:generic')
    expect((sdk.options.clientMetadata as { scope: string }).scope).toBe(auth.OAUTH_SCOPE)
  })
  it('reports callback denial and restore errors without leaking callback text', async () => {
    sdk.init.mockRejectedValue(new Error('access_denied secret callback payload'))
    const auth = await load()
    await expect(auth.initializeAuth()).rejects.toThrow(/cancelled|denied/i)
    expect(auth.authErrorMessage(new Error('unknown secret'))).not.toContain('secret')
  })
  it('signs out with the SDK and notifies subscribers on session deletion', async () => {
    const auth = await load()
    await auth.initializeAuth()
    const listener = vi.fn()
    const unsubscribe = auth.onSessionDeleted(listener)
    const oauth = { signOut: vi.fn().mockResolvedValue(undefined) }
    await auth.signOut({ did: 'did:plc:test', handle: 'test.example', oauth } as never)
    expect(oauth.signOut).toHaveBeenCalledOnce()
    ;(sdk.options.onSessionDeleted as (did: string) => void)('did:plc:test')
    expect(listener).toHaveBeenCalledWith('did:plc:test')
    unsubscribe()
  })
})
