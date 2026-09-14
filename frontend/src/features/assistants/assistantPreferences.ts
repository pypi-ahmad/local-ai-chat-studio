// Assistants feature: persists favorite/recent assistant preset ids to localStorage only.
// Preset data itself lives in the API (see routes/library/LibraryPage.tsx); this file
// only remembers which preset ids the user favorited or recently started.

const FAVORITES_KEY = 'chat-studio.favorite-assistants'
const RECENTS_KEY = 'chat-studio.recent-assistants'

// Failures (storage disabled, quota, malformed JSON) fall back to an empty list rather
// than erroring, since favorites/recents are a non-essential convenience. Deduplicated
// via Set in case the same id was written more than once.
function readIds(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string'))] : []
  } catch {
    return []
  }
}

function writeIds(key: string, ids: string[]) {
  try { localStorage.setItem(key, JSON.stringify(ids)) } catch { /* Browser storage is optional. */ }
}

export const readFavoriteAssistants = () => readIds(FAVORITES_KEY)
export const readRecentAssistants = () => readIds(RECENTS_KEY)
export const writeFavoriteAssistants = (ids: string[]) => writeIds(FAVORITES_KEY, ids)
// Recent list is capped at 4 entries; callers should already prepend the newest id.
export const writeRecentAssistants = (ids: string[]) => writeIds(RECENTS_KEY, ids.slice(0, 4))
