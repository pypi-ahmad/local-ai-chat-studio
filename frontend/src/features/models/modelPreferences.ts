// Models feature: persists favorite/recent model selections to localStorage only.
// Not a general preferences store and not backed by the API — see modelMetadata.ts
// for modelKey(), the string format stored here, and ProviderModelPicker.tsx for the consumer.

const FAVORITES_KEY = 'chat-studio.favorite-models'
const RECENT_KEY = 'chat-studio.recent-models'

// localStorage can throw (disabled storage, quota, private browsing) or hold data
// written by an older/different shape; both are treated as "no saved preference"
// rather than surfaced as errors, since this is a non-essential convenience.
function readList(key: string) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function writeList(key: string, value: string[]) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Browser storage is optional. */ }
}

export const readFavoriteModels = () => readList(FAVORITES_KEY)
export const readRecentModels = () => readList(RECENT_KEY)
export const writeFavoriteModels = (value: string[]) => writeList(FAVORITES_KEY, value)
// Recent list is capped at 6 entries; callers should already prepend the newest key.
export const writeRecentModels = (value: string[]) => writeList(RECENT_KEY, value.slice(0, 6))
