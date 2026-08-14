import { useEffect, useState } from 'react'
import { Code2, Copy, Eye, X } from 'lucide-react'

import { MermaidDiagram } from '@/components/MarkdownContent'
import { Button } from '@/components/ui/button'

import type { Artifact } from './artifact'
import { sandboxDocument } from './sandboxDocument'
import './ArtifactPreview.css'

export function ArtifactPreview({ artifact, onClose }: { artifact: Artifact; onClose: () => void }) {
  const [showSource, setShowSource] = useState(artifact.kind === 'code')
  const copy = () => void navigator.clipboard.writeText(artifact.source)
  const previewable = artifact.kind !== 'code'

  useEffect(() => {
    setShowSource(artifact.kind === 'code')
  }, [artifact.kind, artifact.source])

  return (
    <aside aria-label="Artifact preview" className="artifact-preview">
      <header className="artifact-preview-header">
        <div><span>{artifact.kind}</span><h3>{artifact.title}</h3></div>
        <div className="artifact-preview-actions">
          {previewable && <Button aria-pressed={!showSource} onClick={() => setShowSource(false)} size="sm" variant={!showSource ? 'secondary' : 'ghost'}><Eye /> Preview</Button>}
          <Button aria-pressed={showSource} onClick={() => setShowSource(true)} size="sm" variant={showSource ? 'secondary' : 'ghost'}><Code2 /> Source</Button>
          <Button aria-label="Copy artifact source" onClick={copy} size="icon-sm" variant="ghost"><Copy /></Button>
          <Button aria-label="Close artifact preview" onClick={onClose} size="icon-sm" variant="ghost"><X /></Button>
        </div>
      </header>
      <div className="artifact-preview-canvas">
        {showSource ? (
          <pre aria-label="Artifact source"><code className={`language-${artifact.language}`}>{artifact.source}</code></pre>
        ) : artifact.kind === 'mermaid' ? (
          <MermaidDiagram source={artifact.source} />
        ) : (
          <iframe
            referrerPolicy="no-referrer"
            sandbox=""
            srcDoc={sandboxDocument(artifact.source)}
            title={`${artifact.title} preview`}
          />
        )}
      </div>
      <footer><span>Sandboxed</span><p>Scripts, forms, top navigation, and external resources are blocked.</p></footer>
    </aside>
  )
}
