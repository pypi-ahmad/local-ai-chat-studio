import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { BrowserRouter, useLocation, useNavigate } from 'react-router'
import {
  ChevronLeft,
  ChevronRight,
  Command,
  Focus,
  GitCompareArrows,
  Library,
  MessageSquare,
  MoreHorizontal,
  PlugZap,
  Search,
  Settings,
  Wrench,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { TooltipProvider } from '@/components/ui/tooltip'
import { fileAsBase64 } from '@/features/attachments/fileEncoding'
import { ConversationHistory } from '@/features/conversations/ConversationHistory'
import { ToolControlCenter } from '@/features/tools/ToolControlCenter'
import { ContextEvidenceInspector } from '@/features/context/ContextInspector'
import { modelKey } from '@/features/models/modelMetadata'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useWorkspacePreferences } from '@/hooks/useWorkspacePreferences'
import { RouteErrorBoundary } from '@/app/RouteErrorBoundary'
import { pathForPage, routeFromPath, type Page, type WorkspaceRoute } from '@/app/routes'
import { ChatWorkspace } from '@/routes/chat/ChatWorkspace'
import type { AttachmentStage, ChatExportFormat, ComposerSettings, ConversationLayout } from '@/routes/chat/types'
import { ComparePage } from '@/routes/compare/ComparePage'
import { ContextPage } from '@/routes/context/ContextPage'
import { EvidencePage } from '@/routes/evidence/EvidencePage'
import { FocusPage } from '@/routes/focus/FocusPage'
import { LibraryPage } from '@/routes/library/LibraryPage'
import { ReplayPage } from '@/routes/replay/ReplayPage'
import { ProvidersPage } from '@/routes/settings/ProvidersPage'
import { SettingsPage } from '@/routes/settings/SettingsPage'

import {
  ApiError,
  api,
  streamRun,
  type Backpack as BackpackRecord,
  type ContextPlan,
  type Conversation,
  type ConversationExportFormat,
  type ConversationSettings,
  type KnowledgeBase,
  type Memory,
  type ModelSummary,
  type Preset,
  type ProviderSummary,
  type ReasoningEffort,
  type RunSnapshot,
  type TurnPreflight,
  type Upload,
} from './api/client'

const navigationGroups: ReadonlyArray<{ label: string; items: ReadonlyArray<readonly [Page, typeof MessageSquare]> }> = [
  { label: 'Primary', items: [['Chat', MessageSquare], ['Compare', GitCompareArrows], ['Library', Library]] },
  { label: 'Workspace', items: [['Focus', Focus], ['Tools', Wrench]] },
  { label: 'Administration', items: [['Providers', PlugZap], ['Settings', Settings]] },
]

const defaultConversationSettings: ConversationSettings = {
  model_key: '',
  reasoning_effort: null,
  temperature: 0.7,
  context_policy: 'full',
  include_web: false,
  auto_compress_history: false,
  system_prompt: '',
  layout: 'conversation',
  knowledge_base_id: null,
}

function messageOf(error: unknown) {
  if (error instanceof ApiError && typeof error.detail === 'object' && error.detail) {
    const detail = error.detail as { message?: string }
    return detail.message ?? error.message
  }
  return error instanceof Error ? error.message : 'Request failed'
}

function Navigation({ page, onPage, connected, collapsed, onCollapsed, onCommands }: { page: Page; onPage: (page: Page) => void; connected: boolean; collapsed: boolean; onCollapsed: (collapsed: boolean) => void; onCommands: () => void }) {
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
              <div aria-labelledby="more-navigation-shortcuts" className="more-navigation-group" role="group"><p id="more-navigation-shortcuts">Shortcuts</p><button onClick={() => { setMoreOpen(false); onCommands() }} type="button"><Command /><span>Command palette</span></button></div>
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
      <Button aria-label="Open command palette" className="command-palette-trigger" onClick={onCommands} title="Command palette (Ctrl+K)" variant="ghost"><Command /><span className="nav-label">Commands</span><kbd>Ctrl K</kbd></Button>
      <div className="nav-footer"><span className={connected ? 'status-dot' : 'status-dot offline'} /><span>{connected ? 'Backend connected' : 'Backend unavailable'}</span></div>
      <Button aria-expanded={!collapsed} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} className="nav-collapse" onClick={() => onCollapsed(!collapsed)} size="icon-sm" variant="ghost">{collapsed ? <ChevronRight /> : <ChevronLeft />}</Button>
    </nav>
  )
}

function CommandPalette({ open, onOpenChange, onPage, onCreate, onInspector, onRuns }: { open: boolean; onOpenChange: (open: boolean) => void; onPage: (page: Page) => void; onCreate: () => void; onInspector: () => void; onRuns: () => void }) {
  const [query, setQuery] = useState('')
  const commands: Array<{ label: string; hint: string; action: () => void }> = [
    ...navigationGroups.flatMap((group) => group.items.map(([page]) => ({ label: `Open ${page}`, hint: group.label, action: () => onPage(page) }))),
    { label: 'New conversation', hint: 'Chat', action: onCreate },
    { label: 'Toggle context inspector', hint: 'Chat', action: onInspector },
    { label: 'Open run actions', hint: 'Chat', action: onRuns },
  ]
  const visible = commands.filter((command) => `${command.label} ${command.hint}`.toLowerCase().includes(query.trim().toLowerCase()))
  const run = (action: () => void) => { action(); onOpenChange(false); setQuery('') }
  return <Dialog onOpenChange={(next) => { onOpenChange(next); if (!next) setQuery('') }} open={open}><DialogContent aria-label="Command palette" className="command-palette" showCloseButton={false}><DialogHeader><DialogTitle>Command palette</DialogTitle><DialogDescription>Jump between workspaces or run a common action.</DialogDescription></DialogHeader><div className="command-search"><Search /><Input aria-label="Search commands" autoFocus onChange={(event) => setQuery(event.target.value)} placeholder="Search commands…" value={query} /><kbd>Esc</kbd></div><div className="command-list">{visible.map((command) => <button aria-label={command.label} key={command.label} onClick={() => run(command.action)} type="button"><span>{command.label}</span><small>{command.hint}</small></button>)}{!visible.length && <div className="command-empty">No matching commands</div>}</div></DialogContent></Dialog>
}

function downloadFile(content: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function StudioApp({ route }: { route: WorkspaceRoute }) {
  const navigate = useNavigate()
  const page = route.page
  const { historyWidth, inspectorOpen, inspectorTab, navigationCollapsed, setHistoryWidth, setInspectorOpen, setInspectorTab, setNavigationCollapsed } = useWorkspacePreferences()
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
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [uploads, setUploads] = useState<Upload[]>([])
  const [knowledgeBaseId, setKnowledgeBaseId] = useState<string | null>(null)
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
  const [commandOpen, setCommandOpen] = useState(false)
  const [workspaceLoading, setWorkspaceLoading] = useState(true)
  const [conversationLoading, setConversationLoading] = useState(false)
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
    const openCommands = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', openCommands)
    return () => window.removeEventListener('keydown', openCommands)
  }, [])

  useEffect(() => {
    if (!inspectorOpen) return
    const closeInspector = (event: KeyboardEvent) => { if (event.key === 'Escape') setInspectorOpen(false) }
    window.addEventListener('keydown', closeInspector)
    return () => window.removeEventListener('keydown', closeInspector)
  }, [inspectorOpen, setInspectorOpen])

  const refreshProviders = useCallback(async () => {
    const [providerData, modelData] = await Promise.all([api.providers(), api.models()])
    setProviders(providerData.providers)
    const discovered = Object.values(modelData).flatMap((item) => item.models ?? [])
    setModels(discovered)
    setSelectedModel((current) => discovered.some((model) => modelKey(model) === current) ? current : (discovered[0] ? modelKey(discovered[0]) : ''))
  }, [])

  const refreshLibrary = useCallback(async () => {
    const [memoryData, presetData, backpackData, knowledgeBaseData, activityData] = await Promise.all([
      api.memories(), api.presets(), api.backpacks(), api.knowledgeBases(), api.activity(),
    ])
    setMemories(memoryData); setPresets(presetData); setBackpacks(backpackData); setKnowledgeBases(knowledgeBaseData); setActivity(activityData)
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
      .finally(() => setWorkspaceLoading(false))
  }, [refreshConversations, refreshLibrary, refreshProviders])

  useEffect(() => {
    if (page !== 'Chat') { settingsOwner.current = null; return }
    setAttachmentIds(new Set())
    settingsOwner.current = null
    if (!activeId) { setConversation(null); setUploads([]); setConversationLoading(false); return }
    let cancelled = false
    setConversationLoading(true)
    setConversation(null)
    void Promise.all([api.conversation(activeId), api.uploads(activeId)])
      .then(([detail, fileItems]) => {
        if (cancelled) return
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
        setKnowledgeBaseId(settings.knowledge_base_id ?? null)
        lastSavedSettings.current = JSON.stringify(settings)
        settingsOwner.current = detail.id
      })
      .catch((cause) => setError(messageOf(cause)))
      .finally(() => { if (!cancelled) setConversationLoading(false) })
    return () => { cancelled = true }
  }, [activeId, page])

  useEffect(() => {
    if (page !== 'Library' || !activeId) return
    void Promise.all([api.conversation(activeId), api.uploads(activeId)])
      .then(([detail, fileItems]) => { setConversation(detail); setUploads(fileItems) })
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
    knowledge_base_id: knowledgeBaseId,
  }), [composerSettings, conversationLayout, knowledgeBaseId, reasoningEffort, selectedModel, systemPrompt])

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

  const updateHistoryWidth = (width: number) => {
    const next = Math.min(420, Math.max(224, Math.round(width)))
    setHistoryWidth(next)
  }
  const beginHistoryResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = historyWidth
    const move = (next: PointerEvent) => updateHistoryWidth(startWidth + next.clientX - startX)
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
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
  const currentConversation = conversation?.id === activeId ? conversation : (conversations.find((item) => item.id === activeId) ?? null)
  const bindKnowledgeBase = async (id: string | null) => {
    if (!activeId) return
    const detail = conversation?.id === activeId ? conversation : await api.conversation(activeId)
    const settings = { ...(detail.settings ?? defaultConversationSettings), knowledge_base_id: id }
    const updated = await api.updateConversation(activeId, { settings })
    setConversation(updated)
    setKnowledgeBaseId(id)
    setConversations((current) => current.map((item) => item.id === updated.id ? updated : item))
    if (settingsOwner.current === activeId) lastSavedSettings.current = JSON.stringify(settings)
  }
  const inspector = <ContextEvidenceInspector excluded={excludedSources} onClose={() => setInspectorOpen(false)} onPage={setPage} onTab={setInspectorTab} onToggle={toggleSource} plan={plan} tab={inspectorTab} />

  return (
    <TooltipProvider>
      <div className={navigationCollapsed ? 'app-shell nav-collapsed' : 'app-shell nav-expanded'} style={{ '--history-width': `${historyWidth}px` } as CSSProperties}>
        <Navigation collapsed={navigationCollapsed} connected={connected} onCollapsed={setNavigationCollapsed} onCommands={() => setCommandOpen(true)} onPage={setPage} page={page} />
        {page === 'Chat' && <ConversationHistory activeId={activeId} conversations={conversations} loading={workspaceLoading} onCreate={createConversation} onDelete={async (id) => { if (!window.confirm('Delete this conversation?')) return; await api.deleteConversation(id); if (activeId === id) { setActiveId(null); navigate('/chat') } await refreshConversations() }} onSelect={selectConversation} onUpdate={async (id, payload) => { await api.updateConversation(id, payload); await refreshConversations(); if (activeId === id) setConversation(await api.conversation(id)) }} />}
        {page === 'Chat' && <div aria-label="Resize conversation sidebar" aria-orientation="vertical" aria-valuemax={420} aria-valuemin={224} aria-valuenow={historyWidth} className="history-resizer" onKeyDown={(event) => { if (event.key === 'ArrowLeft') updateHistoryWidth(historyWidth - 12); if (event.key === 'ArrowRight') updateHistoryWidth(historyWidth + 12) }} onPointerDown={beginHistoryResize} role="separator" tabIndex={0} />}
        {page === 'Chat' && <div className={wideInspector && inspectorOpen ? 'chat-stage inspector-docked' : 'chat-stage'}><ChatWorkspace attachmentIds={attachmentIds} canExportBundle={Boolean(latestCompletedRun)} composerSettings={composerSettings} conversation={conversation} error={error} inspectorOpen={inspectorOpen} layout={conversationLayout} liveOutput={liveOutput} loading={workspaceLoading || conversationLoading} models={models} onAttachment={(id) => setAttachmentIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })} onBranch={async (messageId) => { if (!activeId) return; const branch = await api.branchConversation(activeId, messageId); await refreshConversations(); selectConversation(branch.id) }} onCancel={async () => { if (activeRun) await api.cancelRun(activeRun) }} onComposerSettings={setComposerSettings} onConfirm={async () => { if (pendingPayload && pendingPlan) await submitTurn(pendingPayload, pendingPlan, pendingPlan.findings.map((item) => item.id)) }} onExport={exportActiveConversation} onFeedback={api.setFeedback} onHistory={() => setHistoryOpen(true)} onInspector={() => setInspectorOpen((current) => !current)} onLayout={setConversationLayout} onModel={setSelectedModel} onReasoningEffort={setReasoningEffort} onRemoveUpload={removeUpload} onRuns={() => setRunsOpen(true)} onSanitize={async () => { if (!pendingPayload) return; const sanitized = await api.sanitize(pendingPayload.content); setPendingPlan(null); setPendingPayload(null); await send(sanitized.content) }} onSaveMemories={saveMemoriesAndClose} onSend={send} onSystemPrompt={setSystemPrompt} onUpload={async (file, onStage) => { await upload(file, true, onStage) }} pendingPlan={pendingPlan} plan={plan} providers={providers} reasoningEffort={reasoningEffort} running={Boolean(activeRun)} savingMemories={savingMemories} selectedModel={selectedModel} systemPrompt={systemPrompt} uploads={uploads} />{wideInspector && inspectorOpen && inspector}</div>}
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
        <CommandPalette onCreate={() => void createConversation()} onInspector={() => { setPage('Chat'); setInspectorOpen((current) => !current) }} onOpenChange={setCommandOpen} onPage={setPage} onRuns={() => setRunsOpen(true)} open={commandOpen} />
        {page === 'Compare' && <ComparePage models={models} providers={providers} />}
        {page === 'Context' && <ContextPage backpacks={backpacks} onCreate={async (name, title, content) => { await api.createBackpack(name, title, content); setBackpacks(await api.backpacks()) }} plan={plan} />}
        {page === 'Evidence' && <EvidencePage activity={activity} excluded={excludedSources} onToggle={toggleSource} plan={plan} />}
        {page === 'Replay' && <ReplayPage activity={activity} models={models} onModel={setSelectedModel} onReplay={async (run, key) => { const model = models.find((candidate) => modelKey(candidate) === key); if (!model) return; const replay = await api.replay(run.id, model.provider, model.id); await streamRun(replay.id, () => {}); setActivity(await api.activity()) }} providers={providers} selectedModel={selectedModel} />}
        {page === 'Focus' && <FocusPage conversationId={activeId} onCreate={async (objective, criteria, constraints) => { if (!activeId) return; await api.createFocus({ conversation_id: activeId, objective, success_criteria: criteria, constraints }); setPage('Chat') }} />}
        {page === 'Tools' && <ToolControlCenter />}
        {page === 'Providers' && <ProvidersPage onChanged={refreshProviders} providers={providers} />}
        {page === 'Library' && <LibraryPage backpacks={backpacks} conversation={currentConversation} knowledgeBases={knowledgeBases} memories={memories} models={models} onKnowledgeBaseBind={bindKnowledgeBase} onKnowledgeBaseCreate={async (payload) => { const created = await api.createKnowledgeBase(payload); setKnowledgeBases((current) => [created, ...current]); return created }} onKnowledgeBaseDelete={async (id) => { await api.deleteKnowledgeBase(id); setKnowledgeBases((current) => current.filter((item) => item.id !== id)); await refreshConversations() }} onKnowledgeBaseUpdate={async (id, payload) => { const updated = await api.updateKnowledgeBase(id, payload); setKnowledgeBases((current) => current.map((item) => item.id === id ? updated : item)); return updated }} onMemory={async (content) => { await api.createMemory(content); setMemories(await api.memories()) }} onMemoryDelete={async (id) => { await api.deleteMemory(id); setMemories(await api.memories()) }} onMemoryUpdate={async (id, payload) => { await api.updateMemory(id, payload); setMemories(await api.memories()) }} onModel={setSelectedModel} onPreset={async (name, prompt) => { await api.createPreset({ name, system_prompt: prompt, model_key: selectedModel, temperature: 0.7 }); setPresets(await api.presets()) }} onPresetDelete={async (id) => { await api.deletePreset(id); setPresets(await api.presets()) }} onStartAssistant={async (preset) => { const created = await api.createConversation(preset.name, { ...defaultConversationSettings, model_key: preset.model_key, temperature: preset.temperature, system_prompt: preset.system_prompt }); setConversations((current) => [created, ...current.filter((item) => item.id !== created.id)]); selectConversation(created.id) }} onUpload={async (file) => { try { await upload(file) } catch (cause) { setError(messageOf(cause)) } }} presets={presets} providers={providers} selectedModel={selectedModel} uploads={uploads} />}
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
