import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Backpack,
  Brain,
  CheckCircle,
  CirclePlus,
  Command,
  Copy,
  Download,
  FileUp,
  Focus,
  GitBranch,
  GitCompareArrows,
  Library,
  MessageSquare,
  Paperclip,
  Play,
  PlugZap,
  Power,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  XCircle,
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
  type OpenCodeAuthMethod,
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
  onUpdate,
  onDelete,
}: {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onUpdate: (id: string, payload: { title?: string; pinned?: boolean }) => Promise<void>
  onDelete: (id: string) => Promise<void>
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
          <div className={activeId === conversation.id ? 'conversation active' : 'conversation'} key={conversation.id}>
            <button className="conversation-select" onClick={() => onSelect(conversation.id)} type="button"><span>{conversation.title}</span>{conversation.pinned && <small>pinned</small>}</button>
            <div className="conversation-tools">
              <Button aria-label={`Rename ${conversation.title}`} onClick={async () => { const title = window.prompt('Conversation title', conversation.title); if (title?.trim()) await onUpdate(conversation.id, { title: title.trim() }) }} size="icon-sm" variant="ghost">✎</Button>
              <Button aria-label={`${conversation.pinned ? 'Unpin' : 'Pin'} ${conversation.title}`} onClick={() => onUpdate(conversation.id, { pinned: !conversation.pinned })} size="icon-sm" variant="ghost">⌖</Button>
              <Button aria-label={`Delete ${conversation.title}`} onClick={() => onDelete(conversation.id)} size="icon-sm" variant="ghost"><Trash2 /></Button>
            </div>
          </div>
        ))}
        {!visible.length && <p className="empty-copy">No conversations yet.</p>}
      </ScrollArea>
      <div className="local-badge"><span className="pulse" /><div><strong>Local by default</strong><small>Cloud context starts prompt-only</small></div></div>
    </aside>
  )
}

function formatUsd(value: number) {
  if (value === 0) return '$0.00'
  if (value < 0.01) return `$${value.toFixed(4)}`
  return `$${value.toFixed(2)}`
}

function pricingLabel(model: ModelSummary) {
  const pricing = model.pricing
  return pricing ? `${formatUsd(pricing.input_per_million)} in / ${formatUsd(pricing.output_per_million)} out per 1M` : 'pricing unavailable'
}

function ContextRail({ plan, model }: { plan: ContextPlan | null; model?: ModelSummary }) {
  if (!plan) return <div className="context-rail empty"><span>Context preflight appears here</span></div>
  const percent = Math.min(100, Math.round((plan.estimated_tokens / plan.budget_tokens) * 100))
  const estimatedInputCost = model?.pricing ? (plan.estimated_tokens / 1_000_000) * model.pricing.input_per_million : null
  return (
    <div className="context-rail" aria-label="Context budget">
      <div className="rail-copy"><span>{plan.estimated_tokens.toLocaleString()} estimated tokens{estimatedInputCost !== null ? ` · est. input ${formatUsd(estimatedInputCost)}` : ''}</span><strong>{percent}% of safe budget</strong></div>
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
      {models.map((model) => <option key={`${model.provider}::${model.id}`} value={`${model.provider}::${model.id}`}>{model.label || model.id} · {model.provider} · {pricingLabel(model)}</option>)}
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
  onSanitize,
  onCancel,
  onUpload,
  uploads,
  attachmentIds,
  onAttachment,
  onSaveMemories,
  savingMemories,
  onBranch,
  onFeedback,
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
  onSanitize: () => Promise<void>
  onCancel: () => Promise<void>
  onUpload: (file: File) => Promise<void>
  uploads: Upload[]
  attachmentIds: Set<string>
  onAttachment: (id: string) => void
  onSaveMemories: () => Promise<void>
  savingMemories: boolean
  onBranch: (messageId: string) => Promise<void>
  onFeedback: (messageId: string, rating: -1 | 1) => Promise<void>
}) {
  const [prompt, setPrompt] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const selected = models.find((model) => `${model.provider}::${model.id}` === selectedModel)
  const submit = async () => {
    if (!prompt.trim()) return
    await onSend(prompt.trim())
    setPrompt('')
  }
  return (
    <main aria-label="Chat workspace" className="workspace">
      <header className="workspace-header">
        <div><p className="eyebrow">Conversation</p><h2>{conversation?.title ?? 'New conversation'}</h2>{selected?.pricing && <small>Estimated pricing: {pricingLabel(selected)} · <a href={selected.pricing.source_url} rel="noreferrer" target="_blank">official source</a></small>}</div>
        <div className="action-row"><Button disabled={!conversation?.messages.length || savingMemories || !selectedModel} onClick={onSaveMemories} variant="outline"><Brain /> {savingMemories ? 'Saving…' : 'Save memories & close'}</Button><ModelPicker models={models} onChange={onModel} value={selectedModel} /></div>
      </header>
      <ContextRail model={selected} plan={plan} />
      <ScrollArea className="message-area">
        <div className="messages">
          {!conversation?.messages.length && !liveOutput && (
            <div className="welcome"><div className="signal-mark">LOCAL / CONTEXT / CONTROL</div><h3>Work with the whole trail visible.</h3><p>Inspect what enters the prompt, keep private context local, and replay any answer.</p></div>
          )}
          {conversation?.messages.map((message) => (
            <article className={`message ${message.role}`} key={message.id}>
              <div className="message-label"><span>{message.role === 'user' ? 'You' : 'Assistant'}</span>{message.run_id && <Badge variant="outline">evidence saved</Badge>}</div>
              <p>{message.content}</p>
              <div className="message-actions">
                <Button onClick={() => navigator.clipboard.writeText(message.content)} size="sm" variant="ghost"><Copy /> Copy</Button>
                <Button onClick={() => onBranch(message.id)} size="sm" variant="ghost"><GitBranch /> Branch here</Button>
                {message.role === 'assistant' && <><Button aria-label="Helpful" onClick={() => onFeedback(message.id, 1)} size="icon-sm" variant="ghost"><ThumbsUp /></Button><Button aria-label="Not helpful" onClick={() => onFeedback(message.id, -1)} size="icon-sm" variant="ghost"><ThumbsDown /></Button></>}
              </div>
            </article>
          ))}
          {liveOutput && <article className="message assistant live"><div className="message-label"><span>Assistant</span><Badge>streaming</Badge></div><p>{liveOutput}</p></article>}
        </div>
      </ScrollArea>
      {pendingPlan && (
        <div className="safety-strip" role="alert">
          <ShieldCheck /><div><strong>Review before sending</strong><p>{pendingPlan.findings.map((finding) => finding.message).join(' · ')}</p></div>
          <Button onClick={onSanitize} variant="outline">Redact private text</Button><Button onClick={onConfirm}>Confirm and send</Button>
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
        {uploads.length > 0 && <div className="action-row" aria-label="Conversation attachments">{uploads.map((upload) => <label key={upload.id}><input checked={attachmentIds.has(upload.id)} onChange={() => onAttachment(upload.id)} type="checkbox" /> {upload.filename}</label>)}</div>}
      </div>
    </main>
  )
}

function Surface({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <main className="page-workspace"><div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div></div>{children}</main>
}

type ComparisonResult = {
  key: string
  output: string
  status: 'waiting' | 'starting' | 'streaming' | 'completed' | 'failed' | 'cancelled'
  error?: string
}

const comparisonModelKey = (model: ModelSummary) => `${model.provider}::${model.id}`

function ComparePage({ models }: { models: ModelSummary[] }) {
  const [prompt, setPrompt] = useState('')
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [results, setResults] = useState<ComparisonResult[]>([])
  const [running, setRunning] = useState(false)
  const controllers = useRef(new Map<string, AbortController>())
  const runIds = useRef(new Map<string, string>())
  const batch = useRef(0)

  useEffect(() => {
    if (selectedModels.length || !models.length) return
    setSelectedModels(models.slice(0, 2).map(comparisonModelKey))
  }, [models, selectedModels.length])

  const selectedTargets = selectedModels.flatMap((key) => {
    const model = models.find((candidate) => comparisonModelKey(candidate) === key)
    return model ? [model] : []
  })

  const updateResult = (key: string, update: Partial<ComparisonResult>, batchId: number) => {
    if (batch.current !== batchId) return
    setResults((current) => current.map((result) => result.key === key ? { ...result, ...update } : result))
  }

  const run = async () => {
    if (!prompt.trim() || selectedTargets.length < 2) return
    const batchId = ++batch.current
    controllers.current.clear()
    runIds.current.clear()
    setResults(selectedTargets.map((target) => ({ key: comparisonModelKey(target), output: '', status: 'starting' })))
    setRunning(true)
    await Promise.allSettled(selectedTargets.map(async (target) => {
      const key = comparisonModelKey(target)
      const controller = new AbortController()
      controllers.current.set(key, controller)
      try {
        const created = await api.createRun({ provider: target.provider, model: target.id, messages: [{ role: 'user', content: prompt.trim(), images: [] }], temperature: 0.7 })
        runIds.current.set(key, created.id)
        if (controller.signal.aborted) {
          await api.cancelRun(created.id).catch(() => undefined)
          return
        }
        await streamRun(created.id, (event) => {
          if (event.type === 'run.started') updateResult(key, { status: 'streaming' }, batchId)
          if (event.type === 'run.delta') {
            const delta = String(event.data.delta ?? '')
            if (batch.current === batchId) setResults((current) => current.map((result) => result.key === key ? { ...result, output: result.output + delta, status: 'streaming' } : result))
          }
          if (event.type === 'run.completed') updateResult(key, { output: String(event.data.output ?? ''), status: 'completed' }, batchId)
          if (event.type === 'run.failed') updateResult(key, { status: 'failed', error: String(event.data.error ?? 'Generation failed') }, batchId)
          if (event.type === 'run.cancelled') updateResult(key, { status: 'cancelled' }, batchId)
        }, controller.signal)
      } catch (error) {
        if (controller.signal.aborted) updateResult(key, { status: 'cancelled' }, batchId)
        else updateResult(key, { status: 'failed', error: error instanceof Error ? error.message : 'Generation failed' }, batchId)
      }
    }))
    if (batch.current === batchId) setRunning(false)
  }

  const cancelAll = async () => {
    const activeBatch = batch.current
    controllers.current.forEach((controller) => controller.abort())
    await Promise.allSettled([...runIds.current.values()].map((runId) => api.cancelRun(runId)))
    if (batch.current === activeBatch) {
      setResults((current) => current.map((result) => ['starting', 'streaming'].includes(result.status) ? { ...result, status: 'cancelled' } : result))
      setRunning(false)
    }
  }

  const replaceSelection = (index: number, key: string) => setSelectedModels((current) => current.map((item, itemIndex) => itemIndex === index ? key : item))
  const addModel = () => {
    const available = models.find((model) => !selectedModels.includes(comparisonModelKey(model)))
    if (available) setSelectedModels((current) => [...current, comparisonModelKey(available)])
  }
  const removeModel = (index: number) => setSelectedModels((current) => current.filter((_, itemIndex) => itemIndex !== index))

  return (
    <Surface eyebrow="Parallel run" title="Compare" description="Send one prompt to 2–4 models and compare their independent streams.">
      <div className="compare-models">
        {selectedModels.map((selected, index) => (
          <label className="compare-model-field" key={`${index}-${selected}`}>
            <span>Model {index + 1}</span>
            <div className="action-row">
              <select aria-label={`Comparison model ${index + 1}`} disabled={running} onChange={(event) => replaceSelection(index, event.target.value)} value={selected}>
                {models.map((model) => {
                  const key = comparisonModelKey(model)
                  return <option disabled={key !== selected && selectedModels.includes(key)} key={key} value={key}>{model.label || model.id} · {model.provider} · {pricingLabel(model)}</option>
                })}
              </select>
              {selectedModels.length > 2 && <Button aria-label={`Remove model ${index + 1}`} disabled={running} onClick={() => removeModel(index)} size="icon-sm" variant="ghost"><Trash2 /></Button>}
            </div>
          </label>
        ))}
        {selectedModels.length < Math.min(4, models.length) && <Button disabled={running} onClick={addModel} variant="outline"><CirclePlus /> Add model</Button>}
      </div>
      <div className="compare-prompt">
        <Input aria-label="Comparison prompt" disabled={running} onChange={(event) => setPrompt(event.target.value)} placeholder="What should the models answer?" value={prompt} />
        {running ? <Button onClick={cancelAll} variant="destructive"><Square /> Cancel all</Button> : <Button disabled={!prompt.trim() || selectedTargets.length < 2} onClick={run}><Play /> Run {selectedTargets.length} models</Button>}
      </div>
      <p className="compare-cost-note">Each selected cloud model receives a separate request and may incur provider charges.</p>
      <div className="comparison-grid">
        {results.length ? results.map((result) => {
          const model = models.find((candidate) => comparisonModelKey(candidate) === result.key)
          return <Card key={result.key}><CardHeader><div className="comparison-title"><div><CardTitle>{model?.label || model?.id || result.key}</CardTitle><CardDescription>{model?.provider} · {model ? pricingLabel(model) : 'pricing unavailable'}</CardDescription></div><Badge variant={result.status === 'failed' ? 'destructive' : 'outline'}>{result.status}</Badge></div></CardHeader><CardContent><pre aria-live="polite" className="output-block">{result.error || result.output || (result.status === 'starting' ? 'Starting run…' : 'Waiting for response…')}</pre></CardContent></Card>
        }) : selectedTargets.map((model) => <Card key={comparisonModelKey(model)}><CardHeader><CardTitle>{model.label || model.id}</CardTitle><CardDescription>{model.provider} · {pricingLabel(model)}</CardDescription></CardHeader><CardContent><pre className="output-block">Waiting for a run.</pre></CardContent></Card>)}
      </div>
    </Surface>
  )
}

function ContextPage({ plan, backpacks, onCreate }: { plan: ContextPlan | null; backpacks: BackpackRecord[]; onCreate: (name: string, title: string, content: string) => Promise<void> }) {
  const [name, setName] = useState('Project context')
  const [title, setTitle] = useState('Constraint')
  const [content, setContent] = useState('')
  return <Surface eyebrow="What enters the model" title="Context control" description="Budget, inspect, and carry deliberate context between conversations."><ContextRail plan={plan} /><div className="surface-grid"><Card><CardHeader><CardTitle>Current plan</CardTitle><CardDescription>Sections are estimated locally and preserve 20% for output.</CardDescription></CardHeader><CardContent className="stack-list">{plan?.sections.map((section) => <div className="data-row" key={section.kind}><span>{section.kind}</span><Badge variant={section.included ? 'default' : 'outline'}>{section.included ? `${section.estimated_tokens} tokens` : 'excluded'}</Badge></div>) ?? <p className="muted">Send or preflight a message to build a plan.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Context backpack</CardTitle><CardDescription>Pin an immutable local snapshot for reuse.</CardDescription></CardHeader><CardContent className="form-stack"><Input onChange={(event) => setName(event.target.value)} value={name} /><Input onChange={(event) => setTitle(event.target.value)} value={title} /><Textarea onChange={(event) => setContent(event.target.value)} placeholder="Context to carry" value={content} /><Button disabled={!content.trim()} onClick={async () => { await onCreate(name, title, content); setContent('') }}><Backpack /> Save backpack</Button>{backpacks.map((item) => <div className="data-row" key={item.id}><span>{item.name}</span><small>{item.items.length} items</small></div>)}</CardContent></Card></div></Surface>
}

function EvidencePage({ activity, plan, excluded, onToggle }: { activity: RunSnapshot[]; plan: ContextPlan | null; excluded: Set<string>; onToggle: (id: string) => void }) {
  return <Surface eyebrow="Why this answer" title="Evidence" description="Inspect sources, exclude individual records, and verify integrity receipts."><div className="surface-grid"><Card><CardHeader><CardTitle>Retrieved sources</CardTitle></CardHeader><CardContent className="stack-list">{plan?.sources.map((source) => <div className="source-card" key={source.id}><div><strong>{source.title}</strong><small>{source.kind} · {source.estimated_tokens} tokens</small></div><Badge variant={source.trust === 'trusted' ? 'outline' : 'destructive'}>{source.trust}</Badge><p>{source.preview}</p><label><input checked={!excluded.has(source.id)} disabled={source.trust !== 'trusted'} onChange={() => onToggle(source.id)} type="checkbox" /> Include in next send</label>{source.url && <a href={source.url} rel="noreferrer" target="_blank">Open source</a>}</div>) ?? <p className="muted">No context plan selected.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Integrity chain</CardTitle></CardHeader><CardContent className="stack-list">{activity.map((run) => <div className="data-row" key={run.id}><div><strong>{run.model}</strong><small>{run.status} · {String(run.metrics.elapsed_seconds ?? '—')}s</small></div><code>{run.receipt_hash?.slice(0, 12) || 'pending'}</code></div>)}</CardContent></Card></div></Surface>
}

function ReplayPage({ activity, models, onReplay }: { activity: RunSnapshot[]; models: ModelSummary[]; onReplay: (run: RunSnapshot) => Promise<void> }) {
  const [left, setLeft] = useState<string | null>(null)
  const [diff, setDiff] = useState('')
  const saveBundle = async (run: RunSnapshot, mode: 'full' | 'redacted') => { const bundle = await api.bundle(run.id, mode); const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${run.id}-${mode}.json`; anchor.click(); URL.revokeObjectURL(url) }
  const compare = async (run: RunSnapshot) => { if (!left) { setLeft(run.id); setDiff(''); return } const result = await api.diff(left, run.id); setDiff(result.diff || 'Outputs are identical.'); setLeft(null) }
  return <Surface eyebrow="Prompt tape" title="Replay lab" description="Re-run a recorded prompt, compare outputs, and export full or privacy-safe bundles."><div className="timeline">{activity.map((run) => <Card key={run.id}><CardContent className="run-row"><div><Badge variant="outline">{run.status}</Badge><h3>{run.model}</h3><p>{run.output.slice(0, 180) || run.error || 'No output yet'}</p><small>{run.receipt_hash ? `receipt ${run.receipt_hash.slice(0, 12)}` : 'receipt pending'}</small></div><div className="inline-actions"><Button disabled={!models.length} onClick={() => onReplay(run)} variant="outline"><RotateCcw /> Replay</Button><Button onClick={() => compare(run)} variant="outline">{left ? 'Compare here' : 'Select for diff'}</Button><Button onClick={() => saveBundle(run, 'full')} size="icon-sm" variant="ghost" title="Export full local bundle"><Download /></Button><Button onClick={() => saveBundle(run, 'redacted')} size="icon-sm" variant="ghost" title="Export redacted share bundle"><ShieldCheck /></Button></div></CardContent></Card>)}{diff && <pre className="output-block">{diff}</pre>}</div></Surface>
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
  const [simulation, setSimulation] = useState('')
  const [oauthMethods, setOauthMethods] = useState<Record<string, OpenCodeAuthMethod[]>>({})
  useEffect(() => { void api.providerPolicy(provider.id).then(setPolicy).catch(() => setPolicy(defaultPolicy)) }, [provider.id])
  useEffect(() => {
    if (provider.id === 'opencode-bridge') void api.openCodeAuthMethods().then(setOauthMethods).catch(() => setOauthMethods({}))
  }, [provider.id])
  const toggle = async (field: keyof ProviderPolicy) => {
    const next = { ...policy, [field]: !policy[field] }
    setPolicy(next)
    await api.setProviderPolicy(provider.id, next)
  }
  const connectOauth = async (upstream: string, method: OpenCodeAuthMethod) => {
    const auth = await api.startOpenCodeAuth(upstream, method.method)
    window.open(auth.url, '_blank', 'noopener,noreferrer')
    const code = auth.method === 'code' ? window.prompt(auth.instructions || 'Enter the authorization code') : undefined
    if (auth.method === 'code' && !code) return
    await api.completeOpenCodeAuth(upstream, method.method, code || undefined)
    await onChanged()
  }
  const supportedOauth = Object.entries(oauthMethods).filter(([id]) => /openai|chatgpt|anthropic|claude|xai|grok/i.test(id))
  return <Card><CardHeader><div className="provider-title"><div className="provider-icon">{provider.label[0]}</div><div><CardTitle>{provider.label}</CardTitle><CardDescription>{provider.key_source ? `Connected from ${provider.key_source}` : provider.auth_modes.includes('none') ? 'Local connection · no key required' : 'Prompt-only cloud policy'}</CardDescription></div></div></CardHeader><CardContent className="form-stack">{provider.auth_modes.includes('api_key') && <div className="action-row"><Input aria-label={`${provider.label} API key`} onChange={(event) => setKey(event.target.value)} placeholder="Session API key" type="password" value={key} /><Button disabled={!key.trim()} onClick={async () => { await api.setCredential(provider.id, key); setKey(''); await onChanged() }}>Connect</Button>{provider.key_source && <Button onClick={async () => { await api.removeCredential(provider.id); await onChanged() }} variant="outline">Forget</Button>}</div>}{provider.auth_modes.includes('wif') && <small>Claude WIF is discovered from the backend environment or active Anthropic profile.</small>}{provider.id === 'openrouter' && <Button onClick={async () => { const auth = await api.startOpenRouterAuth(); window.location.assign(auth.authorization_url) }} variant="outline">Sign in with OpenRouter</Button>}{supportedOauth.flatMap(([upstream, methods]) => methods.map((method) => <Button key={`${upstream}-${method.method}`} onClick={() => connectOauth(upstream, method)} variant="outline">Connect {method.label} through OpenCode</Button>))}<div className="policy-grid">{Object.keys(policy).map((field) => <label key={field}><input checked={policy[field as keyof ProviderPolicy]} onChange={() => toggle(field as keyof ProviderPolicy)} type="checkbox" />{field.replace('allow_', '').replace('_', ' ')}</label>)}</div><Button onClick={async () => { const result = await api.simulateProvider(provider.id, 'rate_limit', provider.id === 'ollama-local' ? undefined : 'ollama-local'); setSimulation(result.recovered ? 'Fallback path recovered' : 'Failure surfaced safely') }} variant="outline"><Play /> Test failover</Button>{simulation && <small>{simulation}</small>}</CardContent></Card>
}

function ProvidersPage({ providers, onChanged }: { providers: ProviderSummary[]; onChanged: () => Promise<void> }) {
  return <Surface eyebrow="Data boundaries" title="Providers" description="Credentials stay in memory. Remote providers start with prompt-only access."><div className="provider-grid">{providers.map((provider) => <ProviderCard key={provider.id} onChanged={onChanged} provider={provider} />)}</div></Surface>
}

function LibraryPage({
  memories, presets, uploads, conversationId, onMemory, onMemoryUpdate, onMemoryDelete, onPreset, onPresetDelete, onUpload,
}: {
  memories: Memory[]; presets: Preset[]; uploads: Upload[]; conversationId: string | null
  onMemory: (content: string) => Promise<void>; onMemoryUpdate: (id: string, payload: { status?: Memory['status']; pinned?: boolean }) => Promise<void>; onMemoryDelete: (id: string) => Promise<void>; onPreset: (name: string, prompt: string) => Promise<void>; onPresetDelete: (id: string) => Promise<void>; onUpload: (file: File) => Promise<void>
}) {
  const [memory, setMemory] = useState('')
  const [presetName, setPresetName] = useState('')
  const [presetPrompt, setPresetPrompt] = useState('')
  return <Surface eyebrow="Durable local knowledge" title="Library" description="Manage memories, assistants, and conversation files from one place."><div className="three-grid"><Card><CardHeader><CardTitle>Memory</CardTitle></CardHeader><CardContent className="form-stack"><Textarea onChange={(event) => setMemory(event.target.value)} placeholder="A fact or preference" value={memory} /><Button disabled={!memory.trim()} onClick={async () => { await onMemory(memory); setMemory('') }}><Brain /> Add memory</Button>{memories.map((item) => <div className="data-row" key={item.id}><span>{item.content}</span><Badge variant={item.status === 'active' ? 'outline' : 'destructive'}>{item.status}</Badge><div className="inline-actions">{item.status === 'quarantined' && <Button onClick={() => onMemoryUpdate(item.id, { status: 'active' })} size="icon-sm" variant="ghost"><CheckCircle /></Button>}<Button onClick={() => onMemoryUpdate(item.id, { pinned: !item.pinned })} size="icon-sm" variant="ghost">⌖</Button><Button onClick={() => onMemoryUpdate(item.id, { status: 'archived' })} size="icon-sm" variant="ghost"><XCircle /></Button><Button onClick={() => onMemoryDelete(item.id)} size="icon-sm" variant="ghost"><Trash2 /></Button></div></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Assistants</CardTitle></CardHeader><CardContent className="form-stack"><Input onChange={(event) => setPresetName(event.target.value)} placeholder="Assistant name" value={presetName} /><Textarea onChange={(event) => setPresetPrompt(event.target.value)} placeholder="System prompt" value={presetPrompt} /><Button disabled={!presetName.trim()} onClick={async () => { await onPreset(presetName, presetPrompt); setPresetName(''); setPresetPrompt('') }}>Save assistant</Button>{presets.map((item) => <div className="data-row" key={item.id}><span>{item.name}</span><small>{item.model_key || 'Any model'}</small><Button onClick={() => onPresetDelete(item.id)} size="icon-sm" variant="ghost"><Trash2 /></Button></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Files</CardTitle></CardHeader><CardContent className="form-stack"><label className="file-drop"><FileUp /><span>{conversationId ? 'Add to current conversation' : 'Select a conversation first'}</span><input disabled={!conversationId} onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUpload(file) }} type="file" /></label>{uploads.map((item) => <div className="data-row" key={item.id}><span>{item.filename}</span><small>{Math.ceil(item.size / 1024)} KB</small></div>)}</CardContent></Card></div></Surface>
}

function SettingsPage({ connected, onRefresh }: { connected: boolean; onRefresh: () => Promise<void> }) {
  const importRef = useRef<HTMLInputElement>(null)
  const [runtime, setRuntime] = useState<{ ollama_available: boolean; running_models: { name: string; size_gb: number }[] } | null>(null)
  const [profile, setProfile] = useState('')
  const [stopping, setStopping] = useState(false)
  const [stopError, setStopError] = useState('')
  useEffect(() => { void Promise.all([api.runtimeHealth(), api.profile()]).then(([health, saved]) => { setRuntime(health); setProfile(saved.content) }) }, [])
  const download = async () => { const { jsonl } = await api.exportData(); const url = URL.createObjectURL(new Blob([jsonl], { type: 'application/x-ndjson' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'local-ai-chat-studio.jsonl'; anchor.click(); URL.revokeObjectURL(url) }
  const stopStudio = async () => {
    if (!window.confirm('Stop Local AI Chat Studio? Active generations will be cancelled. Ollama and OpenCode will keep running.')) return
    setStopError('')
    try {
      await api.shutdown()
      setStopping(true)
    } catch (cause) {
      setStopError(messageOf(cause))
    }
  }
  return <Surface eyebrow="Local runtime" title="Settings" description="Operational defaults and portable data controls are visible here."><div className="surface-grid"><Card><CardHeader><CardTitle>Privacy and data</CardTitle></CardHeader><CardContent className="stack-list"><div className="data-row"><span>Cloud context</span><Badge>Prompt only</Badge></div><div className="data-row"><span>Credentials</span><Badge variant="outline">Process memory</Badge></div><div className="data-row"><span>Context output reserve</span><Badge variant="outline">20%</Badge></div><Textarea onChange={(event) => setProfile(event.target.value)} placeholder="Personalization profile" value={profile} /><Button onClick={() => api.setProfile(profile)} variant="outline">Save profile</Button><Button onClick={download} variant="outline"><Download /> Export JSONL</Button><input accept=".jsonl,.ndjson,.txt" hidden onChange={async (event) => { const file = event.target.files?.[0]; if (file) { await api.importData(await file.text()); await onRefresh() } }} ref={importRef} type="file" /><Button onClick={() => importRef.current?.click()} variant="outline"><FileUp /> Import JSONL</Button><Button onClick={async () => { if (window.confirm('Import the previous v2 database into data/app.db? A backup is created first.')) { await api.importV2(); await onRefresh() } }} variant="outline">Import previous v2 data</Button><Button onClick={async () => { if (window.confirm('Permanently wipe all local workspace data?')) { await api.wipeData(); await onRefresh() } }} variant="destructive"><Trash2 /> Panic wipe</Button></CardContent></Card><Card><CardHeader><CardTitle>Runtime</CardTitle></CardHeader><CardContent className="stack-list"><div className="data-row"><span>FastAPI</span><Badge variant={connected ? 'default' : 'destructive'}>{connected ? 'Connected' : 'Unavailable'}</Badge></div><div className="data-row"><span>Ollama</span><Badge variant={runtime?.ollama_available ? 'default' : 'outline'}>{runtime?.ollama_available ? 'Available' : 'Offline'}</Badge></div>{runtime?.running_models.map((model) => <div className="data-row" key={model.name}><span>{model.name}</span><small>{model.size_gb.toFixed(1)} GB VRAM</small></div>)}<div className="data-row"><span>Canonical data</span><code>data/app.db</code></div><div className="data-row"><span>Vector data</span><code>data/chroma</code></div><Button aria-label={stopping ? 'Stopping…' : 'Stop Studio'} disabled={stopping} onClick={stopStudio} variant="destructive"><Power /> {stopping ? 'Stopping…' : 'Stop Studio'}</Button>{stopping && <small>Studio stopped. You may close this tab.</small>}{stopError && <small className="error-strip">{stopError}</small>}</CardContent></Card></div></Surface>
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
  const [attachmentIds, setAttachmentIds] = useState<Set<string>>(new Set())
  const [plan, setPlan] = useState<ContextPlan | null>(null)
  const [pendingPlan, setPendingPlan] = useState<ContextPlan | null>(null)
  const [pendingPayload, setPendingPayload] = useState<TurnPreflight | null>(null)
  const [liveOutput, setLiveOutput] = useState('')
  const [activeRun, setActiveRun] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [savingMemories, setSavingMemories] = useState(false)
  const [excludedSources, setExcludedSources] = useState<Set<string>>(new Set())

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
    setAttachmentIds(new Set())
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
      excluded_source_ids: [...excludedSources],
    })
    setAttachmentIds(new Set())
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
      attachment_ids: [...attachmentIds],
      include_web: false,
      include_backpack: true,
      context_limit: models.find((item) => item.provider === target.provider && item.id === target.model)?.context_length ?? 8192,
    }
    try {
      const nextPlan = await api.preflight(activeId, payload)
      setPlan(nextPlan)
      setExcludedSources(new Set(nextPlan.sources.filter((source) => !source.included || source.trust !== 'trusted').map((source) => source.id)))
      if (nextPlan.requires_confirmation) { setPendingPlan(nextPlan); setPendingPayload(payload); return }
      await submitTurn(payload, nextPlan)
    } catch (cause) { setError(messageOf(cause)) }
  }

  const upload = async (file: File, select = false) => {
    if (!activeId) return undefined
    try {
      const uploaded = await api.upload(activeId, file.name, await fileAsBase64(file))
      setUploads(await api.uploads(activeId))
      if (select) setAttachmentIds((current) => new Set(current).add(uploaded.id))
      return uploaded
    } catch (cause) { setError(messageOf(cause)); return undefined }
  }

  const saveMemoriesAndClose = async () => {
    if (!activeId || !target.provider || !target.model) return
    const cloud = target.provider !== 'ollama-local'
    if (cloud && !window.confirm('Send this entire conversation to the selected provider to curate memory?')) return
    setSavingMemories(true); setError('')
    try {
      const result = await api.extractMemories(activeId, { provider: target.provider, model: target.model, cloud_confirmed: cloud })
      setMemories(await api.memories())
      window.alert(`Saved ${result.saved}; quarantined ${result.quarantined}; discarded ${result.discarded}.`)
      setActiveId(null); setConversation(null); setUploads([]); setAttachmentIds(new Set())
    } catch (cause) { setError(messageOf(cause)) }
    finally { setSavingMemories(false) }
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
        {page === 'Chat' && <ConversationHistory activeId={activeId} conversations={conversations} onCreate={createConversation} onDelete={async (id) => { if (!window.confirm('Delete this conversation?')) return; await api.deleteConversation(id); if (activeId === id) setActiveId(null); await refreshConversations() }} onSelect={setActiveId} onUpdate={async (id, payload) => { await api.updateConversation(id, payload); await refreshConversations(); if (activeId === id) setConversation(await api.conversation(id)) }} />}
        {page === 'Chat' && <ChatWorkspace attachmentIds={attachmentIds} conversation={conversation} error={error} liveOutput={liveOutput} models={models} onAttachment={(id) => setAttachmentIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })} onBranch={async (messageId) => { if (!activeId) return; const branch = await api.branchConversation(activeId, messageId); await refreshConversations(); setActiveId(branch.id) }} onCancel={async () => { if (activeRun) await api.cancelRun(activeRun) }} onConfirm={async () => { if (pendingPayload && pendingPlan) await submitTurn(pendingPayload, pendingPlan, pendingPlan.findings.map((item) => item.id)) }} onFeedback={api.setFeedback} onModel={setSelectedModel} onSanitize={async () => { if (!pendingPayload) return; const sanitized = await api.sanitize(pendingPayload.content); setPendingPlan(null); setPendingPayload(null); await send(sanitized.content) }} onSaveMemories={saveMemoriesAndClose} onSend={send} onUpload={async (file) => { await upload(file, true) }} pendingPlan={pendingPlan} plan={plan} running={Boolean(activeRun)} savingMemories={savingMemories} selectedModel={selectedModel} uploads={uploads} />}
        {page === 'Compare' && <ComparePage models={models} />}
        {page === 'Context' && <ContextPage backpacks={backpacks} onCreate={async (name, title, content) => { await api.createBackpack(name, title, content); setBackpacks(await api.backpacks()) }} plan={plan} />}
        {page === 'Evidence' && <EvidencePage activity={activity} excluded={excludedSources} onToggle={(id) => setExcludedSources((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })} plan={plan} />}
        {page === 'Replay' && <ReplayPage activity={activity} models={models} onReplay={async (run) => { const model = models[0]; if (!model) return; const replay = await api.replay(run.id, model.provider, model.id); await streamRun(replay.id, () => {}); setActivity(await api.activity()) }} />}
        {page === 'Focus' && <FocusPage conversationId={activeId} onCreate={async (objective, criteria, constraints) => { if (!activeId) return; await api.createFocus({ conversation_id: activeId, objective, success_criteria: criteria, constraints }); setPage('Chat') }} />}
        {page === 'Providers' && <ProvidersPage onChanged={refreshProviders} providers={providers} />}
        {page === 'Library' && <LibraryPage conversationId={activeId} memories={memories} onMemory={async (content) => { await api.createMemory(content); setMemories(await api.memories()) }} onMemoryDelete={async (id) => { await api.deleteMemory(id); setMemories(await api.memories()) }} onMemoryUpdate={async (id, payload) => { await api.updateMemory(id, payload); setMemories(await api.memories()) }} onPreset={async (name, prompt) => { await api.createPreset({ name, system_prompt: prompt, model_key: selectedModel, temperature: 0.7 }); setPresets(await api.presets()) }} onPresetDelete={async (id) => { await api.deletePreset(id); setPresets(await api.presets()) }} onUpload={async (file) => { await upload(file) }} presets={presets} uploads={uploads} />}
        {page === 'Settings' && <SettingsPage connected={connected} onRefresh={async () => { await Promise.all([refreshConversations(), refreshLibrary()]) }} />}
      </div>
    </TooltipProvider>
  )
}

export default App
