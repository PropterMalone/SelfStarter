# OAuth migration: independent focused review

2026-11-07. Read-only source review; only this report was written. No installs, deployment, real authorization, token issuance, account writes, or further delegation.

## Findings

### P2 — Logout cannot report ordinary server revocation failures

`signOut()` delegates to the SDK; the hook warns only if that promise rejects. The installed SDK's `OAuthServerAgent.revoke()` catches every request failure and returns successfully. `OAuthSession.signOut()` therefore resolves after local deletion even when revocation fails. The migration document's promise that failed revocation is reported is false for normal HTTP/network failures. [read: `src/api/auth.ts:85–87`, `src/popup/hooks/useBlueskyAuth.ts:39–47`, `node_modules/@atproto/oauth-client/dist/oauth-server-agent.js:34–41`, `oauth-session.js:52–59`, `docs/oauth-migration.md:8`]

**Reproduction:** invoke the actual SDK `OAuthSession.prototype.signOut` with a fixture session getter and an actual `OAuthServerAgent` prototype whose `request` rejects with `mock HTTP 503`. It resolves, invokes local deletion once, and never exposes the failure. This no-network probe passed. Local logout works; remote credentials may remain authorized without the promised warning. [ran: Node ESM SDK prototype probe]

**Required decision:** make the UI/documentation accurately distinguish local deletion from unconfirmed revocation, or use an SDK-supported mechanism that exposes revocation outcome. Do not bypass SDK credential ownership merely to inspect this.

### P2 — Reduced grants enter the publish-ready workflow unchecked

`initializeAuth()` returns every session from `init()` without inspecting granted permissions. The SDK exposes `getTokenInfo().scope`, but its token response validation only requires a valid scope containing `atproto`; it does not compare granted write scopes with the requested scopes. Code exchange stores the returned scope verbatim. Thus a restored/reduced grant with only `atproto` is displayed as signed in and can proceed through confirmation, only to fail the write with a generic publish error. Requesting the three permissions in metadata/sign-in is not verification that they were granted. [read: `src/api/auth.ts:62–68,77–79`, `src/popup/App.tsx:79–85,115–124`, `node_modules/@atproto/oauth-types/dist/atproto-oauth-scope.js:5–18`, `node_modules/@atproto/oauth-client/dist/oauth-server-agent.js:42–69`, `oauth-session.js:36–49`]

**Reproduction/evidence:** the installed SDK's scope schema accepts `atproto` alone (asserted in the no-network probe). The existing restoration test returns a session without even a token-info method and still passes; this demonstrates the app performs no granted-scope check, though it does not simulate a full token exchange. [ran: SDK scope probe; focused auth test; read: `src/api/auth.test.ts:31–35`]

Check effective permissions before presenting publishing as available, including restored sessions. Match permissions semantically rather than requiring an exact scope-string ordering. This is a correctness/recovery issue, not a demonstrated privilege escalation: the PDS should still reject unauthorized writes.

## Boundaries checked without another finding

- Installed browser SDK is **0.5.14** (shared OAuth client **0.9.3**). Methods used exist. Production metadata uses exactly `https://proptermalone.github.io/SelfStarter/oauth-client-metadata.json`, callback/client URI `https://proptermalone.github.io/SelfStarter/`, and three collection-specific create permissions. Pure SDK metadata-helper probes passed for IPv4 and IPv6 loopback callbacks, preserving the application path with a pathless localhost client ID. [read: package manifests, `public/oauth-client-metadata.json:2–11`, `src/api/auth.ts:21–40`; ran: metadata helper assertions]
- Recognized callbacks are scrubbed before exchange; unrelated query/fragment values survive the app wrapper. SDK state lookup is mandatory and consumed against replay, issuer is checked, and code exchange uses the stored verifier. A fabricated unknown-state callback can cause a generic initialization error but cannot establish a session or publish. SDK clears browser history state; preserving unrelated history-state objects was not established. [read: `src/api/auth.ts:51–61`, SDK `browser-oauth-client.js:230–250`, `oauth-client.js:146–202`]
- Authenticated transport supplies a relative `/xrpc/...` path. SDK resolves it against verified token audience/PDS, handles DPoP and refresh, and deletes invalid sessions. No app-selected arbitrary destination. [read: `src/api/authenticatedClient.ts:10–21`, SDK `oauth-session.js:61–105`]
- Owned drafts bind to DID; public drafts compare intended login handle case-insensitively or exact DID with the returned account. Account changes remount the workflow; generation guards discard stale analysis/publish UI completions. Return does not open confirmation or write. Arbitrary public-handle analysis followed by explicitly confirmed publishing under the signed-in account is intentional. [read: `src/utils/redirectDraft.ts:48–58`, `src/popup/App.tsx:17–18,23–40,44–87,124`, hooks `useInteractions` and `useStarterPack`]
- Drafts validate shape, duplicates, selection membership, bounds, future timestamps and 30-minute age; save whitelists fields. Legacy JWT removal occurs before SDK initialization, with storage errors failing initialization closed rather than adopting old tokens. [read: `src/utils/redirectDraft.ts:20–58`, `src/utils/storage.ts:3–5`, `src/api/auth.ts:48–50`]
- Publish creates at most 152 records in one `applyWrites` call, with no application retry or swallowed member errors. Failed status/JSON parsing rejects before success UI; a lost response remains an uncertain outcome rather than proof of rollback. [read: `src/api/starterPack.ts:19–39`, `src/api/authenticatedClient.ts:16–21`, `src/popup/hooks/useStarterPack.ts:36–55`]

## Verification and remaining limits

[ran] Focused Vitest run: **33 tests passed across 8 files** (`auth`, `authenticatedClient`, `starterPack`, `redirectDraft`, `useBlueskyAuth`, `useInteractions`, `useStarterPack`, `App`). The earlier 141-test/lint/build/5-browser-check receipts were supplied by the parent, not independently rerun here. LSP symbol navigation succeeded.

[ran] Direct SDK scope/revocation and pure metadata-helper assertions passed without HTTP. An initial SDK constructor fixture failed for missing DPoP metadata and was corrected to invoke the real prototype methods. Importing the browser package directly under Node timed out; the successful metadata probe imported its pure helper dependency instead. These probes do not establish complete browser token exchange.

Remaining acceptance cases: real reduced grants and refresh/revoke histories; handle rename/reassignment during authorization (public drafts bind a mutable handle, not a pre-resolved DID); blocked legacy storage and session-storage quota failures; restored authorization with an indefinitely pending public profile fetch (no app timeout, so startup can remain blocked); real target-PDS granular permissions and transaction acceptance. No live tests were authorized. No demonstrated cross-account write or callback-triggered write was found.

**Release remains blocked** by the already documented transitive Zod audit findings until upstream resolution or an explicit bounded risk decision; this review did not rerun that audit or establish reachability. Production metadata deployment and real disposable-account acceptance remain separately gated. [read: `docs/oauth-migration.md:34,44–46`]
