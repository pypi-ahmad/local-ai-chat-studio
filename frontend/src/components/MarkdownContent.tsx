import { Children, isValidElement, useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import 'highlight.js/styles/github-dark.css'
import 'katex/dist/katex.min.css'
import './MarkdownContent.css'

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
