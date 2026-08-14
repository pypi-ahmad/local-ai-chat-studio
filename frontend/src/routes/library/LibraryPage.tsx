import { useMemo, useState } from 'react'
import { Brain, CheckCircle, Code2, Database, FileText, FileUp, LoaderCircle, MessageSquare, Search, Sparkles, Star, Trash2, XCircle } from 'lucide-react'

import { ApiError, type Backpack as BackpackRecord, type Conversation, type KnowledgeBase, type KnowledgeBaseCreate, type Memory, type ModelSummary, type Preset, type ProviderSummary, type Upload } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Surface } from '@/components/shared/Surface'
import { readFavoriteAssistants, readRecentAssistants, writeFavoriteAssistants, writeRecentAssistants } from '@/features/assistants/assistantPreferences'
import { KnowledgeBasePanel } from '@/features/knowledge/KnowledgeBasePanel'
import { modelKey } from '@/features/models/modelMetadata'
import { ProviderModelPicker } from '@/features/models/ProviderModelPicker'

function messageOf(error: unknown) {
  if (error instanceof ApiError && typeof error.detail === 'object' && error.detail) {
    const detail = error.detail as { message?: string }
    return detail.message ?? error.message
  }
  return error instanceof Error ? error.message : 'Request failed'
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

function AssistantLibraryPage({
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

export function LibraryPage({
  backpacks, conversation, knowledgeBases, memories, presets, uploads, models, providers, selectedModel, onModel, onMemory, onMemoryUpdate, onMemoryDelete, onPreset, onPresetDelete, onStartAssistant, onUpload, onKnowledgeBaseCreate, onKnowledgeBaseUpdate, onKnowledgeBaseDelete, onKnowledgeBaseBind,
}: {
  backpacks: BackpackRecord[]; conversation: Conversation | null; knowledgeBases: KnowledgeBase[]; memories: Memory[]; presets: Preset[]; uploads: Upload[]
  models: ModelSummary[]; providers: ProviderSummary[]; selectedModel: string; onModel: (value: string) => void
  onMemory: (content: string) => Promise<void>; onMemoryUpdate: (id: string, payload: { status?: Memory['status']; pinned?: boolean }) => Promise<void>; onMemoryDelete: (id: string) => Promise<void>; onPreset: (name: string, prompt: string) => Promise<void>; onPresetDelete: (id: string) => Promise<void>; onStartAssistant: (preset: Preset) => Promise<void>; onUpload: (file: File) => Promise<void>
  onKnowledgeBaseCreate: (payload: KnowledgeBaseCreate) => Promise<KnowledgeBase>; onKnowledgeBaseUpdate: (id: string, payload: KnowledgeBaseCreate) => Promise<KnowledgeBase>; onKnowledgeBaseDelete: (id: string) => Promise<void>; onKnowledgeBaseBind: (id: string | null) => Promise<void>
}) {
  return <div className="library-route"><Tabs defaultValue="assistants"><TabsList aria-label="Library sections" className="library-section-tabs"><TabsTrigger value="assistants"><Sparkles /> Assistants</TabsTrigger><TabsTrigger value="knowledge"><Database /> Knowledge bases</TabsTrigger></TabsList><TabsContent value="assistants"><AssistantLibraryPage conversationId={conversation?.id ?? null} memories={memories} models={models} onMemory={onMemory} onMemoryDelete={onMemoryDelete} onMemoryUpdate={onMemoryUpdate} onModel={onModel} onPreset={onPreset} onPresetDelete={onPresetDelete} onStartAssistant={onStartAssistant} onUpload={onUpload} presets={presets} providers={providers} selectedModel={selectedModel} uploads={uploads} /></TabsContent><TabsContent value="knowledge"><Surface eyebrow="Curated local context" title="Knowledge bases" description="Combine local files, memories, backpacks, and related-chat retrieval into a reusable source set."><KnowledgeBasePanel backpacks={backpacks} conversation={conversation} knowledgeBases={knowledgeBases} memories={memories} onBind={onKnowledgeBaseBind} onCreate={onKnowledgeBaseCreate} onDelete={onKnowledgeBaseDelete} onUpdate={onKnowledgeBaseUpdate} uploads={uploads} /></Surface></TabsContent></Tabs></div>
}
