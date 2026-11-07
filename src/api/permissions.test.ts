import { describe, expect, it, vi } from 'vitest'
import { requirePublishPermissions } from './permissions'
import metadata from '../../public/oauth-client-metadata.json'

describe('granted publishing permissions', () => {
  it('accepts requested tokens in any order with harmless extra scopes', async () => {
    const getTokenInfo = vi
      .fn()
      .mockResolvedValue({ scope: metadata.scope.split(' ').reverse().join(' ') + ' other:read' })
    await expect(requirePublishPermissions({ getTokenInfo })).resolves.toBeUndefined()
    expect(getTokenInfo).toHaveBeenCalledOnce()
  })
  it.each([
    'atproto',
    '',
    'repo:app.bsky.graph.list?action=create',
    metadata.scope.replace('repo:app.bsky.graph.listitem?action=create', ''),
  ])('rejects insufficient grants before writes: %s', async (scope) => {
    await expect(
      requirePublishPermissions({ getTokenInfo: vi.fn().mockResolvedValue({ scope }) })
    ).rejects.toThrow(/permissions.*sign in/i)
  })
  it('rechecks current token metadata rather than caching a previous grant', async () => {
    const getTokenInfo = vi
      .fn()
      .mockResolvedValueOnce({ scope: metadata.scope })
      .mockResolvedValueOnce({ scope: 'atproto' })
    await requirePublishPermissions({ getTokenInfo })
    await expect(requirePublishPermissions({ getTokenInfo })).rejects.toThrow(/permissions/i)
  })
  it('fails closed for unrecognized equivalent/broad permission forms', async () => {
    await expect(
      requirePublishPermissions({
        getTokenInfo: vi
          .fn()
          .mockResolvedValue({ scope: 'atproto transition:generic repo:*?action=create' }),
      })
    ).rejects.toThrow(/permissions/i)
  })
})
