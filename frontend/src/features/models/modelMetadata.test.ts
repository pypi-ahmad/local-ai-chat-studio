import { beforeEach, describe, expect, it } from 'vitest'

import { hasTools, modelSearchText, providerMonogram } from './modelMetadata'
import { readFavoriteModels, readRecentModels, writeFavoriteModels, writeRecentModels } from './modelPreferences'

describe('model picker metadata', () => {
  beforeEach(() => localStorage.clear())

  it('recognizes tool-capable models and searchable capability aliases', () => {
    const model = { provider: 'openai', id: 'luna', capabilities: ['tool_use'] }

    expect(hasTools(model)).toBe(true)
    expect(modelSearchText(model)).toContain('function calling')
    expect(providerMonogram('openai')).toBe('OA')
    expect(providerMonogram('custom-provider')).toBe('CP')
  })

  it('persists favorites and limits recent models to six', () => {
    writeFavoriteModels(['openai::luna'])
    writeRecentModels(Array.from({ length: 8 }, (_, index) => `provider::model-${index}`))

    expect(readFavoriteModels()).toEqual(['openai::luna'])
    expect(readRecentModels()).toHaveLength(6)
  })

  it('ignores malformed browser storage', () => {
    localStorage.setItem('chat-studio.favorite-models', '{')

    expect(readFavoriteModels()).toEqual([])
  })
})
