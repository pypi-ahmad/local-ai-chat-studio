import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'

const conversation = {
  id: 'c1', title: 'Provider architecture', model: 'unknown', pinned: false,
  created_at: 'now', updated_at: 'now', messages: [],
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    if (path.endsWith('/runtime/health')) return json({ ollama_available: true, running_models: [] })
    if (path.endsWith('/health')) return json({ status: 'ok', version: '2' })
    if (path.endsWith('/profile')) return json({ content: '' })
    if (path.endsWith('/runtime/shutdown')) return json({ status: 'stopping' }, 202)
    if (path.endsWith('/conversations')) {
      return init?.method === 'POST' ? json(conversation, 201) : json([conversation])
    }
    if (path.endsWith('/conversations/c1')) return json(conversation)
    if (path.endsWith('/providers')) return json({ providers: [
      { id: 'echo', label: 'Echo', key_source: null, auth_modes: ['none'], connected: true, health: 'ready' },
      { id: 'opencode-bridge', label: 'OpenCode', key_source: null, auth_modes: ['oauth'], connected: true, health: 'ready' },
    ] })
    if (path.endsWith('/providers/opencode-bridge/auth/methods')) {
      return json({ anthropic: [{ type: 'oauth', label: 'Claude Pro/Max', method: 0 }] })
    }
    if (/\/providers\/[^/]+\/policy$/.test(path)) {
      return json({ allow_memory: false, allow_retrieval: false, allow_attachments: false, allow_web: false, allow_backpack: false })
    }
    if (path.endsWith('/providers/models')) {
      return json({ echo: { provider: 'echo', models: [{ provider: 'echo', id: 'deterministic', label: 'Deterministic' }] } })
    }
    if (/\/(memories|presets|backpacks|activity|conversations\/c1\/uploads)$/.test(path)) return json([])
    if (path.endsWith('/turns/preflight')) {
      return json({
        plan_hash: 'plan', estimated_tokens: 12, budget_tokens: 6553,
        sections: [{ kind: 'user', estimated_tokens: 3, included: true }],
        sources: [], findings: [], requires_confirmation: false,
      })
    }
    if (path.endsWith('/turns')) {
      return json({
        id: 'r1', status: 'queued', provider: 'echo', model: 'deterministic', output: '',
        created_at: 'now', metrics: {},
      }, 202)
    }
    if (path.endsWith('/runs/r1/events')) {
      const body = new TextEncoder().encode(
        'event: run.completed\ndata: {"type":"run.completed","run_id":"r1","data":{"output":"hello back"},"timestamp":"now"}\n\n',
      )
      return new Response(new ReadableStream({ start(controller) { controller.enqueue(body); controller.close() } }))
    }
    return json({ detail: `Unhandled ${path}` }, 404)
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('studio workspace', () => {
  it('loads the connected conversation workspace', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Provider architecture' })).toBeInTheDocument()
    expect(screen.getByLabelText('Primary navigation')).toBeInTheDocument()
    expect(screen.getByLabelText('Conversation history')).toBeInTheDocument()
    expect(screen.getByLabelText('Chat workspace')).toBeInTheDocument()
  })

  it('exposes the consolidated product surfaces', () => {
    render(<App />)

    for (const label of ['Chat', 'Compare', 'Context', 'Evidence', 'Replay', 'Focus', 'Providers', 'Library', 'Settings']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('preflights and streams a turn', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Provider architecture' })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => expect(screen.getByText('hello back')).toBeInTheDocument())
  })

  it('offers Claude subscription sign-in through OpenCode', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Providers' }))

    expect(await screen.findByRole('button', { name: 'Connect Claude Pro/Max through OpenCode' })).toBeInTheDocument()
  })

  it('confirms and stops the managed Studio server from Settings', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Stop Studio' }))

    expect(await screen.findByRole('button', { name: 'Stopping…' })).toBeDisabled()
    expect(fetch).toHaveBeenCalledWith('/api/v1/runtime/shutdown', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'X-Local-Studio': 'shutdown' }),
    }))
  })
})
