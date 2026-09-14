// Thin localStorage wrapper for boolean UI preferences. Responsible only
// for read/write with a safe fallback; must not hold any state itself or
// know about specific preference keys — callers (e.g.
// hooks/useWorkspacePreferences.ts) own the keys and defaults.
export function readStoredBoolean(key: string, fallback: boolean) {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : value === 'true'
  } catch {
    // localStorage can throw (privacy mode, disabled storage, quota) —
    // treat it as simply unavailable rather than letting it crash the caller.
    return fallback
  }
}

export function writeStoredBoolean(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // Browser storage is optional.
  }
}
