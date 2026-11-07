// pattern: Imperative Shell
/** Retire app-password sessions. OAuth credentials belong exclusively to the SDK. */
export function purgeLegacySession(): void {
  localStorage.removeItem('selfstarter_session')
}
