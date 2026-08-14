import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'

const conversation = {
  id: 'c1', title: 'Provider architecture', model: 'unknown', pinned: false,
  created_at: 'now', updated_at: 'now', messages: [],
}

type MockConversationSettings = {
  model_key: string
  reasoning_effort: string | null
  temperature: number
  context_policy: 'full' | 'chat' | 'files'
  include_web: boolean
  auto_compress_history: boolean
  system_prompt: string
  layout: 'conversation' | 'compact' | 'full-width'
}

const defaultConversationSettings: MockConversationSettings = {
  model_key: '', reasoning_effort: null, temperature: 0.7, context_policy: 'full',
  include_web: false, auto_compress_history: false, system_prompt: '', layout: 'conversation',
}

let holdComparisonStreams = false
let activityRuns: Array<Record<string, unknown>> = []
let conversationMessages: Array<Record<string, unknown>> = []
let uploadedFiles: Array<Record<string, unknown>> = []
let holdNextUpload = false
let releaseUpload: (() => void) | null = null
let failNextUpload = false
let holdChatStream = false
let releaseChatStream: (() => void) | null = null
let contextEstimate = 12
let contextBudget = 6553
let conversationSettings: MockConversationSettings = { ...defaultConversationSettings }
let libraryPresets: Array<Record<string, unknown>> = []
let createdAssistantConversation: Record<string, unknown> | null = null

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
}

function setViewport(width: number) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => {
      const max = query.match(/max-width:\s*(\d+)px/)
      const min = query.match(/min-width:\s*(\d+)px/)
      return {
        matches: max ? width <= Number(max[1]) : min ? width >= Number(min[1]) : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }
    }),
  })
}

async function waitForStudio() {
  await waitFor(() => expect(window.location.pathname).toBe('/chat/c1'))
  expect(await screen.findByRole('heading', { name: 'Provider architecture' })).toBeInTheDocument()
  await screen.findByText('Backend connected')
  await new Promise((resolve) => setTimeout(resolve, 0))
  await waitFor(() => expect(screen.getByLabelText('Provider')).toHaveValue('echo'))
  await waitFor(() => expect(screen.getByLabelText('Model')).toHaveTextContent('Deterministic'))
}

beforeEach(() => {
  holdComparisonStreams = false
  activityRuns = []
  conversationMessages = []
  uploadedFiles = []
  holdNextUpload = false
  releaseUpload = null
  failNextUpload = false
  holdChatStream = false
  releaseChatStream = null
  contextEstimate = 12
  contextBudget = 6553
  conversationSettings = { ...defaultConversationSettings }
  libraryPresets = []
  createdAssistantConversation = null
  localStorage.clear()
  window.history.replaceState({}, '', '/')
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  setViewport(1024)
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    if (path.endsWith('/runtime/health')) return json({ ollama_available: true, running_models: [] })
    if (path.endsWith('/health')) return json({ status: 'ok', version: '2' })
    if (path.endsWith('/profile')) return json({ content: '' })
    if (path.endsWith('/runtime/shutdown')) return json({ status: 'stopping' }, 202)
    if (path.endsWith('/conversations')) {
      const record = { ...conversation, settings: conversationSettings }
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { title: string; settings?: MockConversationSettings }
        createdAssistantConversation = {
          ...record, id: 'c2', title: body.title, settings: body.settings ?? defaultConversationSettings,
        }
        return json(createdAssistantConversation, 201)
      }
      return json(createdAssistantConversation ? [createdAssistantConversation, record] : [record])
    }
    if (path.endsWith('/conversations/c1')) {
      if (init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as { settings?: typeof conversationSettings }
        if (body.settings) conversationSettings = body.settings
      }
      return json({ ...conversation, settings: conversationSettings, messages: conversationMessages })
    }
    if (path.endsWith('/conversations/c2') && createdAssistantConversation) return json(createdAssistantConversation)
    if (/\/conversations\/c1\/export\/(markdown|html|txt|json)$/.test(path)) {
      return new Response('exported conversation', { headers: { 'Content-Type': 'text/plain' } })
    }
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
      return json({
        echo: { provider: 'echo', models: [{
          provider: 'echo', id: 'deterministic', label: 'Deterministic',
          pricing: { input_per_million: 0, output_per_million: 0, source_url: 'https://ollama.com/', as_of: '2026-08-14' },
        }] },
        openai: { provider: 'openai', models: [{ provider: 'openai', id: 'gpt-5.6-luna', label: 'Luna', context_length: 128000, capabilities: ['vision', 'tool_use'], reasoning_efforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'] }] },
        agnes: { provider: 'agnes', models: [{ provider: 'agnes', id: 'agnes-2.5-flash', label: 'Agnes 2.5 Flash', context_length: 1000000 }] },
        broken: { provider: 'broken', models: [{ provider: 'broken', id: 'unavailable', label: 'Unavailable' }] },
      })
    }
    if (path.endsWith('/activity')) return json(activityRuns)
    if (path.endsWith('/presets')) {
      if (init?.method === 'POST') {
        const created = { id: 'p1', ...JSON.parse(String(init.body)) }
        libraryPresets.push(created)
        return json(created, 201)
      }
      return json(libraryPresets)
    }
    if (path.endsWith('/uploads') && init?.method === 'POST') {
      if (holdNextUpload) {
        holdNextUpload = false
        await new Promise<void>((resolve) => { releaseUpload = resolve })
      }
      if (failNextUpload) {
        failNextUpload = false
        return json({ detail: 'File exceeds the 10 MB upload limit.' }, 413)
      }
      const body = JSON.parse(String(init.body)) as { filename: string }
      const uploaded = { id: `upload-${uploadedFiles.length + 1}`, conversation_id: 'c1', filename: body.filename, kind: 'document', mime: 'text/plain', size: 12, text_preview: '', created_at: 'now' }
      uploadedFiles.push(uploaded)
      return json(uploaded, 201)
    }
    if (/\/uploads\/[^/]+$/.test(path) && init?.method === 'DELETE') {
      const uploadId = path.split('/').pop()
      uploadedFiles = uploadedFiles.filter((item) => item.id !== uploadId)
      return new Response(null, { status: 204 })
    }
    if (path.endsWith('/conversations/c1/uploads')) return json(uploadedFiles)
    if (/\/(memories|backpacks)$/.test(path)) return json([])
    if (path.endsWith('/turns/preflight')) {
      const body = JSON.parse(String(init?.body ?? '{}')) as { auto_compress_history?: boolean }
      return json({
        plan_hash: 'plan', estimated_tokens: contextEstimate, budget_tokens: contextBudget,
        sections: [{ kind: 'user', estimated_tokens: 3, included: true }],
        sources: [{ id: 'source-1', kind: 'memory', title: 'Working preference', preview: 'Prefer concise answers.', estimated_tokens: 4, included: true, trust: 'trusted' }], findings: [], requires_confirmation: false,
        compression_applied: Boolean(body.auto_compress_history),
        compressed_message_count: body.auto_compress_history ? 4 : 0,
      })
    }
    if (path.endsWith('/turns')) {
      return json({
        id: 'r1', status: 'queued', provider: 'echo', model: 'deterministic', output: '',
        created_at: 'now', metrics: {},
      }, 202)
    }
    if (path.endsWith('/runs') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as { model: string }
      if (body.model === 'unavailable') return json({ detail: 'Provider unavailable' }, 503)
      return json({ id: `compare-${body.model}`, status: 'queued', provider: 'test', model: body.model, output: '', created_at: 'now', metrics: {} }, 202)
    }
    if (/\/runs\/compare-[^/]+\/events$/.test(path)) {
      const runId = path.match(/\/runs\/(compare-[^/]+)\/events$/)?.[1] ?? 'compare-unknown'
      if (holdComparisonStreams) {
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(`event: run.started\ndata: {"type":"run.started","run_id":"${runId}","data":{},"timestamp":"now"}\n\n`))
            init?.signal?.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')))
          },
        })
        return new Response(body)
      }
      const output = `answer from ${runId.replace('compare-', '')}`
      const body = new TextEncoder().encode(`event: run.completed\ndata: {"type":"run.completed","run_id":"${runId}","data":{"output":"${output}"},"timestamp":"now"}\n\n`)
      return new Response(new ReadableStream({ start(controller) { controller.enqueue(body); controller.close() } }))
    }
    if (/\/runs\/compare-[^/]+$/.test(path) && init?.method === 'DELETE') {
      return json({ id: 'cancelled', status: 'cancelled', provider: 'test', model: 'test', output: '', created_at: 'now', metrics: {} })
    }
    if (/\/runs\/[^/]+\/replay$/.test(path) && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as { provider: string; model: string }
      return json({ id: 'replay-1', status: 'queued', provider: body.provider, model: body.model, output: '', created_at: 'now', metrics: {} }, 202)
    }
    if (path.endsWith('/runs/export-run/bundle?mode=full')) {
      return json({ run: { id: 'export-run' }, messages: [], context_plan: null, receipt: null })
    }
    if (path.endsWith('/runs/replay-1/events')) {
      const body = new TextEncoder().encode('event: run.completed\ndata: {"type":"run.completed","run_id":"replay-1","data":{"output":"replayed"},"timestamp":"now"}\n\n')
      return new Response(new ReadableStream({ start(controller) { controller.enqueue(body); controller.close() } }))
    }
    if (path.endsWith('/runs/r1/events')) {
      if (holdChatStream) {
        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('event: run.delta\ndata: {"type":"run.delta","run_id":"r1","data":{"delta":"new answer"},"timestamp":"now"}\n\n'))
            releaseChatStream = () => {
              controller.enqueue(new TextEncoder().encode('event: run.completed\ndata: {"type":"run.completed","run_id":"r1","data":{"output":"new answer"},"timestamp":"now"}\n\n'))
              controller.close()
            }
          },
        }))
      }
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

    await waitForStudio()
    expect(screen.getByLabelText('Primary navigation')).toBeInTheDocument()
    expect(screen.getByLabelText('Conversation history')).toBeInTheDocument()
    expect(screen.getByLabelText('Chat workspace')).toBeInTheDocument()
    expect(screen.getByText(/Estimated pricing:/)).toHaveTextContent('$0.00 in / $0.00 out per 1M')
  })

  it('downloads every conversation export format and the latest reproducibility bundle', async () => {
    conversationMessages = [
      { id: 'm1', role: 'user', content: 'Export this', position: 0, created_at: 'now', run_id: null, metadata: {} },
    ]
    activityRuns = [{
      id: 'export-run', conversation_id: 'c1', status: 'completed', provider: 'echo', model: 'deterministic',
      output: 'done', created_at: 'now', metrics: {},
    }]
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:export'),
      revokeObjectURL: vi.fn(),
    })
    render(<App />)
    await waitForStudio()

    for (const [label, path] of [
      ['Markdown (.md)', '/api/v1/conversations/c1/export/markdown'],
      ['HTML (.html)', '/api/v1/conversations/c1/export/html'],
      ['Plain text (.txt)', '/api/v1/conversations/c1/export/txt'],
      ['JSON (.json)', '/api/v1/conversations/c1/export/json'],
      ['Reproducibility bundle (.json)', '/api/v1/runs/export-run/bundle?mode=full'],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: 'Export conversation' }))
      fireEvent.click(await screen.findByRole('menuitem', { name: label }))
      await waitFor(() => expect(fetch).toHaveBeenCalledWith(path, expect.anything()))
    }

    expect(click).toHaveBeenCalledTimes(5)
  })

  it('opens generated output in a safe split-pane artifact preview', async () => {
    conversationMessages = [{
      id: 'm1', role: 'assistant', position: 0, created_at: 'now', run_id: null, metadata: {},
      content: '```html\n<main><h1>Preview me</h1><script>window.parent.attack()</script></main>\n```',
    }]
    render(<App />)
    await waitForStudio()

    fireEvent.click(screen.getByRole('button', { name: 'Preview HTML artifact' }))

    const preview = screen.getByRole('complementary', { name: 'Artifact preview' })
    expect(preview).toBeInTheDocument()
    expect(screen.getByTitle('HTML artifact preview')).toHaveAttribute('sandbox', '')
    expect(screen.getByLabelText('Chat workspace').querySelector('.chat-workbench')).toHaveClass('has-artifact')
    fireEvent.click(screen.getByRole('button', { name: 'Close artifact preview' }))
    expect(screen.queryByRole('complementary', { name: 'Artifact preview' })).not.toBeInTheDocument()
  })

  it('navigates saved chat messages with bounded previous and next controls', async () => {
    conversationMessages = [
      { id: 'm1', role: 'user', content: 'First question', position: 0, created_at: 'now', run_id: null, metadata: {} },
      { id: 'm2', role: 'assistant', content: 'First answer', position: 1, created_at: 'now', run_id: null, metadata: {} },
      { id: 'm3', role: 'user', content: 'Follow-up question', position: 2, created_at: 'now', run_id: null, metadata: {} },
    ]
    render(<App />)
    await waitForStudio()

    const navigation = await screen.findByRole('navigation', { name: 'Message navigation' }, { timeout: 3000 })
    await waitFor(() => expect(navigation).toHaveTextContent('3 / 3'))
    expect(screen.getByRole('button', { name: 'Jump to bottom' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next message' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Jump to top' }))

    expect(navigation).toHaveTextContent('1 / 3')
    expect(screen.getByRole('button', { name: 'Jump to top' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Previous message' })).toBeDisabled()
    expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' })
    fireEvent.click(screen.getByRole('button', { name: 'Next message' }))

    expect(navigation).toHaveTextContent('2 / 3')
    expect(screen.getByText('First answer').closest('article')).toHaveClass('navigation-target')
    expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'center' })
    fireEvent.click(screen.getByRole('button', { name: 'Previous message' }))

    expect(navigation).toHaveTextContent('1 / 3')
    fireEvent.click(screen.getByRole('button', { name: 'Jump to bottom' }))
    expect(navigation).toHaveTextContent('3 / 3')
    expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'end' })
  })

  it('signals unread streamed output while reading an earlier message', async () => {
    conversationMessages = [
      { id: 'm1', role: 'user', content: 'First question', position: 0, created_at: 'now', run_id: null, metadata: {} },
      { id: 'm2', role: 'assistant', content: 'First answer', position: 1, created_at: 'now', run_id: null, metadata: {} },
      { id: 'm3', role: 'user', content: 'Follow-up question', position: 2, created_at: 'now', run_id: null, metadata: {} },
    ]
    holdChatStream = true
    render(<App />)
    await waitForStudio()
    await screen.findByRole('navigation', { name: 'Message navigation' })
    fireEvent.click(screen.getByRole('button', { name: 'Previous message' }))
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'continue' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByRole('status', { name: 'Unread output' }, { timeout: 3000 })).toHaveTextContent('New output')
    fireEvent.click(screen.getByRole('button', { name: 'Jump to bottom, new output available' }))
    expect(screen.queryByRole('status', { name: 'Unread output' })).not.toBeInTheDocument()
    releaseChatStream?.()
  })

  it('exposes the consolidated product surfaces', () => {
    render(<App />)

    for (const label of ['Chat', 'Compare', 'Library', 'Focus', 'Providers', 'Settings']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
    for (const label of ['Context', 'Evidence', 'Replay']) expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()
  })

  it('searches, favorites, and starts a chat from the assistant gallery', async () => {
    window.history.replaceState({}, '', '/library')
    libraryPresets = [
      {
        id: 'writer', name: 'Editorial Writer',
        system_prompt: 'Write clear, polished copy for a general audience.',
        model_key: 'openai::gpt-5.6-luna', temperature: 0.4,
      },
      {
        id: 'analyst', name: 'Research Analyst',
        system_prompt: 'Compare evidence, identify gaps, and cite uncertainty.',
        model_key: 'agnes::agnes-2.5-flash', temperature: 0.2,
      },
    ]
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'All assistants' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add Research Analyst to favorites' }))
    expect(await screen.findByRole('heading', { name: 'Favorites' })).toBeInTheDocument()
    expect(localStorage.getItem('chat-studio.favorite-assistants')).toContain('analyst')

    fireEvent.change(screen.getByLabelText('Search assistants'), { target: { value: 'editorial' } })
    expect(screen.getByText('Editorial Writer')).toBeInTheDocument()
    expect(screen.queryByText('Research Analyst')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start chat with Editorial Writer' }))

    await waitFor(() => expect(window.location.pathname).toBe('/chat/c2'))
    const request = vi.mocked(fetch).mock.calls.find(([url, init]) => String(url).endsWith('/conversations') && init?.method === 'POST')
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      title: 'Editorial Writer',
      settings: {
        ...defaultConversationSettings,
        model_key: 'openai::gpt-5.6-luna',
        temperature: 0.4,
        system_prompt: 'Write clear, polished copy for a general audience.',
      },
    })
    expect(localStorage.getItem('chat-studio.recent-assistants')).toContain('writer')
  })

  it('groups and remembers the expandable desktop navigation', async () => {
    render(<App />)

    for (const group of ['Primary', 'Workspace', 'Administration']) expect(screen.getByRole('group', { name: group })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }))

    expect(screen.getByRole('button', { name: 'Expand navigation' })).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(localStorage.getItem('chat-studio.navigation-collapsed')).toBe('true'))
  })

  it('inspects current context and controls evidence without leaving Chat', async () => {
    render(<App />)
    await waitForStudio()
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    await screen.findByText('hello back', {}, { timeout: 3000 })

    fireEvent.click(screen.getByRole('button', { name: 'Open context and evidence inspector' }))
    expect(await screen.findByLabelText('Context and evidence inspector')).toBeInTheDocument()
    await waitFor(() => expect(localStorage.getItem('chat-studio.inspector-open')).toBe('true'))
    fireEvent.click(screen.getByRole('tab', { name: 'Evidence' }))
    expect(await screen.findByText('Working preference')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Include in next send'))
    expect(screen.getByLabelText('Include in next send')).not.toBeChecked()
    await waitFor(() => expect(localStorage.getItem('chat-studio.inspector-tab')).toBe('evidence'))
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByLabelText('Context and evidence inspector')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Open context and evidence inspector' })).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(localStorage.getItem('chat-studio.inspector-open')).toBe('false'))
  })

  it('uses three primary destinations and grouped More navigation on mobile', async () => {
    setViewport(390)
    render(<App />)

    for (const label of ['Chat', 'Compare', 'Library', 'More']) expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Context' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(await screen.findByRole('group', { name: 'Workspace' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Administration' })).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Focus' }))

    expect(await screen.findByRole('heading', { name: 'Focus' })).toBeInTheDocument()
  })

  it('preflights and streams a turn', async () => {
    render(<App />)
    await waitForStudio()
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => expect(screen.getByText('hello back')).toBeInTheDocument())
  })

  it('warns when context approaches the safe input budget', async () => {
    contextEstimate = 900
    contextBudget = 1000
    render(<App />)
    await waitForStudio()
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'use substantial context' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('90% of safe budget', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '90% of safe context budget used' })).toHaveAttribute('aria-valuenow', '90')
    expect(screen.getByRole('alert')).toHaveTextContent('Only 100 tokens remain')
  })

  it('reports context overflow without hiding the exact percentage', async () => {
    contextEstimate = 1250
    contextBudget = 1000
    render(<App />)
    await waitForStudio()
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'overflow context' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('125% of safe budget')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('exceeds the safe input budget by 250 tokens')
    expect(screen.getByLabelText('Context budget')).toHaveClass('overflow')
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/turns'))).toBe(false)
  })

  it('optionally compresses older messages and reports the result', async () => {
    render(<App />)
    await waitForStudio()
    fireEvent.click(screen.getByRole('button', { name: 'More composer settings' }))
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Compress older messages' }))
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'continue the long conversation' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      const request = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith('/turns/preflight'))
      expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({ auto_compress_history: true })
    })
    expect(await screen.findByText('4 older messages compressed')).toBeInTheDocument()
  })

  it('shows attachment upload progress and marks completed files ready', async () => {
    holdNextUpload = true
    render(<App />)
    await waitForStudio()
    const input = screen.getByLabelText('Attachment upload') as HTMLInputElement

    fireEvent.change(input, { target: { files: [new File(['notes'], 'notes.txt', { type: 'text/plain' })] } })
    expect(await screen.findByText('Parsing & indexing')).toBeInTheDocument()
    expect(screen.getByText('TXT · 5 B')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Parsing and indexing notes.txt' })).toBeInTheDocument()
    releaseUpload?.()

    expect(await screen.findByText('Ready · included in next message')).toBeInTheDocument()
    expect(screen.getByText('TXT · 12 B')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove notes.txt' }))
    await waitFor(() => expect(screen.queryByText('notes.txt')).not.toBeInTheDocument())
    expect(vi.mocked(fetch).mock.calls.some(([url, init]) => String(url).endsWith('/uploads/upload-1') && init?.method === 'DELETE')).toBe(true)
  })

  it('keeps failed attachments actionable and retries them in place', async () => {
    failNextUpload = true
    render(<App />)
    await waitForStudio()
    const input = screen.getByLabelText('Attachment upload') as HTMLInputElement

    fireEvent.change(input, { target: { files: [new File(['bad'], 'bad.pdf', { type: 'application/pdf' })] } })
    expect(await screen.findByText('File exceeds the 10 MB upload limit.', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText('PDF · 3 B')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove bad.pdf' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry bad.pdf' }))

    expect(await screen.findByText('Ready · included in next message')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry bad.pdf' })).not.toBeInTheDocument()
  })

  it('selects supported reasoning effort from the chat composer', async () => {
    render(<App />)
    await waitForStudio()

    const provider = screen.getByLabelText('Provider')
    expect(provider).toBeEnabled()
    const effort = screen.getByLabelText('Reasoning effort')
    expect(provider.closest('.composer-shell')).not.toBeNull()
    expect(effort).toBeDisabled()
    expect(effort).toHaveValue('')

    fireEvent.change(provider, { target: { value: 'openai' } })
    expect(effort).toBeEnabled()
    fireEvent.change(effort, { target: { value: 'high' } })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'think' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      const request = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith('/turns/preflight'))
      expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({ reasoning_effort: 'high' })
    })

    fireEvent.change(provider, { target: { value: 'agnes' } })
    await waitFor(() => expect(effort).toBeDisabled())
    expect(effort).toHaveValue('')
  })

  it('keeps primary composer controls together and applies compact settings', async () => {
    render(<App />)
    await waitForStudio()

    const dock = screen.getByRole('toolbar', { name: 'Composer controls' })
    expect(screen.getByLabelText('Model').closest('[role="toolbar"]')).toBe(dock)
    expect(screen.getByLabelText('Reasoning effort').closest('[role="toolbar"]')).toBe(dock)
    expect(screen.getByLabelText('Context mode').closest('[role="toolbar"]')).toBe(dock)
    expect(screen.getByLabelText('Attach file').closest('[role="toolbar"]')).toBe(dock)
    expect(screen.getByLabelText('Send message').closest('[role="toolbar"]')).toBe(dock)

    fireEvent.change(screen.getByLabelText('Context mode'), { target: { value: 'chat' } })
    fireEvent.click(screen.getByRole('button', { name: 'More composer settings' }))
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Web evidence' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Temperature/ }))
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Precise · 0.2' }))

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'use compact controls' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      const request = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith('/turns/preflight'))
      expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
        temperature: 0.2,
        include_memory: false,
        include_retrieval: false,
        include_attachments: false,
        include_web: true,
        include_backpack: false,
      })
    })
  })

  it('loads and saves settings for the active conversation', async () => {
    window.history.replaceState({}, '', '/chat/c1')
    conversationSettings = {
      model_key: 'openai::gpt-5.6-luna', reasoning_effort: 'high', temperature: 0.2,
      context_policy: 'chat', include_web: true, auto_compress_history: true,
      system_prompt: 'Be concise and cite uncertainty.', layout: 'compact',
    }
    render(<App />)

    await waitFor(() => expect(window.location.pathname).toBe('/chat/c1'))
    await waitFor(() => expect(screen.getByLabelText('Provider')).toHaveValue('openai'))
    await waitFor(() => expect(screen.getByLabelText('Model')).toHaveTextContent('Luna'))
    expect(screen.getByLabelText('Reasoning effort')).toHaveValue('high')
    expect(screen.getByLabelText('Context mode')).toHaveValue('chat')
    expect(document.querySelector('.messages')).toHaveClass('layout-compact')
    expect(conversationSettings.system_prompt).toBe('Be concise and cite uncertainty.')
    await screen.findByText('Backend connected')
    await new Promise((resolve) => setTimeout(resolve, 0))

    const settingsButton = screen.getByRole('button', { name: 'Conversation settings' })
    fireEvent.click(settingsButton)
    await waitFor(() => expect(settingsButton).toHaveAttribute('aria-expanded', 'true'))
    expect(await screen.findByRole('dialog', { name: 'Conversation settings' })).toBeInTheDocument()
    expect(await screen.findByLabelText('System prompt')).toHaveValue('Be concise and cite uncertainty.')
    fireEvent.change(screen.getByLabelText('System prompt'), { target: { value: 'Act as a reviewer.' } })
    fireEvent.click(screen.getByLabelText('Full-width layout'))
    fireEvent.click(screen.getByRole('button', { name: 'Save conversation settings' }))

    await waitFor(() => {
      const calls = vi.mocked(fetch).mock.calls.filter(([url, init]) => String(url).endsWith('/conversations/c1') && init?.method === 'PATCH')
      expect(JSON.parse(String(calls.at(-1)?.[1]?.body))).toMatchObject({
        settings: { model_key: 'openai::gpt-5.6-luna', reasoning_effort: 'high', temperature: 0.2, context_policy: 'chat', system_prompt: 'Act as a reviewer.', layout: 'full-width' },
      })
    })
    expect(document.querySelector('.messages')).toHaveClass('layout-full-width')
  })

  it('offers Claude subscription sign-in through OpenCode', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Providers' }))

    expect(await screen.findByRole('button', { name: 'Connect Claude Pro/Max through OpenCode' })).toBeInTheDocument()
  })

  it('searches and filters capability-aware models for the selected provider', async () => {
    render(<App />)
    await waitForStudio()

    expect(screen.getByLabelText('Provider')).toHaveValue('echo')
    expect(screen.getByLabelText('Model')).toHaveTextContent('Deterministic')
    const provider = screen.getByLabelText('Provider')
    fireEvent.change(provider, { target: { value: 'openai' } })
    expect(provider).toHaveValue('openai')
    await waitFor(() => expect(screen.getByLabelText('Model')).toHaveTextContent('Luna'))

    fireEvent.click(screen.getByLabelText('Model'))
    expect(await screen.findByText('128K context')).toBeInTheDocument()
    expect(screen.getByText('Reasoning · 6 levels')).toBeInTheDocument()
    expect(screen.getByText('Tools')).toBeInTheDocument()
    expect(screen.getAllByLabelText('OpenAI provider').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Add Luna to favorites' }))
    expect(screen.getByText('Favorites')).toBeInTheDocument()
    expect(localStorage.getItem('chat-studio.favorite-models')).toContain('openai::gpt-5.6-luna')
    fireEvent.click(screen.getByRole('button', { name: 'Remove Luna from favorites' }))
    fireEvent.click(screen.getByRole('button', { name: 'vision' }))
    expect(screen.getByRole('option', { name: /Luna/ })).toHaveTextContent('Vision')
    fireEvent.change(screen.getByLabelText('Search model'), { target: { value: 'gpt-5.6-luna' } })
    fireEvent.click(screen.getByRole('option', { name: /Luna/ }))

    expect(screen.getByLabelText('Model')).toHaveTextContent('Luna')
    fireEvent.click(screen.getByLabelText('Model'))
    expect(await screen.findByText('Recent')).toBeInTheDocument()
  })

  it('opens conversation history from the compact workspace control', async () => {
    render(<App />)
    await waitForStudio()

    fireEvent.click(screen.getByRole('button', { name: 'Open conversation history' }))

    expect(await screen.findAllByLabelText('Conversation history')).toHaveLength(2)
    expect(screen.getAllByText('Provider architecture')).toHaveLength(3)
  })

  it('runs one prompt across three selected models in parallel', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Compare' }))

    expect(await screen.findByLabelText('Comparison model 1')).toHaveTextContent('Deterministic')
    expect(screen.getByLabelText('Comparison provider 1')).toHaveValue('echo')
    expect(screen.getByLabelText('Comparison model 2')).toHaveTextContent('Luna')
    fireEvent.click(screen.getByRole('button', { name: 'Add model' }))
    expect(screen.getByLabelText('Comparison model 3')).toHaveTextContent('Agnes 2.5 Flash')
    fireEvent.change(screen.getByLabelText('Comparison prompt'), { target: { value: 'Compare this' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run 3 models' }))

    expect(await screen.findByText('answer from deterministic')).toBeInTheDocument()
    expect(screen.getByText('answer from gpt-5.6-luna')).toBeInTheDocument()
    expect(screen.getByText('answer from agnes-2.5-flash')).toBeInTheDocument()
    const runCalls = vi.mocked(fetch).mock.calls.filter(([url, init]) => String(url).endsWith('/runs') && init?.method === 'POST')
    expect(runCalls).toHaveLength(3)
  })

  it('uses explicit provider and model targets for Replay and assistants', async () => {
    activityRuns = [{ id: 'source-run', status: 'completed', provider: 'echo', model: 'deterministic', output: 'original', created_at: 'now', metrics: {} }]
    render(<App />)
    await waitForStudio()
    fireEvent.click(screen.getByRole('button', { name: 'Open runs' }))
    await screen.findByText('original')
    fireEvent.change(screen.getByLabelText('Replay provider'), { target: { value: 'agnes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Replay' }))

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/v1/runs/source-run/replay', expect.objectContaining({ body: expect.stringContaining('agnes-2.5-flash') })))

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: 'Library' }))
    fireEvent.change(await screen.findByLabelText('Assistant provider'), { target: { value: 'agnes' } })
    fireEvent.change(screen.getByPlaceholderText('Assistant name'), { target: { value: 'Agnes helper' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save assistant' }))

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/v1/presets', expect.objectContaining({ body: expect.stringContaining('agnes::agnes-2.5-flash') })))
  })

  it('keeps successful comparison streams when another model fails', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Compare' }))
    await screen.findByLabelText('Comparison model 1')
    fireEvent.click(screen.getByRole('button', { name: 'Add model' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add model' }))
    fireEvent.change(screen.getByLabelText('Comparison prompt'), { target: { value: 'Compare this' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run 4 models' }))

    expect(await screen.findByText('Provider unavailable')).toBeInTheDocument()
    expect(screen.getByText('answer from gpt-5.6-luna')).toBeInTheDocument()
    expect(screen.getAllByText('completed')).toHaveLength(3)
    expect(screen.getByText('failed')).toBeInTheDocument()
  })

  it('cancels every active comparison run', async () => {
    holdComparisonStreams = true
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Compare' }))
    await screen.findByLabelText('Comparison model 1')
    fireEvent.change(screen.getByLabelText('Comparison prompt'), { target: { value: 'Keep running' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run 2 models' }))
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/events'))).toHaveLength(2))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel all' }))

    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([url, init]) => /\/runs\/compare-[^/]+$/.test(String(url)) && init?.method === 'DELETE')).toHaveLength(2))
    expect(await screen.findAllByText('cancelled')).toHaveLength(2)
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
