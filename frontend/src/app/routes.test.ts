import { describe, expect, it } from 'vitest'

import { pathForPage, routeFromPath } from './routes'

describe('workspace routes', () => {
  it('round-trips page routes', () => {
    expect(routeFromPath(pathForPage('Library'))).toEqual({ page: 'Library', conversationId: null })
    expect(routeFromPath('/')).toEqual({ page: 'Chat', conversationId: null })
  })

  it('encodes and decodes conversation routes', () => {
    const path = pathForPage('Chat', 'local chat/one')
    expect(path).toBe('/chat/local%20chat%2Fone')
    expect(routeFromPath(path)).toEqual({ page: 'Chat', conversationId: 'local chat/one' })
  })

  it('rejects unknown routes', () => {
    expect(routeFromPath('/missing')).toBeNull()
  })
})
