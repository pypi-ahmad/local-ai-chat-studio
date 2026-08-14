import { Children, isValidElement, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Check, Copy, TriangleAlert } from 'lucide-react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

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

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const code = textOf(children).replace(/\n$/, '')
  const codeElement = Children.toArray(children).find(isValidElement)
  const className = codeElement && (codeElement.props as { className?: string }).className
  const language = className?.match(/language-([\w-]+)/)?.[1] ?? 'text'

  if (language.toLowerCase() === 'mermaid') return <MermaidDiagram source={code} />

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <figure className="markdown-code">
      <figcaption><span>{language}</span><button aria-label="Copy code" onClick={() => void copy()} type="button">{copied ? <Check /> : <Copy />}{copied ? 'Copied' : 'Copy'}</button></figcaption>
      <pre>{children}</pre>
    </figure>
  )
}

function MermaidDiagram({ source }: { source: string }) {
  const id = `mermaid-${useId().replace(/:/g, '')}`
  const diagramRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    setError(false)
    void loadMermaid()
      .then((mermaid) => mermaid.render(id, source))
      .then(({ svg }) => {
        if (active && diagramRef.current) diagramRef.current.innerHTML = svg
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

  return <figure className="mermaid-diagram"><figcaption>Mermaid diagram</figcaption><div aria-label="Mermaid diagram" ref={diagramRef} role="img"><span className="mermaid-loading">Rendering diagram…</span></div></figure>
}

const markdownComponents: Components = {
  a({ href, children, ...props }) {
    const external = Boolean(href?.startsWith('http://') || href?.startsWith('https://'))
    return <a {...props} href={href} rel={external ? 'noreferrer noopener' : undefined} target={external ? '_blank' : undefined}>{children}</a>
  },
  pre({ children }) {
    return <CodeBlock>{children}</CodeBlock>
  },
  table({ children }) {
    return <div className="markdown-table"><table>{children}</table></div>
  },
}

export function MarkdownContent({ content, className = '' }: { content: string; className?: string }) {
  return (
    <div className={`markdown-content ${className}`.trim()}>
      <ReactMarkdown components={markdownComponents} rehypePlugins={[rehypeKatex, rehypeHighlight]} remarkPlugins={[remarkGfm, remarkMath]}>{content}</ReactMarkdown>
    </div>
  )
}
