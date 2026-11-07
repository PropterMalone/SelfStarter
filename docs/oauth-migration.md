# OAuth migration

Implementation and synthetic verification: 2026-11-07. No deployment, real authorization, token issuance, or account writes performed.

## Architecture and trust boundaries

- React 19, strict TypeScript, Vite 7 and the existing browser analysis workflow remain. Node >=22 is required by the pinned official `@atproto/oauth-client-browser@0.5.14`; CI uses Node 22. `@atproto/common-web@0.5.2` supplies valid TID record keys. No custom PKCE, DPoP, token refresh, credential persistence, or secret is introduced.
- `src/api/auth.ts` initializes one SDK client once, processes fragment callbacks and restores SDK sessions. React hides authenticated state until initialization completes. Public profile reads supply the display handle; identity remains the authorized DID. Session deletion events invalidate the signed-in UI. Logout calls SDK session `signOut()` for its revocation attempt and local deletion. The SDK swallows ordinary revocation-request failures, so a resolved promise does not confirm provider revocation. The UI always says “Signed out on this device. Manage connected-app access in Bluesky settings.” Exposed SDK exceptions receive an additional unconfirmed-revocation warning; no custom revocation request or credential inspection is added.
- SDK-managed IndexedDB holds tokens and keys. The application removes `selfstarter_session`, never adopts old JWTs, and never logs credentials. Auth errors use fixed text instead of reflecting server/callback text. The SDK consumes/scrubs callbacks; unrelated query and fragment parameters survive. `no-referrer` limits callback URL disclosure.
- Public analysis remains unauthenticated. Completed results initialize selection once; reranking never replaces an explicit selection or None. Account changes remount the reviewed workflow, discarding old results/modal state and stale async completions.
- Before redirect, only public result fields, selected DIDs and text drafts enter tab-local sessionStorage: max 5,000 result rows, 150 selections, 2MB encoded data and 30-minute age. Validation rejects malformed/duplicate/absent DIDs, future timestamps and wrong accounts. A public draft is bound to the sign-in handle (or DID); an already-owned draft binds to DID. If public profile resolution cannot verify the intended handle, restoration fails closed rather than moving a draft into another account. This data is not secret but remains readable by scripts on the origin. Successful or failed return clears the stored copy. Returning never opens confirmation or writes records.
- Publishing is explicit: open the modal, review the publishing account, then Create. Arbitrary public handles may be analyzed; the signed-in account owns the resulting pack, as shown in confirmation. One `com.atproto.repo.applyWrites` transaction creates a list, 1–150 distinct list members, and starter-pack record (maximum 152 writes). Invalid selections or text fail before transport. Names use the exact reviewed value, not a length-expanding suffix. Names max 50 graphemes/500 bytes; descriptions max 300 graphemes/3,000 bytes. No member error is swallowed or write batch retried by application code. Network uncertainty is not a confirmed success; check the account before retrying.

## Metadata, scopes and deployment gate

Production client ID:

https://proptermalone.github.io/SelfStarter/oauth-client-metadata.json

Client URI and redirect URI:

https://proptermalone.github.io/SelfStarter/

The callback uses the existing static index route, not a new SPA-only path. `public/oauth-client-metadata.json` declares web application, authorization-code + refresh-token grants, code response, auth method `none`, and DPoP-bound tokens. No client secret. Scope is exactly:

```text
atproto repo:app.bsky.graph.list?action=create repo:app.bsky.graph.listitem?action=create repo:app.bsky.graph.starterpack?action=create
```

Before a restored or callback session becomes publish-ready, and before each authenticated write, the app awaits SDK `getTokenInfo()` and checks its current granted `scope` for `atproto` and the three requested canonical create tokens. Scope-token ordering and extra tokens do not matter. Unknown equivalent forms (wildcards or combined collection permissions) fail closed; this conservative compatibility limit can reject a semantically broader existing grant. The app never broadens its request or falls back to `transition:generic`. A fixed actionable permission message survives auth-error sanitization. No raw token is exposed, logged or serialized. Profile reads use the public AppView with a ten-second abort signal and authorized-DID fallback; no authenticated service proxy or broad `transition:generic` permission is needed. Official PDS code checks applyWrites permissions per collection/action and caps batches at 200. Actual target-server support remains a live acceptance check, not inferred from passing mocks.

Local development uses the SDK’s `buildAtprotoLoopbackClientMetadata` helper with a pathless `http://localhost?...` client ID, matching granular scope and an IP callback at the current port and `/SelfStarter/` path. Do not use the browser helper’s implicit pathful client ID: SDK 0.5.14 OAuth types reject it on this subpath. Chromium checks cover both localhost and 127.0.0.1 startup and an IP authorization callback. Use the IP URL for local authorization.

Before any live login, an explicitly authorized deployment must serve the production metadata at its exact public URL with HTTP 200 and JSON content type, with no authentication or redirect. Publication was not authorized in this implementation. Production OAuth cannot be accepted end-to-end until that gate is met.

## Verification and limitations

Run `npm test`, `npm run lint`, `npm run build`, and a read-only Prettier check scoped to touched files. `node scripts/oauth-browser-check.mjs` uses an existing user-local Playwright installation (override `PLAYWRIGHT_MODULE` on other machines), starts a temporary local static server, and intercepts all nonlocal requests. It checks real bundled SDK initialization, loopback hosts, callback error/scrub behavior, static JSON metadata, and mocked DID/PDS/authorization-server discovery, PAR, SDK DPoP/PKCE and authorization redirect. No tokens are issued. React and transport tests mock the SDK boundary for restored sessions, logout and publish behavior; these do not establish real token exchange/refresh/revocation acceptance. The synthetic error callback lacks a stored SDK request and may correctly show a generic restore error.

Draft validation includes 32 bounded account/selection combinations against an independent intended-account oracle plus explicit malformed/expiry/credential-field cases. This is a small deterministic generated-case matrix, not a broad property-testing campaign. In a disposable copy, disabling account binding changed the five-test draft suite from 5 passing to 2 failing (the explicit wrong-account case and generated matrix). The copy was removed; production source was never mutated. This calibrates that defect only, not all real-session histories.

Final post-review receipts: `npm test` passed 153 tests across 21 files; `npm run lint` and `npm run build` passed; `node scripts/oauth-browser-check.mjs` passed 5 checks. The scoped read-only Prettier check on all OAuth-owned touched source, tests, fixture and manifest passed after generated formatting was applied through file tools; no broad `--write` was run. Both P2 review findings and the bounded-profile-lookup follow-up are resolved locally; see `reviews/2026-11-07-oauth-resolution.md`. The recovered repository has no aggregate validate/dead-code script. The production build warns about a roughly 733KB minified JavaScript chunk; it builds without Node crypto shims. Code-splitting is a performance follow-up, not a reason to weaken the SDK trust boundary.

**Known release risk, explicitly accepted for this update on 2026-11-07:** production `npm audit --omit=dev` reports 15 high-severity dependency paths rooted in transitive Zod 3.25.76 (GHSA-mrhx-c7xc-m3w5, oversized collection validation). The owner directed publication despite this disclosed issue. No compatible official dependency upgrade is verified. No forced Zod 4 override, audit suppression, local parser patch, or clean-audit claim is included in this release. Resource-exhaustion behavior exists in the legacy parser; exploitation of this particular app has not been demonstrated. Reassess and remove any temporary mitigation when a supported upstream fix is available; do not infer that the advisory has been resolved.

Publication of this OAuth update and its metadata is approved; a later visual redesign is not part of this release. After deployment, verify the public metadata and assets. Remaining account-level acceptance: real disposable-account sign-in/deny/return/reload/refresh/revoke/logout, selected results surviving redirect, and wrong-account returns discarding them. These live account actions have not been performed by the implementation checks. Separately approve and review a small test pack before any real write, then inspect exact list members. Never publish automatically on callback. Track the upstream dependency remedy separately from this accepted release risk.

## Official evidence

- OAuth protocol/client metadata/loopback requirements: https://atproto.com/specs/oauth
- Granular repo permissions: https://atproto.com/specs/permission
- Installed official SDK implementation/types: `node_modules/@atproto/oauth-client-browser/dist/browser-oauth-client.js`, `@atproto/oauth-client/dist/oauth-session.js`, `@atproto/oauth-types/dist/atproto-loopback-client-metadata.js` (0.5.14 dependency tree).
- Transaction schema: https://github.com/bluesky-social/atproto/blob/main/lexicons/com/atproto/repo/applyWrites.json
- PDS max200 and per-action permission checks: https://github.com/bluesky-social/atproto/blob/main/packages/pds/src/api/com/atproto/repo/applyWrites.ts
- Starter-pack text/key constraints: https://github.com/bluesky-social/social-app/blob/main/lexicons/app/bsky/graph/starterpack.json
- Advisory: https://github.com/advisories/GHSA-mrhx-c7xc-m3w5

Falsifiers: a target PDS rejecting the three create scopes, metadata responses that redirect/non-JSON/fail CORS discovery, callback route 404, or a restored session writing as another DID block acceptance even if unit tests pass.
