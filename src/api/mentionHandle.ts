// pattern: Functional Core
export function normalizeMentionHandle(value: string): string | null {
  const handle = value.replace(/\.+$/, '').toLowerCase()
  if (handle.length > 253) return null
  const labels = handle.split('.')
  if (labels.length < 2 || !/^[a-z]/.test(labels[labels.length - 1])) return null
  if (!labels.every((label) => label.length >= 1 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return null
  return handle
}
