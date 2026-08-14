import { Children, isValidElement, useEffect, useId, useState, type ReactNode } from 'react'
import { Check, Copy, PanelRightOpen, TriangleAlert } from 'lucide-react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import { artifactFromFence, type Artifact } from '@/features/artifact-preview/artifact'
import { sandboxDocument } from '@/features/artifact-preview/sandboxDocument'

import 'highlight.js/styles/github-dark.css'
import 'katex/dist/katex.min.css'
import './MarkdownContent.css'

let mermaidLoader: Promise<(typeof import('mermaid'))['default']> | null = null

function loadMermaid() {
  mermaidLoader ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      theme: 'base',
      themeVariables: {
        background: '#0d0d11',
        primaryColor: '#21141a',
        primaryTextColor: '#fbf7f9',
        primaryBorderColor: '#ff3d71',
        lineColor: '#d36b88',
        secondaryColor: '#17151a',
        tertiaryColor: '#281820',
        fontFamily: 'Geist, system-ui, sans-serif',
      },
    })
    return mermaid
  })
  return mermaidLoader
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children)
  return ''
}

function CodeBlock({ children, onArtifact }: { children?: ReactNode; onArtifact?: (artifact: Artifact) => void }) {
  const [copied, setCopied] = useState(false)
  const code = textOf(children).replace(/\n$/, '')
  const codeElement = Children.toArray(children).find(isValidElement)
  const className = codeElement && (codeElement.props as { className?: string }).className
  const language = className?.match(/language-([\w-]+)/)?.[1] ?? 'text'
  const artifact = artifactFromFence(language, code)

  if (language.toLowerCase() === 'mermaid') return <MermaidDiagram onArtifact={onArtifact} source={code} />

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <figure className="markdown-code">
      <figcaption><span>{language}</span><span className="markdown-code-actions">{onArtifact && <button aria-label={`Preview ${artifact.title}`} onClick={() => onArtifact(artifact)} type="button"><PanelRightOpen /> Preview</button>}<button aria-label="Copy code" onClick={() => void copy()} type="button">{copied ? <Check /> : <Copy />}{copied ? 'Copied' : 'Copy'}</button></span></figcaption>
      <pre>{children}</pre>
    </figure>
  )
}

export function MermaidDiagram({ source, onArtifact }: { source: string; onArtifact?: (artifact: Artifact) => void }) {
  const id = `mermaid-${useId().replace(/:/g, '')}`
  const [svg, setSvg] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    setError(false)
    setSvg('')
    void loadMermaid()
      .then((mermaid) => mermaid.render(id, source))
      .then(({ svg }) => {
        if (active) setSvg(svg)
      })
      .catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [id, source])

  if (error) return (
    <figure className="mermaid-error">
      <figcaption role="alert"><TriangleAlert /> Diagram could not be rendered. Check the Mermaid syntax.</figcaption>
      <pre><code>{source}</code></pre>
    </figure>
  )

  return <figure className="mermaid-diagram"><figcaption><span>Mermaid diagram</span>{onArtifact && <button aria-label="Preview Mermaid artifact" onClick={() => onArtifact(artifactFromFence('mermaid', source))} type="button"><PanelRightOpen /> Preview</button>}</figcaption><div aria-label="Mermaid diagram" role="img">{svg ? <iframe referrerPolicy="no-referrer" sandbox="" srcDoc={sandboxDocument(svg, 'dark')} title="Mermaid diagram canvas" /> : <span className="mermaid-loading">Rendering diagram…</span>}</div></figure>
}

const markdownComponents: Components = {
  a({ href, children, ...props }) {
    const external = Boolean(href?.startsWith('http://') || href?.startsWith('https://'))
    return <a {...props} href={href} rel={external ? 'noreferrer noopener' : undefined} target={external ? '_blank' : undefined}>{children}</a>
  },
  table({ children }) {
    return <div className="markdown-table"><table>{children}</table></div>
  },
}

export function MarkdownContent({ content, className = '', onArtifact }: { content: string; className?: string; onArtifact?: (artifact: Artifact) => void }) {
  const components: Components = {
    ...markdownComponents,
    pre({ children }) {
      return <CodeBlock onArtifact={onArtifact}>{children}</CodeBlock>
    },
  }
  return (
    <div className={`markdown-content ${className}`.trim()}>
      <ReactMarkdown components={components} rehypePlugins={[rehypeKatex, rehypeHighlight]} remarkPlugins={[remarkGfm, remarkMath]}>{content}</ReactMarkdown>
    </div>
  )
}
