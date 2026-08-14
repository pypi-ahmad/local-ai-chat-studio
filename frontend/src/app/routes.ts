export type Page = 'Chat' | 'Compare' | 'Context' | 'Evidence' | 'Replay' | 'Focus' | 'Tools' | 'Providers' | 'Library' | 'Settings'
export type WorkspaceRoute = { page: Page; conversationId: string | null }

const paths: Record<Page, string> = {
  Chat: '/chat',
  Compare: '/compare',
  Context: '/context',
  Evidence: '/evidence',
  Replay: '/replay',
  Focus: '/focus',
  Tools: '/tools',
  Providers: '/providers',
  Library: '/library',
  Settings: '/settings',
}

export function pathForPage(page: Page, conversationId?: string | null) {
  if (page === 'Chat' && conversationId) return `/chat/${encodeURIComponent(conversationId)}`
  return paths[page]
}

export function routeFromPath(pathname: string): WorkspaceRoute | null {
  if (pathname === '/') return { page: 'Chat', conversationId: null }
  const chat = pathname.match(/^\/chat(?:\/([^/]+))?\/?$/)
  if (chat) return { page: 'Chat', conversationId: chat[1] ? decodeURIComponent(chat[1]) : null }
  const page = (Object.entries(paths) as [Page, string][]).find(([, path]) => pathname === path || pathname === `${path}/`)?.[0]
  return page ? { page, conversationId: null } : null
}
