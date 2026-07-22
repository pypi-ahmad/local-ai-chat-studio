import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('studio shell', () => {
  it('exposes all phase-one workspaces', () => {
    render(<App />)

    for (const label of [
      'Chat',
      'Compare',
      'Assistants',
      'Providers',
      'Memory',
      'Activity',
      'Settings',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('renders the three-pane chat workspace', () => {
    render(<App />)

    expect(screen.getByLabelText('Primary navigation')).toBeInTheDocument()
    expect(screen.getByLabelText('Conversation history')).toBeInTheDocument()
    expect(screen.getByLabelText('Chat workspace')).toBeInTheDocument()
  })

  it('switches to provider management', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Providers' }))
    expect(screen.getByRole('heading', { name: 'Providers' })).toBeInTheDocument()
    expect(screen.getByText('OmniRoute')).toBeInTheDocument()
  })
})
