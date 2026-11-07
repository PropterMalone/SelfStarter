// pattern: Imperative Shell
import metadata from '../../public/oauth-client-metadata.json'

export class LimitedPermissionsError extends Error {
  constructor() {
    super(
      'Publishing permissions were not granted. Sign in again and allow creation of lists, list members, and starter packs. No broader access is required.'
    )
    this.name = 'LimitedPermissionsError'
  }
}

/** Accept our requested canonical tokens in any order; unknown equivalents fail closed. */
export async function requirePublishPermissions(session: {
  getTokenInfo: () => Promise<{ scope: string }>
}): Promise<void> {
  const { scope } = await session.getTokenInfo()
  const granted = new Set(scope.split(/\s+/))
  if (!metadata.scope.split(' ').every((required) => granted.has(required))) {
    throw new LimitedPermissionsError()
  }
}
