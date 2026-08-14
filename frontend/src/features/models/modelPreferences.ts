const FAVORITES_KEY = 'chat-studio.favorite-models'
const RECENT_KEY = 'chat-studio.recent-models'

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
export const writeRecentModels = (value: string[]) => writeList(RECENT_KEY, value.slice(0, 6))
