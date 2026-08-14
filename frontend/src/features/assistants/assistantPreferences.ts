const FAVORITES_KEY = 'chat-studio.favorite-assistants'
const RECENTS_KEY = 'chat-studio.recent-assistants'

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
export const writeRecentAssistants = (ids: string[]) => writeIds(RECENTS_KEY, ids.slice(0, 4))
