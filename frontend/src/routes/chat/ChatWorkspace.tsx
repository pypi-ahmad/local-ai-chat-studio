import { useEffect, useState } from 'react'
import { Brain, Code2, Download, FileText, PanelLeft, PanelRightOpen, RotateCcw, Settings, ShieldCheck } from 'lucide-react'

import type { ContextPlan, Conversation, ModelSummary, ProviderSummary, ReasoningEffort, Upload } from '@/api/client'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { ChatComposer } from '@/features/composer/ChatComposer'
import { ContextRail } from '@/features/context/ContextInspector'
import { MessageList } from '@/features/messages/MessageList'
import { pricingLabel } from '@/features/models/modelMetadata'
import type { AttachmentStage, ChatExportFormat, ComposerSettings, ConversationLayout } from '@/routes/chat/types'

export function ChatWorkspace({
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
  loading = false,
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
  loading?: boolean
}) {
  const [prompt, setPrompt] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [systemPromptDraft, setSystemPromptDraft] = useState(systemPrompt)
  const [layoutDraft, setLayoutDraft] = useState<ConversationLayout>(layout)
  const selected = models.find((model) => `${model.provider}::${model.id}` === selectedModel)
  useEffect(() => {
    if (settingsOpen) return
    setSystemPromptDraft(systemPrompt)
    setLayoutDraft(layout)
  }, [layout, settingsOpen, systemPrompt])
  const saveConversationSettings = () => {
    onSystemPrompt(systemPromptDraft)
    onLayout(layoutDraft)
    setSettingsOpen(false)
  }
  return <main aria-label="Chat workspace" className={`workspace layout-${layout}`}>
    <header className="workspace-header">
      <Button aria-label="Open conversation history" className="mobile-history-trigger" onClick={onHistory} size="icon" variant="ghost"><PanelLeft /></Button>
      <div className="workspace-title"><p className="eyebrow">Conversation</p><h2>{conversation?.title ?? 'New conversation'}</h2>{selected?.pricing && <small>Estimated pricing: {pricingLabel(selected)} · <a href={selected.pricing.source_url} rel="noreferrer" target="_blank">official source</a></small>}</div>
      <div className="action-row"><Button aria-expanded={settingsOpen} aria-label="Conversation settings" onClick={() => setSettingsOpen(true)} variant="outline"><Settings /> Settings</Button><DropdownMenu><DropdownMenuTrigger aria-label="Export conversation" disabled={!conversation} render={<Button variant="outline" />}><Download /> Export</DropdownMenuTrigger><DropdownMenuContent align="end" className="conversation-export-menu"><DropdownMenuGroup><DropdownMenuLabel>Conversation</DropdownMenuLabel><DropdownMenuItem onClick={() => void onExport('markdown')}><FileText /> Markdown (.md)</DropdownMenuItem><DropdownMenuItem onClick={() => void onExport('html')}><Code2 /> HTML (.html)</DropdownMenuItem><DropdownMenuItem onClick={() => void onExport('txt')}><FileText /> Plain text (.txt)</DropdownMenuItem><DropdownMenuItem onClick={() => void onExport('json')}><Code2 /> JSON (.json)</DropdownMenuItem></DropdownMenuGroup><DropdownMenuSeparator /><DropdownMenuGroup><DropdownMenuLabel>Latest completed run</DropdownMenuLabel><DropdownMenuItem disabled={!canExportBundle} onClick={() => void onExport('bundle')}><Download /> Reproducibility bundle (.json)</DropdownMenuItem></DropdownMenuGroup></DropdownMenuContent></DropdownMenu><Button aria-label="Open runs" onClick={onRuns} variant="outline"><RotateCcw /> Runs</Button><Button aria-controls="context-evidence-inspector" aria-expanded={inspectorOpen} aria-label={`${inspectorOpen ? 'Close' : 'Open'} context and evidence inspector`} onClick={onInspector} variant={inspectorOpen ? 'secondary' : 'outline'}><PanelRightOpen /> Inspector</Button><Button disabled={!conversation?.messages.length || savingMemories || !selectedModel} onClick={onSaveMemories} variant="outline"><Brain /> {savingMemories ? 'Saving…' : 'Save memories & close'}</Button></div>
    </header>
    <ContextRail model={selected} plan={plan} />
    <MessageList conversation={conversation} layout={layout} liveOutput={liveOutput} loading={loading} onBranch={onBranch} onFeedback={onFeedback} onSuggestion={setPrompt} />
    {pendingPlan && <div className="safety-strip" role="alert"><ShieldCheck /><div><strong>Review before sending</strong><p>{pendingPlan.findings.map((finding) => finding.message).join(' · ')}</p></div><Button onClick={onSanitize} variant="outline">Redact private text</Button><Button onClick={onConfirm}>Confirm and send</Button></div>}
    {error && <div className="error-strip" role="alert">{error}</div>}
    <ChatComposer attachmentIds={attachmentIds} models={models} onAttachment={onAttachment} onCancel={onCancel} onModel={onModel} onPrompt={setPrompt} onReasoningEffort={onReasoningEffort} onRemoveUpload={onRemoveUpload} onSend={onSend} onSettings={onComposerSettings} onUpload={onUpload} prompt={prompt} providers={providers} reasoningEffort={reasoningEffort} running={running} selectedModel={selectedModel} settings={composerSettings} uploads={uploads} />
    {settingsOpen && <div className="conversation-settings-overlay"><section aria-describedby="conversation-settings-description" aria-labelledby="conversation-settings-title" aria-modal="true" className="conversation-settings-dialog" role="dialog"><header><h2 id="conversation-settings-title">Conversation settings</h2><p id="conversation-settings-description">These instructions and layout apply only to this conversation.</p></header><label className="conversation-setting-field"><span>System prompt</span><Textarea aria-label="System prompt" autoFocus onChange={(event) => setSystemPromptDraft(event.target.value)} placeholder="Optional instructions for this conversation" value={systemPromptDraft} /></label><fieldset className="layout-options"><legend>Message layout</legend>{([['conversation', 'Conversation', 'Balanced chat bubbles'], ['compact', 'Compact', 'Dense, full-row messages'], ['full-width', 'Full-width', 'Use the available reading width']] as const).map(([value, label, description]) => <button aria-label={`${label} layout`} aria-pressed={layoutDraft === value} key={value} onClick={() => setLayoutDraft(value)} type="button"><strong>{label}</strong><small>{description}</small></button>)}</fieldset><div className="conversation-settings-actions"><Button onClick={() => setSettingsOpen(false)} variant="ghost">Cancel</Button><Button aria-label="Save conversation settings" onClick={saveConversationSettings}>Save settings</Button></div></section></div>}
  </main>
}
