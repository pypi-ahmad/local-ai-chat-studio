import { describe, expect, it } from 'vitest'

import { artifactFromFence } from './artifact'

describe('artifactFromFence', () => {
  it.each([
    ['html', 'html'],
    ['htm', 'html'],
    ['svg', 'svg'],
    ['mermaid', 'mermaid'],
    ['typescript', 'code'],
  ] as const)('maps %s fences to %s artifacts', (language, kind) => {
    expect(artifactFromFence(language, 'output')).toMatchObject({ kind, language, source: 'output' })
  })
})
