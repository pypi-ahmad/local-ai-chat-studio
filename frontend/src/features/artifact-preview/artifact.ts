// Artifact-preview feature: classifies a fenced code block from model output into a
// renderable artifact kind. Does not render anything itself — html/svg go through
// sandboxDocument.ts and an iframe in ArtifactPreview.tsx, since that source is untrusted.

export type ArtifactKind = 'html' | 'svg' | 'mermaid' | 'code'

export type Artifact = {
  kind: ArtifactKind
  language: string
  source: string
  title: string
}

export function artifactFromFence(language: string, source: string): Artifact {
  const normalized = language.toLowerCase()
  if (normalized === 'html' || normalized === 'htm') {
    return { kind: 'html', language: normalized, source, title: 'HTML artifact' }
  }
  if (normalized === 'svg') {
    return { kind: 'svg', language: normalized, source, title: 'SVG artifact' }
  }
  if (normalized === 'mermaid') {
    return { kind: 'mermaid', language: normalized, source, title: 'Mermaid artifact' }
  }
  return {
    kind: 'code',
    language: normalized,
    source,
    title: `${normalized === 'text' ? 'Code' : normalized.toUpperCase()} artifact`,
  }
}
