import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MarkdownContent } from './MarkdownContent'

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

describe('MarkdownContent', () => {
  it('renders GFM, highlighted code, and LaTeX without enabling raw HTML', () => {
    const { container } = render(<MarkdownContent content={'## Result\n\n| Item | Value |\n| --- | --- |\n| A | 1 |\n\n$E = mc^2$\n\n```ts\nconst answer = 42\n```\n\n<script>alert(1)</script>'} />)

    expect(screen.getByRole('heading', { name: 'Result' })).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(container.querySelector('.katex')).not.toBeNull()
    expect(container.querySelector('code.hljs.language-ts')).not.toBeNull()
    expect(container.querySelector('script')).toBeNull()
  })

  it('copies fenced code and protects external links', async () => {
    render(<MarkdownContent content={'[Official docs](https://example.com)\n\n```python\nprint("hello")\n```'} />)

    const link = screen.getByRole('link', { name: 'Official docs' })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer noopener')
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('print("hello")')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy code' })).toHaveTextContent('Copied'))
  })
})
