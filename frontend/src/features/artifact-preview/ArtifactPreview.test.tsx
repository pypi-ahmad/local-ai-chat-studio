import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { ArtifactPreview } from './ArtifactPreview'

it('isolates generated HTML in a scriptless, network-blocked sandbox', () => {
  const onClose = vi.fn()
  const { container } = render(
    <ArtifactPreview
      artifact={{
        kind: 'html',
        language: 'html',
        source: '<script>window.parent.attack()</script><img src="https://example.com/pixel">',
        title: 'HTML artifact',
      }}
      onClose={onClose}
    />,
  )

  const frame = screen.getByTitle('HTML artifact preview')
  expect(frame).toHaveAttribute('sandbox', '')
  expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer')
  expect(frame.getAttribute('srcdoc')).toContain("default-src 'none'")
  expect(frame.getAttribute('srcdoc')).toContain('<script>window.parent.attack()</script>')
  expect(container.querySelector('script')).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Close artifact preview' }))
  expect(onClose).toHaveBeenCalledOnce()
})

it('renders SVG in the sandbox and code as escaped source', () => {
  const { rerender } = render(
    <ArtifactPreview
      artifact={{ kind: 'svg', language: 'svg', source: '<svg><circle /></svg>', title: 'SVG artifact' }}
      onClose={vi.fn()}
    />,
  )

  const frame = screen.getByTitle('SVG artifact preview')
  expect(frame).toHaveAttribute('sandbox', '')
  expect(frame.getAttribute('srcdoc')).toContain('<svg><circle /></svg>')

  rerender(
    <ArtifactPreview
      artifact={{ kind: 'code', language: 'typescript', source: 'const value = "<safe>"', title: 'TYPESCRIPT artifact' }}
      onClose={vi.fn()}
    />,
  )

  expect(screen.queryByTitle('TYPESCRIPT artifact preview')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Artifact source')).toHaveTextContent('const value = "<safe>"')
})
