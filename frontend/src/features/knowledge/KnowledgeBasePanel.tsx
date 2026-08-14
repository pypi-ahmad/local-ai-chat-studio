import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Backpack, Brain, Database, FileText, Link2, Pencil, Plus, Search, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type {
  Backpack as BackpackRecord,
  Conversation,
  KnowledgeBase,
  KnowledgeBaseCreate,
  Memory,
  Upload,
} from '@/api/client'

import './KnowledgeBasePanel.css'

type KnowledgeBasePanelProps = {
  backpacks: BackpackRecord[]
  conversation: Conversation | null
  knowledgeBases: KnowledgeBase[]
  memories: Memory[]
  uploads: Upload[]
  onBind: (id: string | null) => Promise<void>
  onCreate: (payload: KnowledgeBaseCreate) => Promise<KnowledgeBase>
  onDelete: (id: string) => Promise<void>
  onUpdate: (id: string, payload: KnowledgeBaseCreate) => Promise<KnowledgeBase>
}

const sourceKey = (kind: 'upload' | 'memory' | 'backpack', id: string) => `${kind}:${id}`

export function KnowledgeBasePanel({
  backpacks,
  conversation,
  knowledgeBases,
  memories,
  uploads,
  onBind,
  onCreate,
  onDelete,
  onUpdate,
}: KnowledgeBasePanelProps) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(knowledgeBases[0]?.id ?? null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [includeRetrieval, setIncludeRetrieval] = useState(true)
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (selectedId && knowledgeBases.some((item) => item.id === selectedId)) return
    setSelectedId(knowledgeBases[0]?.id ?? null)
  }, [knowledgeBases, selectedId])

  const selected = knowledgeBases.find((item) => item.id === selectedId) ?? null
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return knowledgeBases
    return knowledgeBases.filter((item) => `${item.name} ${item.description} ${item.sources.map((source) => source.title).join(' ')}`.toLowerCase().includes(normalized))
  }, [knowledgeBases, query])
  const activeMemories = memories.filter((item) => item.status === 'active')
  const bound = conversation?.settings?.knowledge_base_id === selected?.id

  const beginNew = () => {
    setSelectedId(null)
    setName('')
    setDescription('')
    setIncludeRetrieval(true)
    setSelectedSources(new Set())
    setError('')
    setEditing(true)
  }

  const beginEdit = (item: KnowledgeBase) => {
    setSelectedId(item.id)
    setName(item.name)
    setDescription(item.description)
    setIncludeRetrieval(item.include_retrieval)
    setSelectedSources(new Set(item.sources.map((source) => sourceKey(source.kind, source.source_id))))
    setError('')
    setEditing(true)
  }

  const toggleSource = (key: string) => {
    setSelectedSources((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const save = async () => {
    if (!name.trim()) return
    const sources: NonNullable<KnowledgeBaseCreate['sources']> = [
      ...uploads.filter((item) => selectedSources.has(sourceKey('upload', item.id))).map((item) => ({ kind: 'upload' as const, source_id: item.id })),
      ...activeMemories.filter((item) => selectedSources.has(sourceKey('memory', item.id))).map((item) => ({ kind: 'memory' as const, source_id: item.id })),
      ...backpacks.filter((item) => selectedSources.has(sourceKey('backpack', item.id))).map((item) => ({ kind: 'backpack' as const, source_id: item.id })),
    ]
    const payload: KnowledgeBaseCreate = { name: name.trim(), description: description.trim(), include_retrieval: includeRetrieval, sources }
    setBusy(true)
    setError('')
    try {
      const saved = selected ? await onUpdate(selected.id, payload) : await onCreate(payload)
      setSelectedId(saved.id)
      setEditing(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this knowledge base.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!selected || !window.confirm(`Delete “${selected.name}”? Conversations will be unbound, but source files and memories will remain.`)) return
    setBusy(true)
    setError('')
    try {
      await onDelete(selected.id)
      setSelectedId(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete this knowledge base.')
    } finally {
      setBusy(false)
    }
  }

  const changeBinding = async (id: string | null) => {
    setBusy(true)
    setError('')
    try {
      await onBind(id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this conversation binding.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="knowledge-base-heading" className="knowledge-base-workspace">
      <header className="knowledge-base-hero">
        <div className="knowledge-base-mark"><Database aria-hidden="true" /></div>
        <div><span className="section-label">Knowledge workspace</span><h2 id="knowledge-base-heading">Knowledge bases for focused chats</h2><p>Group local sources once, then bind one curated base to a conversation.</p></div>
        <Button onClick={beginNew}><Plus /> New knowledge base</Button>
      </header>

      <div className="knowledge-base-layout">
        <aside className="knowledge-base-index">
          <label className="knowledge-base-search"><Search aria-hidden="true" /><Input aria-label="Search knowledge bases" onChange={(event) => setQuery(event.target.value)} placeholder="Search bases or sources" type="search" value={query} /></label>
          <div className="knowledge-base-list">
            {filtered.map((item) => (
              <button className={item.id === selectedId ? 'knowledge-base-card active' : 'knowledge-base-card'} key={item.id} onClick={() => { setSelectedId(item.id); setEditing(false); setError('') }} type="button">
                <span className="knowledge-base-card-rail" />
                <span><strong>{item.name}</strong><small>{item.sources.length} {item.sources.length === 1 ? 'source' : 'sources'} · {item.include_retrieval ? 'retrieval on' : 'curated only'}</small></span>
                {conversation?.settings?.knowledge_base_id === item.id && <Badge>bound</Badge>}
              </button>
            ))}
            {!filtered.length && <div className="knowledge-base-empty"><Database /><strong>{knowledgeBases.length ? 'No matching bases' : 'No knowledge bases yet'}</strong><p>{knowledgeBases.length ? 'Try another source or base name.' : 'Create one from files, memories, and backpacks.'}</p></div>}
          </div>
        </aside>

        <div className="knowledge-base-detail">
          {editing ? (
            <div className="knowledge-base-editor">
              <div className="knowledge-base-detail-heading"><div><span className="section-label">{selected ? 'Edit base' : 'New base'}</span><h3>{selected ? selected.name : 'Assemble local knowledge'}</h3></div></div>
              <div className="knowledge-base-fields">
                <label><span>Knowledge base name</span><Input aria-label="Knowledge base name" autoFocus maxLength={100} onChange={(event) => setName(event.target.value)} placeholder="Product launch research" value={name} /></label>
                <label><span>Knowledge base description</span><Textarea aria-label="Knowledge base description" maxLength={500} onChange={(event) => setDescription(event.target.value)} placeholder="What belongs here, and when should the assistant use it?" value={description} /></label>
              </div>
              <label className="knowledge-retrieval-toggle"><input checked={includeRetrieval} onChange={(event) => setIncludeRetrieval(event.target.checked)} type="checkbox" /><span><strong>Include related conversation retrieval</strong><small>Search earlier local conversations alongside these selected sources.</small></span></label>
              <div className="knowledge-source-groups">
                <SourceGroup empty="Upload a file to the current conversation first." icon={<FileText />} title="Current chat files">
                  {uploads.map((item) => <SourceChoice checked={selectedSources.has(sourceKey('upload', item.id))} key={item.id} label={`File: ${item.filename}`} meta={`${Math.ceil(item.size / 1024)} KB · ${item.kind}`} onChange={() => toggleSource(sourceKey('upload', item.id))} />)}
                </SourceGroup>
                <SourceGroup empty="Add or activate a memory first." icon={<Brain />} title="Active memories">
                  {activeMemories.map((item) => <SourceChoice checked={selectedSources.has(sourceKey('memory', item.id))} key={item.id} label={`Memory: ${item.content}`} meta={item.category} onChange={() => toggleSource(sourceKey('memory', item.id))} />)}
                </SourceGroup>
                <SourceGroup empty="Create a backpack on the Context page first." icon={<Backpack />} title="Backpacks">
                  {backpacks.map((item) => <SourceChoice checked={selectedSources.has(sourceKey('backpack', item.id))} key={item.id} label={`Backpack: ${item.name}`} meta={`${item.items.length} ${item.items.length === 1 ? 'item' : 'items'}`} onChange={() => toggleSource(sourceKey('backpack', item.id))} />)}
                </SourceGroup>
              </div>
              {error && <div className="error-strip" role="alert">{error}</div>}
              <div className="knowledge-base-actions"><Button disabled={busy || !name.trim()} onClick={save}>{busy ? 'Saving…' : 'Save knowledge base'}</Button><Button disabled={busy} onClick={() => { setEditing(false); setSelectedId(selected?.id ?? knowledgeBases[0]?.id ?? null) }} variant="ghost">Cancel</Button></div>
            </div>
          ) : selected ? (
            <div className="knowledge-base-summary">
              <div className="knowledge-base-detail-heading"><div><span className="section-label">Selected base</span><h3>{selected.name}</h3><p>{selected.description || 'No description provided.'}</p></div><div className="knowledge-base-detail-actions"><Button aria-label={`Edit ${selected.name}`} onClick={() => beginEdit(selected)} size="icon-sm" variant="outline"><Pencil /></Button><Button aria-label={`Delete ${selected.name}`} disabled={busy} onClick={remove} size="icon-sm" variant="ghost"><Trash2 /></Button></div></div>
              <div className="knowledge-base-metrics"><div><strong>{selected.sources.length}</strong><small>Local sources</small></div><div><strong>{selected.include_retrieval ? 'On' : 'Off'}</strong><small>Related retrieval</small></div><div><strong>{selected.sources.filter((source) => source.available).length}</strong><small>Ready now</small></div></div>
              <div className="knowledge-source-ledger">
                <div className="knowledge-source-ledger-heading"><span>Source ledger</span><small>Content remains in its original local store.</small></div>
                {selected.sources.map((source) => <div className="knowledge-source-row" key={sourceKey(source.kind, source.source_id)}><span className={`knowledge-source-icon ${source.kind}`}>{source.kind === 'upload' ? <FileText /> : source.kind === 'memory' ? <Brain /> : <Backpack />}</span><span><strong>{source.title}</strong><small>{source.preview || source.kind}</small></span><Badge variant={source.available ? 'outline' : 'destructive'}>{source.available ? source.kind : 'missing'}</Badge></div>)}
                {!selected.sources.length && <div className="knowledge-base-empty compact"><FileText /><strong>Curated retrieval only</strong><p>Edit this base to add explicit sources.</p></div>}
              </div>
              {error && <div className="error-strip" role="alert">{error}</div>}
              <div className="knowledge-binding">
                <div><Link2 /><span><strong>{bound ? `Bound to ${conversation?.title}` : 'Bind to the current chat'}</strong><small>{conversation ? 'Only one knowledge base can be active for this conversation.' : 'Select a conversation before binding a base.'}</small></span></div>
                {bound ? <Button aria-label={`Unbind ${selected.name} from current chat`} disabled={busy} onClick={() => void changeBinding(null)} variant="outline">Unbind</Button> : <Button aria-label={`Bind ${selected.name} to current chat`} disabled={busy || !conversation} onClick={() => void changeBinding(selected.id)}>Bind base</Button>}
              </div>
            </div>
          ) : (
            <div className="knowledge-base-empty detail"><Database /><h3>Select a knowledge base</h3><p>Review its source ledger, edit its scope, or bind it to the current chat.</p><Button onClick={beginNew}><Plus /> Create first base</Button></div>
          )}
        </div>
      </div>
    </section>
  )
}

function SourceGroup({ children, empty, icon, title }: { children: ReactNode; empty: string; icon: ReactNode; title: string }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return <section className="knowledge-source-group"><header>{icon}<span><strong>{title}</strong><small>{hasChildren ? 'Select any sources to include.' : empty}</small></span></header>{hasChildren && <div>{children}</div>}</section>
}

function SourceChoice({ checked, label, meta, onChange }: { checked: boolean; label: string; meta: string; onChange: () => void }) {
  return <label className="knowledge-source-choice"><input aria-label={label} checked={checked} onChange={onChange} type="checkbox" /><span><strong>{label.replace(/^(File|Memory|Backpack): /, '')}</strong><small>{meta}</small></span></label>
}
