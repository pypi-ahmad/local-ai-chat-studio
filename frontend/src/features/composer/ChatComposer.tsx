import { useRef, useState } from 'react'
import { CheckCircle, FileText, LoaderCircle, MoreHorizontal, Paperclip, RefreshCw, Send, Square, Trash2, XCircle } from 'lucide-react'

import { ApiError, type ModelSummary, type ProviderSummary, type ReasoningEffort, type Upload } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { ProviderModelPicker } from '@/features/models/ProviderModelPicker'
import type { AttachmentStage, ComposerSettings, ContextMode } from '@/routes/chat/types'

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

function messageOf(error: unknown) {
  if (error instanceof ApiError && typeof error.detail === 'object' && error.detail) {
    const detail = error.detail as { message?: string }
    return detail.message ?? error.message
  }
  return error instanceof Error ? error.message : 'Request failed'
}

export function ChatComposer({
  prompt,
  onPrompt,
  models,
  providers,
  selectedModel,
  onModel,
  reasoningEffort,
  onReasoningEffort,
  running,
  onSend,
  onCancel,
  onUpload,
  onRemoveUpload,
  uploads,
  attachmentIds,
  onAttachment,
  settings,
  onSettings,
}: {
  prompt: string
  onPrompt: (value: string) => void
  models: ModelSummary[]
  providers: ProviderSummary[]
  selectedModel: string
  onModel: (value: string) => void
  reasoningEffort: ReasoningEffort | ''
  onReasoningEffort: (value: ReasoningEffort | '') => void
  running: boolean
  onSend: (content: string) => Promise<boolean>
  onCancel: () => Promise<void>
  onUpload: (file: File, onStage: (stage: AttachmentStage) => void) => Promise<void>
  onRemoveUpload: (id: string) => Promise<void>
  uploads: Upload[]
  attachmentIds: Set<string>
  onAttachment: (id: string) => void
  settings: ComposerSettings
  onSettings: (settings: ComposerSettings) => void
}) {
  const [attachmentAttempts, setAttachmentAttempts] = useState<AttachmentAttempt[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const selected = models.find((model) => `${model.provider}::${model.id}` === selectedModel)

  const submit = async () => {
    if (!prompt.trim()) return
    if (await onSend(prompt.trim())) onPrompt('')
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

  return <div className="composer-shell">
    <Textarea
      aria-label="Message"
      onChange={(event) => onPrompt(event.target.value)}
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
        <select aria-label="Reasoning effort" disabled={!selected?.reasoning_efforts?.length} onChange={(event) => onReasoningEffort(event.target.value as ReasoningEffort | '')} value={reasoningEffort}>
          <option value="">{selected?.reasoning_efforts?.length ? 'Auto' : 'Provider default'}</option>
          {selected?.reasoning_efforts?.map((effort) => <option key={effort} value={effort}>{effort}</option>)}
        </select>
      </label>
      <label className="context-mode-picker" title="Choose which optional local sources may enter the next prompt.">
        <span>Context</span>
        <select aria-label="Context mode" onChange={(event) => onSettings({ ...settings, contextMode: event.target.value as ContextMode })} value={settings.contextMode}>
          <option value="full">Full context</option><option value="chat">Chat only</option><option value="files">Files + chat</option>
        </select>
      </label>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="More composer settings" className="composer-more-trigger"><MoreHorizontal /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="composer-settings-menu" side="top">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Secondary settings</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={settings.autoCompressHistory} onCheckedChange={(checked) => onSettings({ ...settings, autoCompressHistory: checked })}>Compress older messages</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={settings.includeWeb} onCheckedChange={(checked) => onSettings({ ...settings, includeWeb: checked })}>Web evidence</DropdownMenuCheckboxItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Temperature <span>{settings.temperature.toFixed(1)}</span></DropdownMenuSubTrigger>
              <DropdownMenuSubContent><DropdownMenuRadioGroup onValueChange={(value) => onSettings({ ...settings, temperature: Number(value) })} value={String(settings.temperature)}><DropdownMenuRadioItem value="0.2">Precise · 0.2</DropdownMenuRadioItem><DropdownMenuRadioItem value="0.7">Balanced · 0.7</DropdownMenuRadioItem><DropdownMenuRadioItem value="1">Creative · 1.0</DropdownMenuRadioItem></DropdownMenuRadioGroup></DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuGroup>
          <DropdownMenuSeparator /><p className="composer-settings-hint">Enter to send · Shift+Enter for newline</p>
        </DropdownMenuContent>
      </DropdownMenu>
      {running ? <Button aria-label="Stop generation" className="composer-send" onClick={onCancel} size="icon" variant="destructive"><Square /></Button> : <Button aria-label="Send message" className="composer-send" disabled={!prompt.trim() || !selectedModel} onClick={submit} size="icon"><Send /></Button>}
    </div>
  </div>
}
