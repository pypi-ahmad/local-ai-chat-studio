import { useMemo, useState } from 'react'
import { CirclePlus, Folder, MessageSquare, Search, Trash2 } from 'lucide-react'

import type { Conversation } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

function conversationDateGroup(updatedAt: string) {
  const updated = new Date(updatedAt)
  if (Number.isNaN(updated.getTime())) return 'Older'
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const age = startOfToday.getTime() - new Date(updated.getFullYear(), updated.getMonth(), updated.getDate()).getTime()
  if (age <= 0) return 'Today'
  if (age <= 86_400_000) return 'Yesterday'
  if (age <= 7 * 86_400_000) return 'Previous 7 days'
  return 'Older'
}

export function ConversationHistory({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  loading = false,
  mobile = false,
}: {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onUpdate: (id: string, payload: { title?: string; pinned?: boolean; folder?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  loading?: boolean
  mobile?: boolean
}) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const visible = conversations.filter((item) => `${item.title} ${item.folder ?? ''}`.toLowerCase().includes(normalizedQuery))
  const grouped = useMemo(() => {
    const groups: Array<{ key: string; label: string; items: Conversation[] }> = []
    const pinned = visible.filter((item) => item.pinned)
    if (pinned.length) groups.push({ key: 'pinned', label: 'Pinned', items: pinned })
    const remaining = visible.filter((item) => !item.pinned)
    const folders = [...new Set(remaining.map((item) => (item.folder ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    for (const folder of folders) groups.push({ key: `folder:${folder}`, label: folder, items: remaining.filter((item) => item.folder === folder) })
    const unfiled = remaining.filter((item) => !(item.folder ?? '').trim())
    for (const label of ['Today', 'Yesterday', 'Previous 7 days', 'Older']) {
      const items = unfiled.filter((item) => conversationDateGroup(item.updated_at) === label)
      if (items.length) groups.push({ key: `date:${label}`, label, items })
    }
    return groups
  }, [visible])
  const conversationRow = (conversation: Conversation) => (
    <div className={activeId === conversation.id ? 'conversation active' : 'conversation'} key={conversation.id}>
      <button className="conversation-select" onClick={() => onSelect(conversation.id)} type="button"><span>{conversation.title}</span></button>
      <div className="conversation-tools">
        <Button aria-label={`Rename ${conversation.title}`} onClick={async () => { const title = window.prompt('Conversation title', conversation.title); if (title?.trim()) await onUpdate(conversation.id, { title: title.trim() }) }} size="icon-sm" variant="ghost">✎</Button>
        <Button aria-label={`Move ${conversation.title} to folder`} onClick={async () => { const folder = window.prompt('Folder name (leave blank for no folder)', conversation.folder ?? ''); if (folder !== null) await onUpdate(conversation.id, { folder: folder.trim() }) }} size="icon-sm" variant="ghost"><Folder /></Button>
        <Button aria-label={`${conversation.pinned ? 'Unpin' : 'Pin'} ${conversation.title}`} onClick={() => onUpdate(conversation.id, { pinned: !conversation.pinned })} size="icon-sm" variant="ghost">⌖</Button>
        <Button aria-label={`Delete ${conversation.title}`} onClick={() => onDelete(conversation.id)} size="icon-sm" variant="ghost"><Trash2 /></Button>
      </div>
    </div>
  )
  return (
    <aside aria-label="Conversation history" className={mobile ? 'history-pane mobile-history' : 'history-pane'}>
      <div className="history-header">
        <div><p className="eyebrow">Local workspace</p><h1>Studio</h1></div>
        <Button aria-label="New conversation" onClick={onCreate} size="icon-sm" variant="outline"><CirclePlus /></Button>
      </div>
      <div className="search-wrap"><Search /><Input aria-label="Search conversations" onChange={(event) => setQuery(event.target.value)} placeholder="Search chats" value={query} /></div>
      <ScrollArea className="history-list">
        {loading && <div aria-label="Loading conversations" className="history-skeletons">{Array.from({ length: 4 }, (_, index) => <Skeleton data-testid="conversation-skeleton" key={index} />)}</div>}
        {!loading && grouped.map((group) => <section className="conversation-group" key={group.key}><p className="section-label">{group.label}</p>{group.items.map(conversationRow)}</section>)}
        {!loading && !visible.length && <div className="history-empty"><MessageSquare /><strong>{query ? 'No matching chats' : 'Start a conversation'}</strong><span>{query ? 'Try another title or folder.' : 'Create a chat to begin building your local workspace.'}</span>{!query && <Button onClick={onCreate} size="sm" variant="outline"><CirclePlus /> New chat</Button>}</div>}
      </ScrollArea>
      <div className="local-badge"><span className="pulse" /><div><strong>Local by default</strong><small>Cloud context starts prompt-only</small></div></div>
    </aside>
  )
}
