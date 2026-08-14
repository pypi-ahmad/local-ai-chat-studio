import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, useLocation, useNavigate } from 'react-router'
import {
  Backpack,
  Brain,
  CheckCircle,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  CirclePlus,
  Code2,
  Command,
  Copy,
  Download,
  FileText,
  FileUp,
  Focus,
  GitBranch,
  GitCompareArrows,
  Library,
  LoaderCircle,
  MessageSquare,
  MoreHorizontal,
  PanelLeft,
  PanelRightOpen,
  Paperclip,
  Play,
  PlugZap,
  Power,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Square,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TriangleAlert,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MarkdownContent } from '@/components/MarkdownContent'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Surface } from '@/components/shared/Surface'
import { fileAsBase64 } from '@/features/attachments/fileEncoding'
import { readFavoriteAssistants, readRecentAssistants, writeFavoriteAssistants, writeRecentAssistants } from '@/features/assistants/assistantPreferences'
import { contextLengthLabel, formatUsd, hasTools, hasVision, modelKey, modelSearchText, pricingLabel, providerMonogram } from '@/features/models/modelMetadata'
import { readFavoriteModels, readRecentModels, writeFavoriteModels, writeRecentModels } from '@/features/models/modelPreferences'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { readStoredBoolean, writeStoredBoolean } from '@/state/uiPreferences'
import { RouteErrorBoundary } from '@/app/RouteErrorBoundary'
import { pathForPage, routeFromPath, type Page, type WorkspaceRoute } from '@/app/routes'

import {
  ApiError,
  api,
  streamRun,
  type Backpack as BackpackRecord,
  type ContextPlan,
  type Conversation,
  type ConversationExportFormat,
  type ConversationSettings,
  type Memory,
  type ModelSummary,
  type OpenCodeAuthMethod,
  type Preset,
  type ProviderPolicy,
  type ProviderSummary,
  type ReasoningEffort,
  type RunSnapshot,
  type TurnPreflight,
  type Upload,
} from './api/client'

const navigationGroups: ReadonlyArray<{ label: string; items: ReadonlyArray<readonly [Page, typeof MessageSquare]> }> = [
  { label: 'Primary', items: [['Chat', MessageSquare], ['Compare', GitCompareArrows], ['Library', Library]] },
  { label: 'Workspace', items: [['Focus', Focus]] },
  { label: 'Administration', items: [['Providers', PlugZap], ['Settings', Settings]] },
]

type InspectorTab = 'context' | 'evidence'
type ContextMode = 'full' | 'chat' | 'files'
type ComposerSettings = { contextMode: ContextMode; temperature: number; includeWeb: boolean; autoCompressHistory: boolean }
type ConversationLayout = ConversationSettings['layout']
type ChatExportFormat = ConversationExportFormat | 'bundle'

const defaultConversationSettings: ConversationSettings = {
  model_key: '',
  reasoning_effort: null,
  temperature: 0.7,
  context_policy: 'full',
  include_web: false,
  auto_compress_history: false,
  system_prompt: '',
  layout: 'conversation',
}

type AttachmentStage = 'uploading' | 'processing'

type AttachmentAttempt = {
  id: string
  file: File
  status: AttachmentStage | 'error'
  error?: string
}

const fileTypeLabel = (filename: string, mime = '') => {
  const extension = filename.includes('.') ? filename.split('.').pop()?.toUpperCase() : ''
  if (extension) return extension
  if (mime.startsWith('image/')) return 'IMAGE'
  if (mime.startsWith('text/')) return 'TEXT'
  return 'FILE'
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function readInspectorTab() {
  try {
    return localStorage.getItem('chat-studio.inspector-tab') === 'evidence' ? 'evidence' : 'context'
  } catch {
    return 'context'
  }
}

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

function Navigation({ page, onPage, connected, collapsed, onCollapsed }: { page: Page; onPage: (page: Page) => void; connected: boolean; collapsed: boolean; onCollapsed: (collapsed: boolean) => void }) {
  const mobile = useMediaQuery('(max-width: 820px)')
  const [moreOpen, setMoreOpen] = useState(false)
  const mobilePages: Page[] = ['Chat', 'Compare', 'Library']
  const hiddenPageActive = !mobilePages.includes(page)

  if (mobile) {
    return (
      <>
        <nav aria-label="Primary navigation" className="mobile-bottom-nav">
          {navigationGroups.flatMap((group) => group.items).filter(([label]) => mobilePages.includes(label)).map(([label, Icon]) => (
            <button aria-current={page === label ? 'page' : undefined} className="mobile-nav-button" key={label} onClick={() => onPage(label)} type="button"><Icon /><span>{label}</span></button>
          ))}
          <button aria-current={hiddenPageActive ? 'page' : undefined} aria-expanded={moreOpen} className="mobile-nav-button" onClick={() => setMoreOpen(true)} type="button"><MoreHorizontal /><span>More</span></button>
        </nav>
        <Sheet onOpenChange={setMoreOpen} open={moreOpen}>
          <SheetContent className="more-navigation-sheet" side="left">
            <SheetHeader><SheetTitle>Navigate</SheetTitle><SheetDescription>Open another Studio workspace.</SheetDescription></SheetHeader>
            <nav aria-label="More navigation" className="more-navigation">
              {navigationGroups.map((group) => {
                const items = group.items.filter(([label]) => !mobilePages.includes(label))
                if (!items.length) return null
                const groupId = `more-navigation-${group.label.toLowerCase()}`
                return <div aria-labelledby={groupId} className="more-navigation-group" key={group.label} role="group"><p id={groupId}>{group.label}</p>{items.map(([label, Icon]) => <button aria-current={page === label ? 'page' : undefined} key={label} onClick={() => { onPage(label); setMoreOpen(false) }} type="button"><Icon /><span>{label}</span></button>)}</div>
              })}
            </nav>
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <nav aria-label="Primary navigation" className={collapsed ? 'nav-rail collapsed' : 'nav-rail expanded'}>
      <div className="nav-brand"><div className="brand-mark" aria-label="Local AI Chat Studio"><Command /></div><div className="nav-brand-copy"><strong>Chat Studio</strong><small>Local AI workspace</small></div></div>
      <div className="nav-items">
        {navigationGroups.map((group) => {
          const groupId = `primary-navigation-${group.label.toLowerCase()}`
          return (
          <div aria-labelledby={groupId} className="nav-group" key={group.label} role="group">
            <p className="nav-group-label" id={groupId}>{group.label}</p>
            {group.items.map(([label, Icon]) => (
              <Button key={label} aria-label={label} aria-current={page === label ? 'page' : undefined} className="nav-button" onClick={() => onPage(label)} title={collapsed ? label : undefined} variant={page === label ? 'secondary' : 'ghost'}><Icon /><span className="nav-label">{label}</span></Button>
            ))}
          </div>
        )})}
      </div>
      <div className="nav-footer"><span className={connected ? 'status-dot' : 'status-dot offline'} /><span>{connected ? 'Backend connected' : 'Backend unavailable'}</span></div>
      <Button aria-expanded={!collapsed} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} className="nav-collapse" onClick={() => onCollapsed(!collapsed)} size="icon-sm" variant="ghost">{collapsed ? <ChevronRight /> : <ChevronLeft />}</Button>
    </nav>
  )
}

function downloadFile(content: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function ConversationHistory({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  mobile = false,
}: {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onUpdate: (id: string, payload: { title?: string; pinned?: boolean }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  mobile?: boolean
}) {
  const [query, setQuery] = useState('')
  const visible = conversations.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))
  return (
    <aside aria-label="Conversation history" className={mobile ? 'history-pane mobile-history' : 'history-pane'}>
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

function ContextRail({ plan, model }: { plan: ContextPlan | null; model?: ModelSummary }) {
  if (!plan) return <div className="context-rail empty"><span>Context preflight appears here</span></div>
  const percent = Math.round((plan.estimated_tokens / plan.budget_tokens) * 100)
  const remainingTokens = plan.budget_tokens - plan.estimated_tokens
  const state = remainingTokens < 0 ? 'overflow' : percent >= 80 ? 'warning' : 'safe'
  const estimatedInputCost = model?.pricing ? (plan.estimated_tokens / 1_000_000) * model.pricing.input_per_million : null
  const warning = state === 'overflow'
    ? `Context exceeds the safe input budget by ${Math.abs(remainingTokens).toLocaleString()} tokens. Remove sources or choose a larger-context model before sending.`
    : state === 'warning'
      ? `Only ${remainingTokens.toLocaleString()} tokens remain. Remove optional sources or choose a larger-context model.`
      : ''
  return (
    <div className={`context-rail ${state}`} aria-label="Context budget">
      <div className="rail-copy"><span>{plan.estimated_tokens.toLocaleString()} / {plan.budget_tokens.toLocaleString()} tokens{estimatedInputCost !== null ? ` · est. input ${formatUsd(estimatedInputCost)}` : ''}</span><strong>{percent}% of safe budget</strong></div>
      <div aria-label={`${percent}% of safe context budget used`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.min(100, percent)} className="rail-track" role="progressbar">
        <div className="rail-fill" style={{ width: `${Math.min(100, percent)}%` }}>
          {plan.sections.filter((section) => section.included && section.estimated_tokens).map((section) => (
            <span key={section.kind} style={{ flexGrow: Math.max(1, section.estimated_tokens) }} title={`${section.kind}: ${section.estimated_tokens}`} />
          ))}
        </div>
      </div>
      {plan.compression_applied && <div className="compression-status" role="status"><CheckCircle /><span>{plan.compressed_message_count} older messages compressed</span></div>}
      {warning && <div className="context-warning" role="alert"><TriangleAlert /><span>{warning}</span></div>}
    </div>
  )
}

type ModelCapabilityFilter = 'all' | 'vision' | 'reasoning' | 'tools'

function ProviderMark({ id, label }: { id: string; label: string }) {
  return <span aria-label={`${label} provider`} className={`provider-mark provider-${id}`}>{providerMonogram(id)}</span>
}

function ProviderModelPicker({
  models,
  providers,
  value,
  onChange,
  providerLabel = 'Provider',
  modelLabel = 'Model',
  disabled = false,
  excludedKeys = new Set<string>(),
}: {
  models: ModelSummary[]
  providers: ProviderSummary[]
  value: string
  onChange: (value: string) => void
  providerLabel?: string
  modelLabel?: string
  disabled?: boolean
  excludedKeys?: Set<string>
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [capability, setCapability] = useState<ModelCapabilityFilter>('all')
  const [favoriteModels, setFavoriteModels] = useState<string[]>(readFavoriteModels)
  const [recentModels, setRecentModels] = useState<string[]>(readRecentModels)
  const selected = models.find((model) => modelKey(model) === value)
  const providerIds = [...new Set(models.map((model) => model.provider))]
  const selectedProvider = selected?.provider ?? providerIds[0] ?? ''
  const availableModels = models.filter((model) => model.provider === selectedProvider && (!excludedKeys.has(modelKey(model)) || modelKey(model) === value))
  const displayedModel = selected?.provider === selectedProvider ? selected : availableModels[0]
  const providerName = (id: string) => providers.find((provider) => provider.id === id)?.label ?? ({ openai: 'OpenAI', agnes: 'Agnes', anthropic: 'Anthropic', google: 'Google', openrouter: 'OpenRouter', xai: 'xAI' }[id] ?? id)
  const normalizedQuery = query.trim().toLowerCase()
  const visibleModels = availableModels.filter((model) => {
    if (capability === 'vision' && !hasVision(model)) return false
    if (capability === 'reasoning' && !model.reasoning_efforts?.length) return false
    if (capability === 'tools' && !hasTools(model)) return false
    return !normalizedQuery || modelSearchText(model).includes(normalizedQuery)
  })
  const favoriteSet = new Set(favoriteModels)
  const recentSet = new Set(recentModels)
  const favoriteOptions = visibleModels.filter((model) => favoriteSet.has(modelKey(model)))
  const recentOptions = visibleModels.filter((model) => recentSet.has(modelKey(model)) && !favoriteSet.has(modelKey(model)))
  const otherOptions = visibleModels.filter((model) => !favoriteSet.has(modelKey(model)) && !recentSet.has(modelKey(model)))

  useEffect(() => writeFavoriteModels(favoriteModels), [favoriteModels])
  useEffect(() => writeRecentModels(recentModels), [recentModels])

  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (!next) { setQuery(''); setCapability('all') }
  }

  const selectModel = (key: string) => {
    setRecentModels((current) => [key, ...current.filter((item) => item !== key)].slice(0, 6))
    onChange(key)
    changeOpen(false)
  }

  const toggleFavorite = (key: string) => setFavoriteModels((current) => current.includes(key) ? current.filter((item) => item !== key) : [key, ...current])

  const renderOption = (model: ModelSummary) => {
    const key = modelKey(model)
    const current = key === value
    const favorite = favoriteSet.has(key)
    const label = model.label || model.id
    return <div aria-selected={current} className="model-option" key={key} onClick={() => selectModel(key)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectModel(key) } }} role="option" tabIndex={0}><div className="model-option-main"><ProviderMark id={model.provider} label={providerName(model.provider)} /><div className="model-option-copy"><div className="model-option-title"><div><strong>{label}</strong><code>{model.id}</code></div>{current && <CheckCircle />}</div><div className="model-capabilities"><span>{contextLengthLabel(model.context_length)}</span>{hasVision(model) && <span>Vision</span>}{hasTools(model) && <span>Tools</span>}{Boolean(model.reasoning_efforts?.length) && <span>Reasoning · {model.reasoning_efforts?.length} levels</span>}</div><small>{pricingLabel(model)}</small></div><button aria-label={`${favorite ? 'Remove' : 'Add'} ${label} ${favorite ? 'from' : 'to'} favorites`} aria-pressed={favorite} className="model-favorite" onClick={(event) => { event.stopPropagation(); toggleFavorite(key) }} type="button"><Star fill={favorite ? 'currentColor' : 'none'} /></button></div></div>
  }

  return (
    <div className="provider-model-picker">
      <label><span>{providerLabel}</span><select aria-label={providerLabel} disabled={disabled || !providerIds.length} onChange={(event) => {
        const next = models.find((model) => model.provider === event.target.value && !excludedKeys.has(modelKey(model)))
        if (next) onChange(modelKey(next))
      }} value={selectedProvider}>
        {!providerIds.length && <option value="">No providers available</option>}
        {providerIds.map((provider) => <option disabled={!models.some((model) => model.provider === provider && (!excludedKeys.has(modelKey(model)) || modelKey(model) === value))} key={provider} value={provider}>{providerName(provider)}</option>)}
      </select></label>
      <label><span>{modelLabel}</span><button aria-expanded={open} aria-haspopup="dialog" aria-label={modelLabel} className="model-picker-trigger" disabled={disabled || !availableModels.length} onClick={() => setOpen(true)} role="combobox" type="button">{displayedModel && <ProviderMark id={displayedModel.provider} label={providerName(displayedModel.provider)} />}<span><strong>{displayedModel?.label || displayedModel?.id || 'No models available'}</strong>{displayedModel && <small>{displayedModel.id}</small>}</span><ChevronDown /></button></label>
      <Dialog onOpenChange={changeOpen} open={open}>
        <DialogContent className="model-picker-dialog">
          <DialogHeader><DialogTitle>{providerName(selectedProvider)} models</DialogTitle><DialogDescription>Search discovered models and compare the capabilities relevant to this task.</DialogDescription></DialogHeader>
          <div className="model-search-wrap"><Search /><Input aria-label={`Search ${modelLabel.toLowerCase()}`} autoFocus onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, ID, or capability" value={query} /></div>
          <div aria-label="Model capability filter" className="model-capability-filters">{(['all', 'vision', 'reasoning', 'tools'] as const).map((filter) => <button aria-pressed={capability === filter} key={filter} onClick={() => setCapability(filter)} type="button">{filter === 'all' ? 'All models' : filter}</button>)}</div>
          <div aria-label={`${modelLabel} options`} className="model-option-list" role="listbox">
            {favoriteOptions.length > 0 && <div aria-label="Favorites" className="model-option-section" role="group"><p>Favorites</p>{favoriteOptions.map(renderOption)}</div>}
            {recentOptions.length > 0 && <div aria-label="Recent" className="model-option-section" role="group"><p>Recent</p>{recentOptions.map(renderOption)}</div>}
            {otherOptions.length > 0 && <div aria-label={favoriteOptions.length || recentOptions.length ? 'All models' : 'Available models'} className="model-option-section" role="group"><p>{favoriteOptions.length || recentOptions.length ? 'All models' : 'Available models'}</p>{otherOptions.map(renderOption)}</div>}
            {!visibleModels.length && <div className="model-picker-empty"><Search /><strong>No matching models</strong><span>Change the search or capability filter.</span></div>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ContextPlanSummary({ plan }: { plan: ContextPlan | null }) {
  if (!plan) return <p className="muted">Send a message to build a context plan.</p>
  return <div className="stack-list context-section-list">{plan.sections.map((section) => <div className="data-row" key={section.kind}><div><strong>{section.kind}</strong>{section.reason && <small>{section.reason}</small>}</div><Badge variant={section.included ? 'default' : 'outline'}>{section.included ? `${section.estimated_tokens.toLocaleString()} tokens` : 'excluded'}</Badge></div>)}</div>
}

function EvidenceSourceList({ plan, excluded, onToggle }: { plan: ContextPlan | null; excluded: Set<string>; onToggle: (id: string) => void }) {
  if (!plan?.sources.length) return <p className="muted">No evidence sources are available for the current plan.</p>
  return <div className="stack-list">{plan.sources.map((source) => <div className="source-card" key={source.id}><div><strong>{source.title}</strong><small>{source.kind} · {source.estimated_tokens.toLocaleString()} tokens</small></div><Badge variant={source.trust === 'trusted' ? 'outline' : 'destructive'}>{source.trust}</Badge><p>{source.preview}</p><label><input checked={!excluded.has(source.id)} disabled={source.trust !== 'trusted'} onChange={() => onToggle(source.id)} type="checkbox" /> Include in next send</label>{source.url && <a href={source.url} rel="noreferrer" target="_blank">Open source</a>}</div>)}</div>
}

function ContextEvidenceInspector({ plan, excluded, onToggle, tab, onTab, onClose, onPage }: { plan: ContextPlan | null; excluded: Set<string>; onToggle: (id: string) => void; tab: InspectorTab; onTab: (tab: InspectorTab) => void; onClose: () => void; onPage: (page: Page) => void }) {
  const openPage = (page: Page) => { onClose(); onPage(page) }
  return (
    <aside aria-label="Context and evidence inspector" className="context-inspector" id="context-evidence-inspector">
      <header className="inspector-header"><div><p className="eyebrow">Prompt trail</p><h2>Inspector</h2></div><Button aria-label="Close inspector" onClick={onClose} size="icon-sm" variant="ghost"><ChevronRight /></Button></header>
      <Tabs className="inspector-tabs" onValueChange={(value) => onTab(value as InspectorTab)} value={tab}>
        <TabsList><TabsTrigger value="context"><Brain /> Context</TabsTrigger><TabsTrigger value="evidence"><ShieldCheck /> Evidence</TabsTrigger></TabsList>
        <ScrollArea className="inspector-scroll">
          <TabsContent value="context"><div className="inspector-content"><ContextRail plan={plan} /><ContextPlanSummary plan={plan} /><Button onClick={() => openPage('Context')} variant="outline">Open full Context page</Button></div></TabsContent>
          <TabsContent value="evidence"><div className="inspector-content"><EvidenceSourceList excluded={excluded} onToggle={onToggle} plan={plan} /><Button onClick={() => openPage('Evidence')} variant="outline">Open full Evidence page</Button></div></TabsContent>
        </ScrollArea>
      </Tabs>
    </aside>
  )
}

function ChatWorkspace({
  conversation,
  models,
  providers,
  selectedModel,
  onModel,
  reasoningEffort,
  onReasoningEffort,
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
  onRemoveUpload,
  uploads,
  attachmentIds,
  onAttachment,
  onSaveMemories,
  savingMemories,
  onBranch,
  onFeedback,
  onHistory,
  inspectorOpen,
  onInspector,
  onRuns,
  onExport,
  canExportBundle,
  composerSettings,
  onComposerSettings,
  systemPrompt,
  onSystemPrompt,
  layout,
  onLayout,
}: {
  conversation: Conversation | null
  models: ModelSummary[]
  providers: ProviderSummary[]
  selectedModel: string
  onModel: (value: string) => void
  reasoningEffort: ReasoningEffort | ''
  onReasoningEffort: (value: ReasoningEffort | '') => void
  plan: ContextPlan | null
  pendingPlan: ContextPlan | null
  liveOutput: string
  running: boolean
  error: string
  onSend: (content: string) => Promise<boolean>
  onConfirm: () => Promise<void>
  onSanitize: () => Promise<void>
  onCancel: () => Promise<void>
  onUpload: (file: File, onStage: (stage: AttachmentStage) => void) => Promise<void>
  onRemoveUpload: (id: string) => Promise<void>
  uploads: Upload[]
  attachmentIds: Set<string>
  onAttachment: (id: string) => void
  onSaveMemories: () => Promise<void>
  savingMemories: boolean
  onBranch: (messageId: string) => Promise<void>
  onFeedback: (messageId: string, rating: -1 | 1) => Promise<void>
  onHistory: () => void
  inspectorOpen: boolean
  onInspector: () => void
  onRuns: () => void
  onExport: (format: ChatExportFormat) => Promise<void>
  canExportBundle: boolean
  composerSettings: ComposerSettings
  onComposerSettings: (settings: ComposerSettings) => void
  systemPrompt: string
  onSystemPrompt: (value: string) => void
  layout: ConversationLayout
  onLayout: (value: ConversationLayout) => void
}) {
  const [prompt, setPrompt] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [systemPromptDraft, setSystemPromptDraft] = useState(systemPrompt)
  const [layoutDraft, setLayoutDraft] = useState<ConversationLayout>(layout)
  const [attachmentAttempts, setAttachmentAttempts] = useState<AttachmentAttempt[]>([])
  const [messageIndex, setMessageIndex] = useState(0)
  const [atTranscriptEnd, setAtTranscriptEnd] = useState(true)
  const [unreadOutput, setUnreadOutput] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const messageRefs = useRef(new Map<string, HTMLElement>())
  const messageRegionRef = useRef<HTMLDivElement>(null)
  const liveMessageRef = useRef<HTMLElement>(null)
  const atTranscriptEndRef = useRef(true)
  const previousConversationId = useRef<string | undefined>(undefined)
  const previousLiveOutput = useRef('')
  const selected = models.find((model) => `${model.provider}::${model.id}` === selectedModel)
  const messages = conversation?.messages ?? []
  const lastMessageId = messages.at(-1)?.id
  useLayoutEffect(() => {
    const changedConversation = previousConversationId.current !== conversation?.id
    previousConversationId.current = conversation?.id
    if (changedConversation) {
      atTranscriptEndRef.current = true
      setAtTranscriptEnd(true)
      setUnreadOutput(false)
      messageRefs.current.get(lastMessageId ?? '')?.scrollIntoView({ behavior: 'auto', block: 'end' })
    }
    if (changedConversation || atTranscriptEndRef.current) setMessageIndex(Math.max(0, messages.length - 1))
  }, [conversation?.id, lastMessageId, messages.length])
  useEffect(() => {
    const viewport = messageRegionRef.current?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')
    if (!viewport) return
    const trackPosition = () => {
      if (!viewport.scrollHeight && !viewport.clientHeight) return
      const atEnd = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 32
      atTranscriptEndRef.current = atEnd
      setAtTranscriptEnd(atEnd)
      if (atEnd) {
        setUnreadOutput(false)
        setMessageIndex(Math.max(0, messages.length - 1))
      }
    }
    viewport.addEventListener('scroll', trackPosition, { passive: true })
    trackPosition()
    return () => viewport.removeEventListener('scroll', trackPosition)
  }, [conversation?.id, messages.length])
  useEffect(() => {
    const receivedOutput = liveOutput.length > previousLiveOutput.current.length
    previousLiveOutput.current = liveOutput
    if (!receivedOutput) return
    if (atTranscriptEndRef.current) liveMessageRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
    else setUnreadOutput(true)
  }, [liveOutput])
  useEffect(() => {
    if (settingsOpen) return
    setSystemPromptDraft(systemPrompt)
    setLayoutDraft(layout)
  }, [layout, settingsOpen, systemPrompt])
  const submit = async () => {
    if (!prompt.trim()) return
    if (await onSend(prompt.trim())) setPrompt('')
  }
  const uploadAttachment = async (attempt: AttachmentAttempt) => {
    setAttachmentAttempts((current) => current.map((item) => item.id === attempt.id ? { ...item, status: 'uploading', error: undefined } : item))
    try {
      await onUpload(attempt.file, (status) => setAttachmentAttempts((current) => current.map((item) => item.id === attempt.id ? { ...item, status } : item)))
      setAttachmentAttempts((current) => current.filter((item) => item.id !== attempt.id))
    } catch (cause) {
      setAttachmentAttempts((current) => current.map((item) => item.id === attempt.id ? { ...item, status: 'error', error: messageOf(cause) } : item))
    }
  }
  const addAttachment = (file: File) => {
    const attempt: AttachmentAttempt = { id: `${Date.now()}-${file.name}`, file, status: 'uploading' }
    setAttachmentAttempts((current) => [...current, attempt])
    void uploadAttachment(attempt)
  }
  const navigateMessage = (nextIndex: number, block: ScrollLogicalPosition = 'center') => {
    const boundedIndex = Math.max(0, Math.min(messages.length - 1, nextIndex))
    atTranscriptEndRef.current = false
    setAtTranscriptEnd(false)
    setMessageIndex(boundedIndex)
    messageRefs.current.get(messages[boundedIndex]?.id)?.scrollIntoView({ behavior: 'smooth', block })
  }
  const jumpToBottom = () => {
    const finalIndex = Math.max(0, messages.length - 1)
    atTranscriptEndRef.current = true
    setAtTranscriptEnd(true)
    setUnreadOutput(false)
    setMessageIndex(finalIndex)
    const target = liveMessageRef.current ?? messageRefs.current.get(messages[finalIndex]?.id)
    target?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }
  const changeSettingsOpen = (open: boolean) => {
    setSettingsOpen(open)
  }
  const saveConversationSettings = () => {
    onSystemPrompt(systemPromptDraft)
    onLayout(layoutDraft)
    setSettingsOpen(false)
  }
  return (
    <main aria-label="Chat workspace" className={`workspace layout-${layout}`}>
      <header className="workspace-header">
        <Button aria-label="Open conversation history" className="mobile-history-trigger" onClick={onHistory} size="icon" variant="ghost"><PanelLeft /></Button>
        <div className="workspace-title"><p className="eyebrow">Conversation</p><h2>{conversation?.title ?? 'New conversation'}</h2>{selected?.pricing && <small>Estimated pricing: {pricingLabel(selected)} · <a href={selected.pricing.source_url} rel="noreferrer" target="_blank">official source</a></small>}</div>
        <div className="action-row"><Button aria-expanded={settingsOpen} aria-label="Conversation settings" onClick={() => changeSettingsOpen(true)} variant="outline"><Settings /> Settings</Button><DropdownMenu><DropdownMenuTrigger aria-label="Export conversation" disabled={!conversation} render={<Button variant="outline" />}><Download /> Export</DropdownMenuTrigger><DropdownMenuContent align="end" className="conversation-export-menu"><DropdownMenuGroup><DropdownMenuLabel>Conversation</DropdownMenuLabel><DropdownMenuItem onClick={() => void onExport('markdown')}><FileText /> Markdown (.md)</DropdownMenuItem><DropdownMenuItem onClick={() => void onExport('html')}><Code2 /> HTML (.html)</DropdownMenuItem><DropdownMenuItem onClick={() => void onExport('txt')}><FileText /> Plain text (.txt)</DropdownMenuItem><DropdownMenuItem onClick={() => void onExport('json')}><Code2 /> JSON (.json)</DropdownMenuItem></DropdownMenuGroup><DropdownMenuSeparator /><DropdownMenuGroup><DropdownMenuLabel>Latest completed run</DropdownMenuLabel><DropdownMenuItem disabled={!canExportBundle} onClick={() => void onExport('bundle')}><Download /> Reproducibility bundle (.json)</DropdownMenuItem></DropdownMenuGroup></DropdownMenuContent></DropdownMenu><Button aria-label="Open runs" onClick={onRuns} variant="outline"><RotateCcw /> Runs</Button><Button aria-controls="context-evidence-inspector" aria-expanded={inspectorOpen} aria-label={`${inspectorOpen ? 'Close' : 'Open'} context and evidence inspector`} onClick={onInspector} variant={inspectorOpen ? 'secondary' : 'outline'}><PanelRightOpen /> Inspector</Button><Button disabled={!conversation?.messages.length || savingMemories || !selectedModel} onClick={onSaveMemories} variant="outline"><Brain /> {savingMemories ? 'Saving…' : 'Save memories & close'}</Button></div>
      </header>
      <ContextRail model={selected} plan={plan} />
      <div className="message-region" ref={messageRegionRef}><ScrollArea className="message-area">
        <div className={`messages layout-${layout}`}>
          {!conversation?.messages.length && !liveOutput && (
            <div className="welcome"><div className="signal-mark">LOCAL / CONTEXT / CONTROL</div><h3>Work with the whole trail visible.</h3><p>Inspect what enters the prompt, keep private context local, and replay any answer.</p></div>
          )}
          {messages.map((message, index) => (
            <article className={`message ${message.role}${index === messageIndex && messages.length > 1 ? ' navigation-target' : ''}`} key={message.id} ref={(node) => { if (node) messageRefs.current.set(message.id, node); else messageRefs.current.delete(message.id) }}>
              <div className="message-label"><span>{message.role === 'user' ? 'You' : 'Assistant'}</span>{message.run_id && <Badge variant="outline">evidence saved</Badge>}</div>
              <MarkdownContent content={message.content} />
              <div className="message-actions">
                <Button onClick={() => navigator.clipboard.writeText(message.content)} size="sm" variant="ghost"><Copy /> Copy</Button>
                <Button onClick={() => onBranch(message.id)} size="sm" variant="ghost"><GitBranch /> Branch here</Button>
                {message.role === 'assistant' && <><Button aria-label="Helpful" onClick={() => onFeedback(message.id, 1)} size="icon-sm" variant="ghost"><ThumbsUp /></Button><Button aria-label="Not helpful" onClick={() => onFeedback(message.id, -1)} size="icon-sm" variant="ghost"><ThumbsDown /></Button></>}
              </div>
            </article>
          ))}
          {liveOutput && <article className="message assistant live" ref={liveMessageRef}><div className="message-label"><span>Assistant</span><Badge>streaming</Badge></div><MarkdownContent content={liveOutput} /></article>}
        </div>
      </ScrollArea>{(messages.length > 0 || liveOutput) && <nav aria-label="Message navigation" className={unreadOutput ? 'message-navigator has-unread' : 'message-navigator'}>
        {unreadOutput && <span aria-label="Unread output" className="message-unread" role="status">New output</span>}
        <Button aria-label="Jump to top" disabled={!messages.length || messageIndex === 0} onClick={() => navigateMessage(0, 'start')} size="icon-sm" variant="ghost"><ChevronsUp /></Button>
        <Button aria-label="Previous message" disabled={!messages.length || messageIndex === 0} onClick={() => navigateMessage(messageIndex - 1)} size="icon-sm" variant="ghost"><ChevronUp /></Button>
        <span aria-live="polite" className="message-position">{messages.length ? `${messageIndex + 1} / ${messages.length}` : 'Live'}</span>
        <Button aria-label="Next message" disabled={!messages.length || messageIndex === messages.length - 1} onClick={() => navigateMessage(messageIndex + 1)} size="icon-sm" variant="ghost"><ChevronDown /></Button>
        <Button aria-label={unreadOutput ? 'Jump to bottom, new output available' : 'Jump to bottom'} className={unreadOutput ? 'unread-target' : undefined} disabled={atTranscriptEnd && !unreadOutput} onClick={jumpToBottom} size="icon-sm" variant="ghost"><ChevronsDown /></Button>
      </nav>}</div>
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
        {(attachmentAttempts.length > 0 || uploads.length > 0) && <div className="attachment-tray" aria-label="Conversation attachments">
          {attachmentAttempts.map((attempt) => <div aria-live="polite" className={`attachment-card ${attempt.status}`} key={attempt.id}>
            <div className="attachment-icon">{attempt.status === 'error' ? <XCircle /> : <LoaderCircle />}</div>
            <div className="attachment-copy"><strong>{attempt.file.name}</strong><small className="attachment-meta">{fileTypeLabel(attempt.file.name, attempt.file.type)} · {formatFileSize(attempt.file.size)}</small><small className="attachment-status">{attempt.status === 'uploading' ? 'Uploading' : attempt.status === 'processing' ? 'Parsing & indexing' : attempt.error || 'Upload failed'}</small>{attempt.status !== 'error' && <span aria-label={attempt.status === 'processing' ? `Parsing and indexing ${attempt.file.name}` : `Uploading ${attempt.file.name}`} className="attachment-progress" role="progressbar"><i /></span>}</div>
            {attempt.status === 'error' && <div className="attachment-actions"><Button aria-label={`Retry ${attempt.file.name}`} onClick={() => void uploadAttachment(attempt)} size="icon-sm" variant="ghost"><RefreshCw /></Button><Button aria-label={`Remove ${attempt.file.name}`} onClick={() => setAttachmentAttempts((current) => current.filter((item) => item.id !== attempt.id))} size="icon-sm" variant="ghost"><Trash2 /></Button></div>}
          </div>)}
          {uploads.map((upload) => <div className={attachmentIds.has(upload.id) ? 'attachment-card ready selected' : 'attachment-card ready'} key={upload.id}><button aria-label={`${attachmentIds.has(upload.id) ? 'Exclude' : 'Include'} ${upload.filename}`} aria-pressed={attachmentIds.has(upload.id)} className="attachment-select" onClick={() => onAttachment(upload.id)} type="button"><div className="attachment-icon"><FileText /></div><div className="attachment-copy"><strong>{upload.filename}</strong><small className="attachment-meta">{fileTypeLabel(upload.filename, upload.mime)} · {formatFileSize(upload.size)}</small><small className="attachment-status">{attachmentIds.has(upload.id) ? 'Ready · included in next message' : 'Ready · click to include'}</small></div><CheckCircle /></button><div className="attachment-actions"><Button aria-label={`Remove ${upload.filename}`} onClick={() => void onRemoveUpload(upload.id)} size="icon-sm" variant="ghost"><Trash2 /></Button></div></div>)}
        </div>}
        <div aria-label="Composer controls" className="composer-control-dock" role="toolbar">
          <input
            accept=".pdf,.txt,.md,.csv,.docx,.doc,.xlsx,.xls,.json,.py,.png,.jpg,.jpeg,.webp"
            aria-label="Attachment upload"
            hidden
            onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) addAttachment(file) }}
            ref={fileRef}
            type="file"
          />
          <Button aria-label="Attach file" className="composer-attach" onClick={() => fileRef.current?.click()} size="icon-sm" variant="ghost"><Paperclip /></Button>
          <ProviderModelPicker models={models} onChange={onModel} providers={providers} value={selectedModel} />
          <label className="effort-picker" title="Higher reasoning effort can increase latency and billed reasoning or output usage.">
            <span>Effort</span>
            <select
              aria-label="Reasoning effort"
              disabled={!selected?.reasoning_efforts?.length}
              onChange={(event) => onReasoningEffort(event.target.value as ReasoningEffort | '')}
              value={reasoningEffort}
            >
              <option value="">{selected?.reasoning_efforts?.length ? 'Auto' : 'Provider default'}</option>
              {selected?.reasoning_efforts?.map((effort) => <option key={effort} value={effort}>{effort}</option>)}
            </select>
          </label>
          <label className="context-mode-picker" title="Choose which optional local sources may enter the next prompt.">
            <span>Context</span>
            <select aria-label="Context mode" onChange={(event) => onComposerSettings({ ...composerSettings, contextMode: event.target.value as ContextMode })} value={composerSettings.contextMode}>
              <option value="full">Full context</option>
              <option value="chat">Chat only</option>
              <option value="files">Files + chat</option>
            </select>
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More composer settings" className="composer-more-trigger"><MoreHorizontal /></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="composer-settings-menu" side="top">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Secondary settings</DropdownMenuLabel>
                <DropdownMenuCheckboxItem checked={composerSettings.autoCompressHistory} onCheckedChange={(checked) => onComposerSettings({ ...composerSettings, autoCompressHistory: checked })}>Compress older messages</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={composerSettings.includeWeb} onCheckedChange={(checked) => onComposerSettings({ ...composerSettings, includeWeb: checked })}>Web evidence</DropdownMenuCheckboxItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Temperature <span>{composerSettings.temperature.toFixed(1)}</span></DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup onValueChange={(value) => onComposerSettings({ ...composerSettings, temperature: Number(value) })} value={String(composerSettings.temperature)}>
                      <DropdownMenuRadioItem value="0.2">Precise · 0.2</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="0.7">Balanced · 0.7</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="1">Creative · 1.0</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <p className="composer-settings-hint">Enter to send · Shift+Enter for newline</p>
            </DropdownMenuContent>
          </DropdownMenu>
          {running ? <Button aria-label="Stop generation" className="composer-send" onClick={onCancel} size="icon" variant="destructive"><Square /></Button> : <Button aria-label="Send message" className="composer-send" disabled={!prompt.trim() || !selectedModel} onClick={submit} size="icon"><Send /></Button>}
        </div>
      </div>
      {settingsOpen && <div className="conversation-settings-overlay"><section aria-describedby="conversation-settings-description" aria-labelledby="conversation-settings-title" aria-modal="true" className="conversation-settings-dialog" role="dialog">
        <header><h2 id="conversation-settings-title">Conversation settings</h2><p id="conversation-settings-description">These instructions and layout apply only to this conversation.</p></header>
        <label className="conversation-setting-field"><span>System prompt</span><Textarea aria-label="System prompt" autoFocus onChange={(event) => setSystemPromptDraft(event.target.value)} placeholder="Optional instructions for this conversation" value={systemPromptDraft} /></label>
        <fieldset className="layout-options"><legend>Message layout</legend>{([
          ['conversation', 'Conversation', 'Balanced chat bubbles'],
          ['compact', 'Compact', 'Dense, full-row messages'],
          ['full-width', 'Full-width', 'Use the available reading width'],
        ] as const).map(([value, label, description]) => <button aria-label={`${label} layout`} aria-pressed={layoutDraft === value} key={value} onClick={() => setLayoutDraft(value)} type="button"><strong>{label}</strong><small>{description}</small></button>)}</fieldset>
        <div className="conversation-settings-actions"><Button onClick={() => setSettingsOpen(false)} variant="ghost">Cancel</Button><Button aria-label="Save conversation settings" onClick={saveConversationSettings}>Save settings</Button></div>
      </section></div>}
    </main>
  )
}

type ComparisonResult = {
  key: string
  output: string
  status: 'waiting' | 'starting' | 'streaming' | 'completed' | 'failed' | 'cancelled'
  error?: string
}

const comparisonModelKey = modelKey

function ComparePage({ models, providers }: { models: ModelSummary[]; providers: ProviderSummary[] }) {
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
          <div className="compare-model-field" key={`${index}-${selected}`}>
            <div className="action-row">
              <ProviderModelPicker disabled={running} excludedKeys={new Set(selectedModels.filter((_, itemIndex) => itemIndex !== index))} modelLabel={`Comparison model ${index + 1}`} models={models} onChange={(key) => replaceSelection(index, key)} providerLabel={`Comparison provider ${index + 1}`} providers={providers} value={selected} />
              {selectedModels.length > 2 && <Button aria-label={`Remove model ${index + 1}`} disabled={running} onClick={() => removeModel(index)} size="icon-sm" variant="ghost"><Trash2 /></Button>}
            </div>
          </div>
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
          return <Card key={result.key}><CardHeader><div className="comparison-title"><div><CardTitle>{model?.label || model?.id || result.key}</CardTitle><CardDescription>{model?.provider} · {model ? pricingLabel(model) : 'pricing unavailable'}</CardDescription></div><Badge variant={result.status === 'failed' ? 'destructive' : 'outline'}>{result.status}</Badge></div></CardHeader><CardContent><MarkdownContent className="comparison-markdown" content={result.error || result.output || (result.status === 'starting' ? 'Starting run…' : 'Waiting for response…')} /></CardContent></Card>
        }) : selectedTargets.map((model) => <Card key={comparisonModelKey(model)}><CardHeader><CardTitle>{model.label || model.id}</CardTitle><CardDescription>{model.provider} · {pricingLabel(model)}</CardDescription></CardHeader><CardContent><MarkdownContent className="comparison-markdown" content="Waiting for a run." /></CardContent></Card>)}
      </div>
    </Surface>
  )
}

function ContextPage({ plan, backpacks, onCreate }: { plan: ContextPlan | null; backpacks: BackpackRecord[]; onCreate: (name: string, title: string, content: string) => Promise<void> }) {
  const [name, setName] = useState('Project context')
  const [title, setTitle] = useState('Constraint')
  const [content, setContent] = useState('')
  return <Surface eyebrow="What enters the model" title="Context control" description="Budget, inspect, and carry deliberate context between conversations."><ContextRail plan={plan} /><div className="surface-grid"><Card><CardHeader><CardTitle>Current plan</CardTitle><CardDescription>Sections are estimated locally and preserve 20% for output.</CardDescription></CardHeader><CardContent><ContextPlanSummary plan={plan} /></CardContent></Card><Card><CardHeader><CardTitle>Context backpack</CardTitle><CardDescription>Pin an immutable local snapshot for reuse.</CardDescription></CardHeader><CardContent className="form-stack"><Input onChange={(event) => setName(event.target.value)} value={name} /><Input onChange={(event) => setTitle(event.target.value)} value={title} /><Textarea onChange={(event) => setContent(event.target.value)} placeholder="Context to carry" value={content} /><Button disabled={!content.trim()} onClick={async () => { await onCreate(name, title, content); setContent('') }}><Backpack /> Save backpack</Button>{backpacks.map((item) => <div className="data-row" key={item.id}><span>{item.name}</span><small>{item.items.length} items</small></div>)}</CardContent></Card></div></Surface>
}

function EvidencePage({ activity, plan, excluded, onToggle }: { activity: RunSnapshot[]; plan: ContextPlan | null; excluded: Set<string>; onToggle: (id: string) => void }) {
  return <Surface eyebrow="Why this answer" title="Evidence" description="Inspect sources, exclude individual records, and verify integrity receipts."><div className="surface-grid"><Card><CardHeader><CardTitle>Retrieved sources</CardTitle></CardHeader><CardContent><EvidenceSourceList excluded={excluded} onToggle={onToggle} plan={plan} /></CardContent></Card><Card><CardHeader><CardTitle>Integrity chain</CardTitle></CardHeader><CardContent className="stack-list">{activity.map((run) => <div className="data-row" key={run.id}><div><strong>{run.model}</strong><small>{run.status} · {String(run.metrics.elapsed_seconds ?? '—')}s</small></div><code>{run.receipt_hash?.slice(0, 12) || 'pending'}</code></div>)}</CardContent></Card></div></Surface>
}

function ReplayPage({ activity, models, providers, selectedModel, onModel, onReplay, embedded = false }: { activity: RunSnapshot[]; models: ModelSummary[]; providers: ProviderSummary[]; selectedModel: string; onModel: (value: string) => void; onReplay: (run: RunSnapshot, modelKey: string) => Promise<void>; embedded?: boolean }) {
  const [left, setLeft] = useState<string | null>(null)
  const [diff, setDiff] = useState('')
  const saveBundle = async (run: RunSnapshot, mode: 'full' | 'redacted') => { const bundle = await api.bundle(run.id, mode); const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${run.id}-${mode}.json`; anchor.click(); URL.revokeObjectURL(url) }
  const compare = async (run: RunSnapshot) => { if (!left) { setLeft(run.id); setDiff(''); return } const result = await api.diff(left, run.id); setDiff(result.diff || 'Outputs are identical.'); setLeft(null) }
  const content = <><div className="replay-target"><p className="section-label">Replay target</p><ProviderModelPicker modelLabel="Replay model" models={models} onChange={onModel} providerLabel="Replay provider" providers={providers} value={selectedModel} /></div><div className="timeline">{activity.map((run) => <Card key={run.id}><CardContent className="run-row"><div><Badge variant="outline">{run.status}</Badge><h3>{run.model}</h3><p>{run.output.slice(0, 180) || run.error || 'No output yet'}</p><small>{run.receipt_hash ? `receipt ${run.receipt_hash.slice(0, 12)}` : 'receipt pending'}</small></div><div className="inline-actions"><Button disabled={!selectedModel} onClick={() => onReplay(run, selectedModel)} variant="outline"><RotateCcw /> Replay</Button><Button onClick={() => compare(run)} variant="outline">{left ? 'Compare here' : 'Select for diff'}</Button><Button onClick={() => saveBundle(run, 'full')} size="icon-sm" variant="ghost" title="Export full local bundle"><Download /></Button><Button onClick={() => saveBundle(run, 'redacted')} size="icon-sm" variant="ghost" title="Export redacted share bundle"><ShieldCheck /></Button></div></CardContent></Card>)}{diff && <pre className="output-block">{diff}</pre>}</div></>
  if (embedded) return <section className="runs-panel"><SheetHeader><SheetTitle>Runs</SheetTitle><SheetDescription>Replay, compare, or export recorded answers.</SheetDescription></SheetHeader>{content}</section>
  return <Surface eyebrow="Prompt tape" title="Replay lab" description="Re-run a recorded prompt, compare outputs, and export full or privacy-safe bundles.">{content}</Surface>
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

function AssistantCard({ item, favorite, model, starting, onFavorite, onStart, onDelete }: {
  item: Preset; favorite: boolean; model?: ModelSummary; starting: boolean
  onFavorite: () => void; onStart: () => void; onDelete: () => void
}) {
  const copy = `${item.name} ${item.system_prompt}`.toLowerCase()
  const Icon = /code|developer|program/.test(copy) ? Code2 : /write|editor|copy/.test(copy) ? FileText : /research|analyst|evidence/.test(copy) ? Search : Sparkles
  const description = item.system_prompt.trim() || 'A reusable assistant ready for your next conversation.'
  return <Card className="assistant-card"><CardHeader><div className="assistant-card-heading"><div className="assistant-icon"><Icon aria-hidden="true" /></div><div><CardTitle>{item.name}</CardTitle><CardDescription>{model?.label || item.model_key || 'Choose a model in chat'}</CardDescription></div><Button aria-label={`${favorite ? 'Remove' : 'Add'} ${item.name} ${favorite ? 'from' : 'to'} favorites`} className={favorite ? 'assistant-favorite active' : 'assistant-favorite'} onClick={onFavorite} size="icon-sm" title={favorite ? 'Remove from favorites' : 'Add to favorites'} variant="ghost"><Star aria-hidden="true" /></Button></div></CardHeader><CardContent className="assistant-card-content"><p>{description}</p><div className="assistant-card-meta"><Badge variant="outline">{item.temperature.toFixed(1)} temperature</Badge>{model?.provider && <Badge variant="outline">{model.provider}</Badge>}</div><div className="assistant-card-actions"><Button aria-label={`Start chat with ${item.name}`} disabled={starting} onClick={onStart}>{starting ? <LoaderCircle className="spin" /> : <MessageSquare />} {starting ? 'Starting…' : 'Start chat'}</Button><Button aria-label={`Delete ${item.name}`} onClick={onDelete} size="icon-sm" title="Delete assistant" variant="ghost"><Trash2 /></Button></div></CardContent></Card>
}

function LibraryPage({
  memories, presets, uploads, conversationId, models, providers, selectedModel, onModel, onMemory, onMemoryUpdate, onMemoryDelete, onPreset, onPresetDelete, onStartAssistant, onUpload,
}: {
  memories: Memory[]; presets: Preset[]; uploads: Upload[]; conversationId: string | null
  models: ModelSummary[]; providers: ProviderSummary[]; selectedModel: string; onModel: (value: string) => void
  onMemory: (content: string) => Promise<void>; onMemoryUpdate: (id: string, payload: { status?: Memory['status']; pinned?: boolean }) => Promise<void>; onMemoryDelete: (id: string) => Promise<void>; onPreset: (name: string, prompt: string) => Promise<void>; onPresetDelete: (id: string) => Promise<void>; onStartAssistant: (preset: Preset) => Promise<void>; onUpload: (file: File) => Promise<void>
}) {
  const [memory, setMemory] = useState('')
  const [presetName, setPresetName] = useState('')
  const [presetPrompt, setPresetPrompt] = useState('')
  const [query, setQuery] = useState('')
  const [favoriteIds, setFavoriteIds] = useState(readFavoriteAssistants)
  const [recentIds, setRecentIds] = useState(readRecentAssistants)
  const [startingId, setStartingId] = useState<string | null>(null)
  const [startError, setStartError] = useState('')
  const byId = useMemo(() => new Map(presets.map((item) => [item.id, item])), [presets])
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds])
  const normalizedQuery = query.trim().toLowerCase()
  const matching = useMemo(() => presets.filter((item) => `${item.name} ${item.system_prompt} ${item.model_key}`.toLowerCase().includes(normalizedQuery)), [normalizedQuery, presets])
  const favorites = favoriteIds.map((id) => byId.get(id)).filter((item): item is Preset => Boolean(item))
  const recents = recentIds.map((id) => byId.get(id)).filter((item): item is Preset => Boolean(item))
  const toggleFavorite = (id: string) => {
    const next = favoriteSet.has(id) ? favoriteIds.filter((item) => item !== id) : [id, ...favoriteIds]
    setFavoriteIds(next)
    writeFavoriteAssistants(next)
  }
  const startAssistant = async (item: Preset) => {
    const previous = recentIds
    const next = [item.id, ...recentIds.filter((id) => id !== item.id)]
    setRecentIds(next)
    writeRecentAssistants(next)
    setStartingId(item.id)
    setStartError('')
    try { await onStartAssistant(item) }
    catch (cause) {
      setRecentIds(previous)
      writeRecentAssistants(previous)
      setStartError(messageOf(cause))
    } finally { setStartingId(null) }
  }
  const section = (title: string, items: Preset[]) => items.length > 0 && <section className="assistant-section" aria-labelledby={`assistant-${title.toLowerCase().replace(/\s+/g, '-')}`}><div className="assistant-section-title"><h2 id={`assistant-${title.toLowerCase().replace(/\s+/g, '-')}`}>{title}</h2><small>{items.length} {items.length === 1 ? 'assistant' : 'assistants'}</small></div><div className="assistant-grid">{items.map((item) => <AssistantCard favorite={favoriteSet.has(item.id)} item={item} key={`${title}-${item.id}`} model={models.find((candidate) => modelKey(candidate) === item.model_key)} onDelete={() => onPresetDelete(item.id)} onFavorite={() => toggleFavorite(item.id)} onStart={() => startAssistant(item)} starting={startingId === item.id} />)}</div></section>

  return <Surface eyebrow="Durable local knowledge" title="Library" description="Choose a purpose-built assistant, or manage the local knowledge behind your conversations."><section className="assistant-gallery"><div className="assistant-gallery-intro"><div><span className="section-label">Assistant gallery</span><h2>Start with a specialist</h2><p>Each assistant opens a new chat with its model, temperature, and instructions already applied.</p></div><label className="assistant-search"><Search aria-hidden="true" /><Input aria-label="Search assistants" onChange={(event) => setQuery(event.target.value)} placeholder="Search names, roles, or models" type="search" value={query} /></label></div>{startError && <div className="error-strip">{startError}</div>}{presets.length === 0 ? <div className="assistant-empty"><Sparkles /><h2>No assistants yet</h2><p>Create your first reusable assistant below.</p></div> : normalizedQuery ? <>{section('Search results', matching)}{matching.length === 0 && <div className="assistant-empty"><Search /><h2>No matching assistants</h2><p>Try a role, task, provider, or model name.</p></div>}</> : <>{section('Favorites', favorites)}{section('Recently used', recents)}{section('All assistants', presets)}</>}</section><div className="three-grid library-tools"><Card><CardHeader><CardTitle>Memory</CardTitle></CardHeader><CardContent className="form-stack"><Textarea onChange={(event) => setMemory(event.target.value)} placeholder="A fact or preference" value={memory} /><Button disabled={!memory.trim()} onClick={async () => { await onMemory(memory); setMemory('') }}><Brain /> Add memory</Button>{memories.map((item) => <div className="data-row" key={item.id}><span>{item.content}</span><Badge variant={item.status === 'active' ? 'outline' : 'destructive'}>{item.status}</Badge><div className="inline-actions">{item.status === 'quarantined' && <Button onClick={() => onMemoryUpdate(item.id, { status: 'active' })} size="icon-sm" variant="ghost"><CheckCircle /></Button>}<Button onClick={() => onMemoryUpdate(item.id, { pinned: !item.pinned })} size="icon-sm" variant="ghost">⌖</Button><Button onClick={() => onMemoryUpdate(item.id, { status: 'archived' })} size="icon-sm" variant="ghost"><XCircle /></Button><Button onClick={() => onMemoryDelete(item.id)} size="icon-sm" variant="ghost"><Trash2 /></Button></div></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Create assistant</CardTitle><CardDescription>Save a reusable role, model, and system prompt.</CardDescription></CardHeader><CardContent className="form-stack"><Input onChange={(event) => setPresetName(event.target.value)} placeholder="Assistant name" value={presetName} /><Textarea onChange={(event) => setPresetPrompt(event.target.value)} placeholder="System prompt" value={presetPrompt} /><ProviderModelPicker modelLabel="Assistant model" models={models} onChange={onModel} providerLabel="Assistant provider" providers={providers} value={selectedModel} /><Button disabled={!presetName.trim() || !selectedModel} onClick={async () => { await onPreset(presetName, presetPrompt); setPresetName(''); setPresetPrompt('') }}>Save assistant</Button></CardContent></Card><Card><CardHeader><CardTitle>Files</CardTitle></CardHeader><CardContent className="form-stack"><label className="file-drop"><FileUp /><span>{conversationId ? 'Add to current conversation' : 'Select a conversation first'}</span><input disabled={!conversationId} onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUpload(file) }} type="file" /></label>{uploads.map((item) => <div className="data-row" key={item.id}><span>{item.filename}</span><small>{Math.ceil(item.size / 1024)} KB</small></div>)}</CardContent></Card></div></Surface>
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

function StudioApp({ route }: { route: WorkspaceRoute }) {
  const navigate = useNavigate()
  const page = route.page
  const [navigationCollapsed, setNavigationCollapsed] = useState(() => readStoredBoolean('chat-studio.navigation-collapsed', false))
  const [inspectorOpen, setInspectorOpen] = useState(() => readStoredBoolean('chat-studio.inspector-open', false))
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>(readInspectorTab)
  const wideInspector = useMediaQuery('(min-width: 1440px)')
  const [connected, setConnected] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(route.conversationId)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [providers, setProviders] = useState<ProviderSummary[]>([])
  const [models, setModels] = useState<ModelSummary[]>([])
  const modelsRef = useRef<ModelSummary[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort | ''>('')
  const [composerSettings, setComposerSettings] = useState<ComposerSettings>({ contextMode: 'full', temperature: 0.7, includeWeb: false, autoCompressHistory: false })
  const [systemPrompt, setSystemPrompt] = useState('')
  const [conversationLayout, setConversationLayout] = useState<ConversationLayout>('conversation')
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
  const [historyOpen, setHistoryOpen] = useState(false)
  const [runsOpen, setRunsOpen] = useState(false)
  const settingsOwner = useRef<string | null>(null)
  const lastSavedSettings = useRef('')
  modelsRef.current = models

  const setPage = useCallback((next: Page) => {
    navigate(pathForPage(next, next === 'Chat' ? activeId : null))
  }, [activeId, navigate])

  const selectConversation = useCallback((id: string) => {
    setActiveId(id)
    navigate(pathForPage('Chat', id))
  }, [navigate])

  useEffect(() => {
    writeStoredBoolean('chat-studio.navigation-collapsed', navigationCollapsed)
  }, [navigationCollapsed])

  useEffect(() => {
    writeStoredBoolean('chat-studio.inspector-open', inspectorOpen)
  }, [inspectorOpen])

  useEffect(() => {
    if (!inspectorOpen) return
    const closeInspector = (event: KeyboardEvent) => { if (event.key === 'Escape') setInspectorOpen(false) }
    window.addEventListener('keydown', closeInspector)
    return () => window.removeEventListener('keydown', closeInspector)
  }, [inspectorOpen])

  useEffect(() => {
    try { localStorage.setItem('chat-studio.inspector-tab', inspectorTab) } catch { /* Browser storage is optional. */ }
  }, [inspectorTab])

  const refreshProviders = useCallback(async () => {
    const [providerData, modelData] = await Promise.all([api.providers(), api.models()])
    setProviders(providerData.providers)
    const discovered = Object.values(modelData).flatMap((item) => item.models ?? [])
    setModels(discovered)
    setSelectedModel((current) => discovered.some((model) => modelKey(model) === current) ? current : (discovered[0] ? modelKey(discovered[0]) : ''))
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
    if (route.page !== 'Chat') return
    if (route.conversationId) {
      if (conversations.length && !conversations.some((item) => item.id === route.conversationId)) {
        navigate('/chat', { replace: true })
        return
      }
      setActiveId(route.conversationId)
      return
    }
    const next = activeId && conversations.some((item) => item.id === activeId) ? activeId : conversations[0]?.id
    if (next) navigate(pathForPage('Chat', next), { replace: true })
  }, [activeId, conversations, navigate, route.conversationId, route.page])

  useEffect(() => {
    void Promise.all([api.health(), refreshConversations(), refreshProviders(), refreshLibrary()])
      .then(() => setConnected(true))
      .catch((cause) => setError(messageOf(cause)))
  }, [refreshConversations, refreshLibrary, refreshProviders])

  useEffect(() => {
    if (page !== 'Chat') { settingsOwner.current = null; return }
    setAttachmentIds(new Set())
    settingsOwner.current = null
    if (!activeId) { setConversation(null); setUploads([]); return }
    void Promise.all([api.conversation(activeId), api.uploads(activeId)])
      .then(([detail, fileItems]) => {
        const settings = detail.settings ?? defaultConversationSettings
        setConversation(detail)
        setUploads(fileItems)
        setSelectedModel((current) => settings.model_key || (modelsRef.current[0] ? modelKey(modelsRef.current[0]) : current))
        setReasoningEffort(settings.reasoning_effort ?? '')
        setComposerSettings({
          contextMode: settings.context_policy,
          temperature: settings.temperature,
          includeWeb: settings.include_web,
          autoCompressHistory: settings.auto_compress_history,
        })
        setSystemPrompt(settings.system_prompt)
        setConversationLayout(settings.layout)
        lastSavedSettings.current = JSON.stringify(settings)
        settingsOwner.current = detail.id
      })
      .catch((cause) => setError(messageOf(cause)))
  }, [activeId, page])

  const activeConversationSettings = useMemo<ConversationSettings>(() => ({
    model_key: selectedModel,
    reasoning_effort: reasoningEffort || null,
    temperature: composerSettings.temperature,
    context_policy: composerSettings.contextMode,
    include_web: composerSettings.includeWeb,
    auto_compress_history: composerSettings.autoCompressHistory,
    system_prompt: systemPrompt,
    layout: conversationLayout,
  }), [composerSettings, conversationLayout, reasoningEffort, selectedModel, systemPrompt])

  useEffect(() => {
    if (page !== 'Chat' || !activeId || settingsOwner.current !== activeId) return
    const serialized = JSON.stringify(activeConversationSettings)
    if (serialized === lastSavedSettings.current) return
    const timeout = window.setTimeout(() => {
      void api.updateConversation(activeId, { settings: activeConversationSettings })
        .then((updated) => {
          if (settingsOwner.current !== activeId) return
          lastSavedSettings.current = serialized
          setConversation(updated)
          setConversations((current) => current.map((item) => item.id === updated.id ? updated : item))
        })
        .catch((cause) => setError(messageOf(cause)))
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [activeConversationSettings, activeId, page])

  const target = useMemo(() => {
    const [provider, ...modelParts] = selectedModel.split('::')
    return { provider, model: modelParts.join('::') }
  }, [selectedModel])

  useEffect(() => {
    const selected = models.find((model) => modelKey(model) === selectedModel)
    if (reasoningEffort && selected && !selected.reasoning_efforts?.includes(reasoningEffort)) setReasoningEffort('')
  }, [models, reasoningEffort, selectedModel])

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
    if (!activeId || !target.provider || !target.model) return false
    const includeFullContext = composerSettings.contextMode === 'full'
    const includeFiles = composerSettings.contextMode !== 'chat'
    const payload: TurnPreflight = {
      provider: target.provider,
      model: target.model,
      content,
      temperature: composerSettings.temperature,
      reasoning_effort: reasoningEffort || null,
      system_prompt: systemPrompt,
      include_memory: includeFullContext,
      include_retrieval: includeFullContext,
      include_attachments: includeFiles,
      attachment_ids: [...attachmentIds],
      include_web: composerSettings.includeWeb,
      include_backpack: includeFullContext,
      context_limit: models.find((item) => item.provider === target.provider && item.id === target.model)?.context_length ?? 8192,
      auto_compress_history: composerSettings.autoCompressHistory,
    }
    try {
      const nextPlan = await api.preflight(activeId, payload)
      setPlan(nextPlan)
      setExcludedSources(new Set(nextPlan.sources.filter((source) => !source.included || source.trust !== 'trusted').map((source) => source.id)))
      if (nextPlan.estimated_tokens > nextPlan.budget_tokens) return false
      if (nextPlan.requires_confirmation) { setPendingPlan(nextPlan); setPendingPayload(payload); return true }
      await submitTurn(payload, nextPlan)
      return true
    } catch (cause) { setError(messageOf(cause)); return false }
  }

  const upload = async (file: File, select = false, onStage?: (stage: AttachmentStage) => void) => {
    if (!activeId) throw new Error('Select a conversation before attaching a file.')
    onStage?.('uploading')
    const content = await fileAsBase64(file)
    onStage?.('processing')
    const uploaded = await api.upload(activeId, file.name, content)
    setUploads(await api.uploads(activeId))
    if (select) setAttachmentIds((current) => new Set(current).add(uploaded.id))
    return uploaded
  }

  const removeUpload = async (uploadId: string) => {
    try {
      await api.deleteUpload(uploadId)
      setUploads((current) => current.filter((item) => item.id !== uploadId))
      setAttachmentIds((current) => { const next = new Set(current); next.delete(uploadId); return next })
    } catch (cause) {
      setError(messageOf(cause))
    }
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
      setActiveId(null); setConversation(null); setUploads([]); setAttachmentIds(new Set()); navigate('/chat')
    } catch (cause) { setError(messageOf(cause)) }
    finally { setSavingMemories(false) }
  }

  const createConversation = async () => {
    const created = await api.createConversation()
    await refreshConversations()
    selectConversation(created.id)
  }

  const latestCompletedRun = activity.find((run) => run.conversation_id === activeId && run.status === 'completed')
  const exportActiveConversation = async (format: ChatExportFormat) => {
    if (!conversation) return
    try {
      const filename = conversation.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'conversation'
      if (format === 'bundle') {
        if (!latestCompletedRun) return
        const bundle = await api.bundle(latestCompletedRun.id, 'full')
        downloadFile(JSON.stringify(bundle, null, 2), 'application/json', `${filename}-reproducibility.json`)
        return
      }
      const formats: Record<ConversationExportFormat, { extension: string; type: string }> = {
        markdown: { extension: 'md', type: 'text/markdown' },
        html: { extension: 'html', type: 'text/html' },
        txt: { extension: 'txt', type: 'text/plain' },
        json: { extension: 'json', type: 'application/json' },
      }
      const exported = await api.conversationExport(conversation.id, format)
      const target = formats[format]
      downloadFile(exported, target.type, `${filename}.${target.extension}`)
    } catch (cause) {
      setError(messageOf(cause))
    }
  }

  const toggleSource = (id: string) => setExcludedSources((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const inspector = <ContextEvidenceInspector excluded={excludedSources} onClose={() => setInspectorOpen(false)} onPage={setPage} onTab={setInspectorTab} onToggle={toggleSource} plan={plan} tab={inspectorTab} />

  return (
    <TooltipProvider>
      <div className={navigationCollapsed ? 'app-shell nav-collapsed' : 'app-shell nav-expanded'}>
        <Navigation collapsed={navigationCollapsed} connected={connected} onCollapsed={setNavigationCollapsed} onPage={setPage} page={page} />
        {page === 'Chat' && <ConversationHistory activeId={activeId} conversations={conversations} onCreate={createConversation} onDelete={async (id) => { if (!window.confirm('Delete this conversation?')) return; await api.deleteConversation(id); if (activeId === id) { setActiveId(null); navigate('/chat') } await refreshConversations() }} onSelect={selectConversation} onUpdate={async (id, payload) => { await api.updateConversation(id, payload); await refreshConversations(); if (activeId === id) setConversation(await api.conversation(id)) }} />}
        {page === 'Chat' && <div className={wideInspector && inspectorOpen ? 'chat-stage inspector-docked' : 'chat-stage'}><ChatWorkspace attachmentIds={attachmentIds} canExportBundle={Boolean(latestCompletedRun)} composerSettings={composerSettings} conversation={conversation} error={error} inspectorOpen={inspectorOpen} layout={conversationLayout} liveOutput={liveOutput} models={models} onAttachment={(id) => setAttachmentIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })} onBranch={async (messageId) => { if (!activeId) return; const branch = await api.branchConversation(activeId, messageId); await refreshConversations(); selectConversation(branch.id) }} onCancel={async () => { if (activeRun) await api.cancelRun(activeRun) }} onComposerSettings={setComposerSettings} onConfirm={async () => { if (pendingPayload && pendingPlan) await submitTurn(pendingPayload, pendingPlan, pendingPlan.findings.map((item) => item.id)) }} onExport={exportActiveConversation} onFeedback={api.setFeedback} onHistory={() => setHistoryOpen(true)} onInspector={() => setInspectorOpen((current) => !current)} onLayout={setConversationLayout} onModel={setSelectedModel} onReasoningEffort={setReasoningEffort} onRemoveUpload={removeUpload} onRuns={() => setRunsOpen(true)} onSanitize={async () => { if (!pendingPayload) return; const sanitized = await api.sanitize(pendingPayload.content); setPendingPlan(null); setPendingPayload(null); await send(sanitized.content) }} onSaveMemories={saveMemoriesAndClose} onSend={send} onSystemPrompt={setSystemPrompt} onUpload={async (file, onStage) => { await upload(file, true, onStage) }} pendingPlan={pendingPlan} plan={plan} providers={providers} reasoningEffort={reasoningEffort} running={Boolean(activeRun)} savingMemories={savingMemories} selectedModel={selectedModel} systemPrompt={systemPrompt} uploads={uploads} />{wideInspector && inspectorOpen && inspector}</div>}
        {page === 'Chat' && !wideInspector && <Sheet onOpenChange={setInspectorOpen} open={inspectorOpen}><SheetContent className="inspector-sheet" showCloseButton={false} side="right">{inspector}</SheetContent></Sheet>}
        <Sheet onOpenChange={setHistoryOpen} open={historyOpen}>
          <SheetContent className="history-sheet" side="left">
            <ConversationHistory activeId={activeId} conversations={conversations} mobile onCreate={createConversation} onDelete={async (id) => { if (!window.confirm('Delete this conversation?')) return; await api.deleteConversation(id); if (activeId === id) { setActiveId(null); navigate('/chat') } await refreshConversations() }} onSelect={(id) => { selectConversation(id); setHistoryOpen(false) }} onUpdate={async (id, payload) => { await api.updateConversation(id, payload); await refreshConversations(); if (activeId === id) setConversation(await api.conversation(id)) }} />
          </SheetContent>
        </Sheet>
        <Sheet onOpenChange={setRunsOpen} open={runsOpen}>
          <SheetContent className="runs-sheet" side="right">
            {runsOpen && <div className="runs-sheet-content">
            <ReplayPage activity={activity} embedded models={models} onModel={setSelectedModel} onReplay={async (run, key) => { const model = models.find((candidate) => modelKey(candidate) === key); if (!model) return; const replay = await api.replay(run.id, model.provider, model.id); await streamRun(replay.id, () => {}); setActivity(await api.activity()) }} providers={providers} selectedModel={selectedModel} />
            </div>}
          </SheetContent>
        </Sheet>
        {page === 'Compare' && <ComparePage models={models} providers={providers} />}
        {page === 'Context' && <ContextPage backpacks={backpacks} onCreate={async (name, title, content) => { await api.createBackpack(name, title, content); setBackpacks(await api.backpacks()) }} plan={plan} />}
        {page === 'Evidence' && <EvidencePage activity={activity} excluded={excludedSources} onToggle={toggleSource} plan={plan} />}
        {page === 'Replay' && <ReplayPage activity={activity} models={models} onModel={setSelectedModel} onReplay={async (run, key) => { const model = models.find((candidate) => modelKey(candidate) === key); if (!model) return; const replay = await api.replay(run.id, model.provider, model.id); await streamRun(replay.id, () => {}); setActivity(await api.activity()) }} providers={providers} selectedModel={selectedModel} />}
        {page === 'Focus' && <FocusPage conversationId={activeId} onCreate={async (objective, criteria, constraints) => { if (!activeId) return; await api.createFocus({ conversation_id: activeId, objective, success_criteria: criteria, constraints }); setPage('Chat') }} />}
        {page === 'Providers' && <ProvidersPage onChanged={refreshProviders} providers={providers} />}
        {page === 'Library' && <LibraryPage conversationId={activeId} memories={memories} models={models} onMemory={async (content) => { await api.createMemory(content); setMemories(await api.memories()) }} onMemoryDelete={async (id) => { await api.deleteMemory(id); setMemories(await api.memories()) }} onMemoryUpdate={async (id, payload) => { await api.updateMemory(id, payload); setMemories(await api.memories()) }} onModel={setSelectedModel} onPreset={async (name, prompt) => { await api.createPreset({ name, system_prompt: prompt, model_key: selectedModel, temperature: 0.7 }); setPresets(await api.presets()) }} onPresetDelete={async (id) => { await api.deletePreset(id); setPresets(await api.presets()) }} onStartAssistant={async (preset) => { const created = await api.createConversation(preset.name, { ...defaultConversationSettings, model_key: preset.model_key, temperature: preset.temperature, system_prompt: preset.system_prompt }); setConversations((current) => [created, ...current.filter((item) => item.id !== created.id)]); selectConversation(created.id) }} onUpload={async (file) => { try { await upload(file) } catch (cause) { setError(messageOf(cause)) } }} presets={presets} providers={providers} selectedModel={selectedModel} uploads={uploads} />}
        {page === 'Settings' && <SettingsPage connected={connected} onRefresh={async () => { await Promise.all([refreshConversations(), refreshLibrary()]) }} />}
      </div>
    </TooltipProvider>
  )
}

function RoutedApp() {
  const location = useLocation()
  const route = routeFromPath(location.pathname)
  if (!route) return <main className="route-error"><p className="eyebrow">Page not found</p><h1>This workspace does not exist.</h1><p>Use the main navigation or return to Chat.</p><a href="/chat">Return to Chat</a></main>
  return <RouteErrorBoundary key={route.page}><StudioApp route={route} /></RouteErrorBoundary>
}

export default function App() {
  return <BrowserRouter><RoutedApp /></BrowserRouter>
}
