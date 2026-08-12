import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Backpack,
  Brain,
  CirclePlus,
  Command,
  FileUp,
  Focus,
  GitBranch,
  GitCompareArrows,
  Library,
  MessageSquare,
  Paperclip,
  Play,
  PlugZap,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Square,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { TooltipProvider } from '@/components/ui/tooltip'

import {
  ApiError,
  api,
  streamRun,
  type Backpack as BackpackRecord,
  type ContextPlan,
  type Conversation,
  type Memory,
  type ModelSummary,
  type Preset,
  type ProviderPolicy,
  type ProviderSummary,
  type RunSnapshot,
  type TurnPreflight,
  type Upload,
} from './api/client'

type Page = 'Chat' | 'Compare' | 'Context' | 'Evidence' | 'Replay' | 'Focus' | 'Providers' | 'Library' | 'Settings'

const navigation = [
  ['Chat', MessageSquare],
  ['Compare', GitCompareArrows],
  ['Context', Brain],
  ['Evidence', ShieldCheck],
  ['Replay', RotateCcw],
  ['Focus', Focus],
  ['Providers', PlugZap],
  ['Library', Library],
  ['Settings', Settings],
] as const

const defaultPolicy: ProviderPolicy = {
  allow_memory: false,
  allow_retrieval: false,
  allow_attachments: false,
  allow_web: false,
  allow_backpacks: false,
}

function messageOf(error: unknown) {
  if (error instanceof ApiError && typeof error.detail === 'object' && error.detail) {
    const detail = error.detail as { message?: string }
    return detail.message ?? error.message
  }
  return error instanceof Error ? error.message : 'Request failed'
}

function Navigation({ page, onPage, connected }: { page: Page; onPage: (page: Page) => void; connected: boolean }) {
  return (
    <nav aria-label="Primary navigation" className="nav-rail">
      <div className="brand-mark" aria-label="Local AI Chat Studio"><Command /></div>
      <div className="nav-items">
        {navigation.map(([label, Icon]) => (
          <Button
            key={label}
            aria-label={label}
            aria-current={page === label ? 'page' : undefined}
            className="nav-button"
            onClick={() => onPage(label)}
            size="icon-lg"
            title={label}
            variant={page === label ? 'secondary' : 'ghost'}
          >
            <Icon />
          </Button>
        ))}
      </div>
      <span className={connected ? 'status-dot' : 'status-dot offline'} title={connected ? 'Backend connected' : 'Backend unavailable'} />
    </nav>
  )
}

function ConversationHistory({
  conversations,
  activeId,
  onSelect,
  onCreate,
}: {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
}) {
  const [query, setQuery] = useState('')
  const visible = conversations.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))
  return (
    <aside aria-label="Conversation history" className="history-pane">
      <div className="history-header">
        <div><p className="eyebrow">Local workspace</p><h1>Studio</h1></div>
        <Button aria-label="New conversation" onClick={onCreate} size="icon-sm" variant="outline"><CirclePlus /></Button>
      </div>
      <div className="search-wrap"><Search /><Input aria-label="Search conversations" onChange={(event) => setQuery(event.target.value)} placeholder="Search chats" value={query} /></div>
      <ScrollArea className="history-list">
        <p className="section-label">Conversations</p>
        {visible.map((conversation) => (
          <button
            className={activeId === conversation.id ? 'conversation active' : 'conversation'}
            key={conversation.id}
            onClick={() => onSelect(conversation.id)}
            type="button"
          >
            <span>{conversation.title}</span>{conversation.pinned && <small>pinned</small>}
          </button>
        ))}
        {!visible.length && <p className="empty-copy">No conversations yet.</p>}
      </ScrollArea>
      <div className="local-badge"><span className="pulse" /><div><strong>Local by default</strong><small>Cloud context starts prompt-only</small></div></div>
    </aside>
  )
}

function ContextRail({ plan }: { plan: ContextPlan | null }) {
  if (!plan) return <div className="context-rail empty"><span>Context preflight appears here</span></div>
  const percent = Math.min(100, Math.round((plan.estimated_tokens / plan.budget_tokens) * 100))
  return (
    <div className="context-rail" aria-label="Context budget">
      <div className="rail-copy"><span>{plan.estimated_tokens.toLocaleString()} estimated tokens</span><strong>{percent}% of safe budget</strong></div>
      <div className="rail-track">
        {plan.sections.filter((section) => section.included && section.estimated_tokens).map((section) => (
          <span key={section.kind} style={{ flexGrow: Math.max(1, section.estimated_tokens) }} title={`${section.kind}: ${section.estimated_tokens}`} />
        ))}
      </div>
    </div>
  )
}

function ModelPicker({ models, value, onChange }: { models: ModelSummary[]; value: string; onChange: (value: string) => void }) {
  return (
    <select aria-label="Model" onChange={(event) => onChange(event.target.value)} value={value}>
      {models.map((model) => <option key={`${model.provider}::${model.id}`} value={`${model.provider}::${model.id}`}>{model.label || model.id} · {model.provider}</option>)}
    </select>
  )
}

function ChatWorkspace({
  conversation,
  models,
  selectedModel,
  onModel,
  plan,
  pendingPlan,
  liveOutput,
  running,
  error,
  onSend,
  onConfirm,
  onCancel,
  onUpload,
  onBranch,
}: {
  conversation: Conversation | null
  models: ModelSummary[]
  selectedModel: string
  onModel: (value: string) => void
  plan: ContextPlan | null
  pendingPlan: ContextPlan | null
  liveOutput: string
  running: boolean
  error: string
  onSend: (content: string) => Promise<void>
  onConfirm: () => Promise<void>
  onCancel: () => Promise<void>
  onUpload: (file: File) => Promise<void>
  onBranch: (messageId: string) => Promise<void>
}) {
  const [prompt, setPrompt] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const submit = async () => {
    if (!prompt.trim()) return
    await onSend(prompt.trim())
    setPrompt('')
  }
  return (
    <main aria-label="Chat workspace" className="workspace">
      <header className="workspace-header">
        <div><p className="eyebrow">Conversation</p><h2>{conversation?.title ?? 'New conversation'}</h2></div>
        <ModelPicker models={models} onChange={onModel} value={selectedModel} />
      </header>
      <ContextRail plan={plan} />
      <ScrollArea className="message-area">
        <div className="messages">
          {!conversation?.messages.length && !liveOutput && (
            <div className="welcome"><div className="signal-mark">LOCAL / CONTEXT / CONTROL</div><h3>Work with the whole trail visible.</h3><p>Inspect what enters the prompt, keep private context local, and replay any answer.</p></div>
          )}
          {conversation?.messages.map((message) => (
            <article className={`message ${message.role}`} key={message.id}>
              <div className="message-label"><span>{message.role === 'user' ? 'You' : 'Assistant'}</span>{message.run_id && <Badge variant="outline">evidence saved</Badge>}</div>
              <p>{message.content}</p>
              <div className="message-actions"><Button onClick={() => onBranch(message.id)} size="sm" variant="ghost"><GitBranch /> Branch here</Button></div>
            </article>
          ))}
          {liveOutput && <article className="message assistant live"><div className="message-label"><span>Assistant</span><Badge>streaming</Badge></div><p>{liveOutput}</p></article>}
        </div>
      </ScrollArea>
      {pendingPlan && (
        <div className="safety-strip" role="alert">
          <ShieldCheck /><div><strong>Review before sending</strong><p>{pendingPlan.findings.map((finding) => finding.message).join(' · ')}</p></div>
          <Button onClick={onConfirm}>Confirm and send</Button>
        </div>
      )}
      {error && <div className="error-strip" role="alert">{error}</div>}
      <div className="composer-shell">
        <Textarea
          aria-label="Message"
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit() }
          }}
          placeholder="Message your model…"
          value={prompt}
        />
        <div className="composer-actions">
          <input
            accept=".pdf,.txt,.md,.csv,.docx,.doc,.xlsx,.xls,.json,.py,.png,.jpg,.jpeg,.webp"
            hidden
            onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUpload(file) }}
            ref={fileRef}
            type="file"
          />
          <Button aria-label="Attach file" onClick={() => fileRef.current?.click()} size="icon-sm" variant="ghost"><Paperclip /></Button>
          <span>Enter to send · Shift+Enter for newline</span>
          {running ? <Button aria-label="Stop generation" onClick={onCancel} size="icon" variant="destructive"><Square /></Button> : <Button aria-label="Send message" disabled={!prompt.trim() || !selectedModel} onClick={submit} size="icon"><Send /></Button>}
        </div>
      </div>
    </main>
  )
}

function Surface({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <main className="page-workspace"><div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div></div>{children}</main>
}

function ComparePage({ models }: { models: ModelSummary[] }) {
  const [prompt, setPrompt] = useState('')
  const [outputs, setOutputs] = useState(['', ''])
  const run = async () => {
    if (!prompt.trim() || !models.length) return
    const targets = [models[0], models[1] ?? models[0]]
    setOutputs(['', ''])
    await Promise.all(targets.map(async (target, index) => {
      const created = await api.createRun({ provider: target.provider, model: target.id, messages: [{ role: 'user', content: prompt }], temperature: 0.7 })
      await streamRun(created.id, (event) => {
        if (event.type === 'run.delta') setOutputs((current) => current.map((item, i) => i === index ? item + String(event.data.delta ?? '') : item))
      })
    }))
  }
  return <Surface eyebrow="Parallel run" title="Compare" description="One prompt, two independent model streams."><div className="action-row"><Input aria-label="Comparison prompt" onChange={(event) => setPrompt(event.target.value)} placeholder="What should both models answer?" value={prompt} /><Button onClick={run}><Play /> Run both</Button></div><div className="split-grid">{outputs.map((output, index) => <Card key={index}><CardHeader><CardTitle>{models[index]?.label || models[index]?.id || `Model ${index + 1}`}</CardTitle></CardHeader><CardContent><pre className="output-block">{output || 'Waiting for a run.'}</pre></CardContent></Card>)}</div></Surface>
}

function ContextPage({ plan, backpacks, onCreate }: { plan: ContextPlan | null; backpacks: BackpackRecord[]; onCreate: (name: string, title: string, content: string) => Promise<void> }) {
  const [name, setName] = useState('Project context')
  const [title, setTitle] = useState('Constraint')
  const [content, setContent] = useState('')
  return <Surface eyebrow="What enters the model" title="Context control" description="Budget, inspect, and carry deliberate context between conversations."><ContextRail plan={plan} /><div className="surface-grid"><Card><CardHeader><CardTitle>Current plan</CardTitle><CardDescription>Sections are estimated locally and preserve 20% for output.</CardDescription></CardHeader><CardContent className="stack-list">{plan?.sections.map((section) => <div className="data-row" key={section.kind}><span>{section.kind}</span><Badge variant={section.included ? 'default' : 'outline'}>{section.included ? `${section.estimated_tokens} tokens` : 'excluded'}</Badge></div>) ?? <p className="muted">Send or preflight a message to build a plan.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Context backpack</CardTitle><CardDescription>Pin an immutable local snapshot for reuse.</CardDescription></CardHeader><CardContent className="form-stack"><Input onChange={(event) => setName(event.target.value)} value={name} /><Input onChange={(event) => setTitle(event.target.value)} value={title} /><Textarea onChange={(event) => setContent(event.target.value)} placeholder="Context to carry" value={content} /><Button disabled={!content.trim()} onClick={async () => { await onCreate(name, title, content); setContent('') }}><Backpack /> Save backpack</Button>{backpacks.map((item) => <div className="data-row" key={item.id}><span>{item.name}</span><small>{item.items.length} items</small></div>)}</CardContent></Card></div></Surface>
}

function EvidencePage({ activity, plan }: { activity: RunSnapshot[]; plan: ContextPlan | null }) {
  return <Surface eyebrow="Why this answer" title="Evidence" description="Inspect sources, policy decisions, safety findings, and integrity receipts."><div className="surface-grid"><Card><CardHeader><CardTitle>Retrieved sources</CardTitle></CardHeader><CardContent className="stack-list">{plan?.sources.map((source) => <div className="source-card" key={source.id}><div><strong>{source.title}</strong><small>{source.kind} · {source.estimated_tokens} tokens</small></div><Badge variant={source.trust === 'trusted' ? 'outline' : 'destructive'}>{source.trust}</Badge><p>{source.preview}</p></div>) ?? <p className="muted">No context plan selected.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Integrity chain</CardTitle></CardHeader><CardContent className="stack-list">{activity.map((run) => <div className="data-row" key={run.id}><div><strong>{run.model}</strong><small>{run.status} · {String(run.metrics.elapsed_seconds ?? '—')}s</small></div><code>{run.receipt_hash?.slice(0, 12) || 'pending'}</code></div>)}</CardContent></Card></div></Surface>
}

function ReplayPage({ activity, models, onReplay }: { activity: RunSnapshot[]; models: ModelSummary[]; onReplay: (run: RunSnapshot) => Promise<void> }) {
  return <Surface eyebrow="Prompt tape" title="Replay lab" description="Re-run a recorded prompt, compare outputs, and export its integrity bundle."><div className="timeline">{activity.map((run) => <Card key={run.id}><CardContent className="run-row"><div><Badge variant="outline">{run.status}</Badge><h3>{run.model}</h3><p>{run.output.slice(0, 180) || run.error || 'No output yet'}</p><small>{run.receipt_hash ? `receipt ${run.receipt_hash.slice(0, 12)}` : 'receipt pending'}</small></div><Button disabled={!models.length} onClick={() => onReplay(run)} variant="outline"><RotateCcw /> Replay</Button></CardContent></Card>)}</div></Surface>
}

function FocusPage({ conversationId, onCreate }: { conversationId: string | null; onCreate: (objective: string, criteria: string, constraints: string[]) => Promise<void> }) {
  const [objective, setObjective] = useState('')
  const [criteria, setCriteria] = useState('')
  const [constraints, setConstraints] = useState('')
  return <Surface eyebrow="Temporary contract" title="Focus" description="Keep one objective and its finish line visible without streaks or scoring."><Card className="focus-card"><CardContent className="form-stack"><label>Objective<Input onChange={(event) => setObjective(event.target.value)} placeholder="What must this conversation accomplish?" value={objective} /></label><label>Success criteria<Textarea onChange={(event) => setCriteria(event.target.value)} placeholder="How will you know it is done?" value={criteria} /></label><label>Constraints<Input onChange={(event) => setConstraints(event.target.value)} placeholder="Comma-separated boundaries" value={constraints} /></label><Button disabled={!conversationId || !objective.trim() || !criteria.trim()} onClick={() => onCreate(objective, criteria, constraints.split(',').map((item) => item.trim()).filter(Boolean))}><Focus /> Start focus session</Button></CardContent></Card></Surface>
}

function ProviderCard({ provider, onChanged }: { provider: ProviderSummary; onChanged: () => Promise<void> }) {
  const [key, setKey] = useState('')
  const [policy, setPolicy] = useState<ProviderPolicy>(defaultPolicy)
  useEffect(() => { void api.providerPolicy(provider.id).then(setPolicy).catch(() => setPolicy(defaultPolicy)) }, [provider.id])
  const toggle = async (field: keyof ProviderPolicy) => {
    const next = { ...policy, [field]: !policy[field] }
    setPolicy(next)
    await api.setProviderPolicy(provider.id, next)
  }
  return <Card><CardHeader><div className="provider-title"><div className="provider-icon">{provider.label[0]}</div><div><CardTitle>{provider.label}</CardTitle><CardDescription>{provider.key_source ? `Connected from ${provider.key_source}` : 'Prompt-only cloud policy'}</CardDescription></div></div></CardHeader><CardContent className="form-stack"><div className="action-row"><Input aria-label={`${provider.label} API key`} onChange={(event) => setKey(event.target.value)} placeholder="Session API key" type="password" value={key} /><Button disabled={!key.trim()} onClick={async () => { await api.setCredential(provider.id, key); setKey(''); await onChanged() }}>Connect</Button>{provider.key_source && <Button onClick={async () => { await api.removeCredential(provider.id); await onChanged() }} variant="outline">Forget</Button>}</div><div className="policy-grid">{Object.keys(policy).map((field) => <label key={field}><input checked={policy[field as keyof ProviderPolicy]} onChange={() => toggle(field as keyof ProviderPolicy)} type="checkbox" />{field.replace('allow_', '').replace('_', ' ')}</label>)}</div></CardContent></Card>
}

function ProvidersPage({ providers, onChanged }: { providers: ProviderSummary[]; onChanged: () => Promise<void> }) {
  return <Surface eyebrow="Data boundaries" title="Providers" description="Credentials stay in memory. Remote providers start with prompt-only access."><div className="provider-grid">{providers.map((provider) => <ProviderCard key={provider.id} onChanged={onChanged} provider={provider} />)}</div></Surface>
}

function LibraryPage({
  memories, presets, uploads, conversationId, onMemory, onPreset, onUpload,
}: {
  memories: Memory[]; presets: Preset[]; uploads: Upload[]; conversationId: string | null
  onMemory: (content: string) => Promise<void>; onPreset: (name: string, prompt: string) => Promise<void>; onUpload: (file: File) => Promise<void>
}) {
  const [memory, setMemory] = useState('')
  const [presetName, setPresetName] = useState('')
  const [presetPrompt, setPresetPrompt] = useState('')
  return <Surface eyebrow="Durable local knowledge" title="Library" description="Manage memories, assistants, and conversation files from one place."><div className="three-grid"><Card><CardHeader><CardTitle>Memory</CardTitle></CardHeader><CardContent className="form-stack"><Textarea onChange={(event) => setMemory(event.target.value)} placeholder="A fact or preference" value={memory} /><Button disabled={!memory.trim()} onClick={async () => { await onMemory(memory); setMemory('') }}><Brain /> Add memory</Button>{memories.map((item) => <div className="data-row" key={item.id}><span>{item.content}</span><Badge variant={item.status === 'active' ? 'outline' : 'destructive'}>{item.status}</Badge></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Assistants</CardTitle></CardHeader><CardContent className="form-stack"><Input onChange={(event) => setPresetName(event.target.value)} placeholder="Assistant name" value={presetName} /><Textarea onChange={(event) => setPresetPrompt(event.target.value)} placeholder="System prompt" value={presetPrompt} /><Button disabled={!presetName.trim()} onClick={async () => { await onPreset(presetName, presetPrompt); setPresetName(''); setPresetPrompt('') }}>Save assistant</Button>{presets.map((item) => <div className="data-row" key={item.id}><span>{item.name}</span><small>{item.model_key || 'Any model'}</small></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Files</CardTitle></CardHeader><CardContent className="form-stack"><label className="file-drop"><FileUp /><span>{conversationId ? 'Add to current conversation' : 'Select a conversation first'}</span><input disabled={!conversationId} onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUpload(file) }} type="file" /></label>{uploads.map((item) => <div className="data-row" key={item.id}><span>{item.filename}</span><small>{Math.ceil(item.size / 1024)} KB</small></div>)}</CardContent></Card></div></Surface>
}

function SettingsPage({ connected }: { connected: boolean }) {
  return <Surface eyebrow="Local runtime" title="Settings" description="Operational defaults are conservative and visible."><div className="surface-grid"><Card><CardHeader><CardTitle>Privacy defaults</CardTitle></CardHeader><CardContent className="stack-list"><div className="data-row"><span>Cloud context</span><Badge>Prompt only</Badge></div><div className="data-row"><span>Credentials</span><Badge variant="outline">Process memory</Badge></div><div className="data-row"><span>Context output reserve</span><Badge variant="outline">20%</Badge></div></CardContent></Card><Card><CardHeader><CardTitle>Runtime</CardTitle></CardHeader><CardContent className="stack-list"><div className="data-row"><span>FastAPI</span><Badge variant={connected ? 'default' : 'destructive'}>{connected ? 'Connected' : 'Unavailable'}</Badge></div><div className="data-row"><span>Canonical data</span><code>data/app.db</code></div><div className="data-row"><span>Vector data</span><code>data/chroma</code></div></CardContent></Card></div></Surface>
}

async function fileAsBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function App() {
  const [page, setPage] = useState<Page>('Chat')
  const [connected, setConnected] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [providers, setProviders] = useState<ProviderSummary[]>([])
  const [models, setModels] = useState<ModelSummary[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [activity, setActivity] = useState<RunSnapshot[]>([])
  const [memories, setMemories] = useState<Memory[]>([])
  const [presets, setPresets] = useState<Preset[]>([])
  const [backpacks, setBackpacks] = useState<BackpackRecord[]>([])
  const [uploads, setUploads] = useState<Upload[]>([])
  const [plan, setPlan] = useState<ContextPlan | null>(null)
  const [pendingPlan, setPendingPlan] = useState<ContextPlan | null>(null)
  const [pendingPayload, setPendingPayload] = useState<TurnPreflight | null>(null)
  const [liveOutput, setLiveOutput] = useState('')
  const [activeRun, setActiveRun] = useState<string | null>(null)
  const [error, setError] = useState('')

  const refreshProviders = useCallback(async () => {
    const [providerData, modelData] = await Promise.all([api.providers(), api.models()])
    setProviders(providerData.providers)
    const discovered = Object.values(modelData).flatMap((item) => item.models ?? [])
    setModels(discovered)
    setSelectedModel((current) => current || (discovered[0] ? `${discovered[0].provider}::${discovered[0].id}` : ''))
  }, [])

  const refreshLibrary = useCallback(async () => {
    const [memoryData, presetData, backpackData, activityData] = await Promise.all([
      api.memories(), api.presets(), api.backpacks(), api.activity(),
    ])
    setMemories(memoryData); setPresets(presetData); setBackpacks(backpackData); setActivity(activityData)
  }, [])

  const refreshConversations = useCallback(async () => {
    const items = await api.conversations()
    setConversations(items)
    setActiveId((current) => current ?? items[0]?.id ?? null)
  }, [])

  useEffect(() => {
    void Promise.all([api.health(), refreshConversations(), refreshProviders(), refreshLibrary()])
      .then(() => setConnected(true))
      .catch((cause) => setError(messageOf(cause)))
  }, [refreshConversations, refreshLibrary, refreshProviders])

  useEffect(() => {
    if (!activeId) { setConversation(null); setUploads([]); return }
    void Promise.all([api.conversation(activeId), api.uploads(activeId)])
      .then(([detail, fileItems]) => { setConversation(detail); setUploads(fileItems) })
      .catch((cause) => setError(messageOf(cause)))
  }, [activeId])

  const target = useMemo(() => {
    const [provider, ...modelParts] = selectedModel.split('::')
    return { provider, model: modelParts.join('::') }
  }, [selectedModel])

  const submitTurn = async (payload: TurnPreflight, contextPlan: ContextPlan, confirmed: string[] = []) => {
    if (!activeId) return
    setPendingPlan(null); setError(''); setLiveOutput('')
    const run = await api.createTurn(activeId, {
      ...payload,
      plan_hash: contextPlan.plan_hash,
      confirmed_finding_ids: confirmed,
      excluded_source_ids: [],
    })
    setActiveRun(run.id)
    await streamRun(run.id, (event) => {
      if (event.type === 'run.delta') setLiveOutput((current) => current + String(event.data.delta ?? ''))
      if (event.type === 'run.completed') setLiveOutput(String(event.data.output ?? ''))
      if (event.type === 'run.failed') setError(String(event.data.error ?? 'Generation failed'))
    })
    setActiveRun(null)
    const [detail, runs] = await Promise.all([api.conversation(activeId), api.activity()])
    setConversation(detail); setActivity(runs)
    if (detail.messages.some((item) => item.run_id === run.id)) setLiveOutput('')
  }

  const send = async (content: string) => {
    if (!activeId || !target.provider || !target.model) return
    const payload: TurnPreflight = {
      provider: target.provider,
      model: target.model,
      content,
      temperature: 0.7,
      include_memory: true,
      include_retrieval: true,
      include_attachments: true,
      include_web: false,
      include_backpack: true,
      context_limit: models.find((item) => item.provider === target.provider && item.id === target.model)?.context_length ?? 8192,
    }
    try {
      const nextPlan = await api.preflight(activeId, payload)
      setPlan(nextPlan)
      if (nextPlan.requires_confirmation) { setPendingPlan(nextPlan); setPendingPayload(payload); return }
      await submitTurn(payload, nextPlan)
    } catch (cause) { setError(messageOf(cause)) }
  }

  const upload = async (file: File) => {
    if (!activeId) return
    try {
      await api.upload(activeId, file.name, await fileAsBase64(file))
      setUploads(await api.uploads(activeId))
    } catch (cause) { setError(messageOf(cause)) }
  }

  const createConversation = async () => {
    const created = await api.createConversation()
    await refreshConversations()
    setActiveId(created.id); setPage('Chat')
  }

  return (
    <TooltipProvider>
      <div className="app-shell">
        <Navigation connected={connected} onPage={setPage} page={page} />
        {page === 'Chat' && <ConversationHistory activeId={activeId} conversations={conversations} onCreate={createConversation} onSelect={setActiveId} />}
        {page === 'Chat' && <ChatWorkspace conversation={conversation} error={error} liveOutput={liveOutput} models={models} onBranch={async (messageId) => { if (!activeId) return; const branch = await api.branchConversation(activeId, messageId); await refreshConversations(); setActiveId(branch.id) }} onCancel={async () => { if (activeRun) await api.cancelRun(activeRun) }} onConfirm={async () => { if (pendingPayload && pendingPlan) await submitTurn(pendingPayload, pendingPlan, pendingPlan.findings.map((item) => item.id)) }} onModel={setSelectedModel} onSend={send} onUpload={upload} pendingPlan={pendingPlan} plan={plan} running={Boolean(activeRun)} selectedModel={selectedModel} />}
        {page === 'Compare' && <ComparePage models={models} />}
        {page === 'Context' && <ContextPage backpacks={backpacks} onCreate={async (name, title, content) => { await api.createBackpack(name, title, content); setBackpacks(await api.backpacks()) }} plan={plan} />}
        {page === 'Evidence' && <EvidencePage activity={activity} plan={plan} />}
        {page === 'Replay' && <ReplayPage activity={activity} models={models} onReplay={async (run) => { const model = models[0]; if (!model) return; const replay = await api.replay(run.id, model.provider, model.id); await streamRun(replay.id, () => {}); setActivity(await api.activity()) }} />}
        {page === 'Focus' && <FocusPage conversationId={activeId} onCreate={async (objective, criteria, constraints) => { if (!activeId) return; await api.createFocus({ conversation_id: activeId, objective, success_criteria: criteria, constraints }); setPage('Chat') }} />}
        {page === 'Providers' && <ProvidersPage onChanged={refreshProviders} providers={providers} />}
        {page === 'Library' && <LibraryPage conversationId={activeId} memories={memories} onMemory={async (content) => { await api.createMemory(content); setMemories(await api.memories()) }} onPreset={async (name, prompt) => { await api.createPreset({ name, system_prompt: prompt, model_key: selectedModel, temperature: 0.7 }); setPresets(await api.presets()) }} onUpload={upload} presets={presets} uploads={uploads} />}
        {page === 'Settings' && <SettingsPage connected={connected} />}
      </div>
    </TooltipProvider>
  )
}

export default App
