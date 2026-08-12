import { useState } from 'react'
import {
  Activity,
  Bot,
  Brain,
  ChevronDown,
  CirclePlus,
  Command,
  GitCompareArrows,
  MessageSquare,
  Paperclip,
  PlugZap,
  Search,
  Send,
  Settings,
  Sparkles,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { TooltipProvider } from '@/components/ui/tooltip'

type Page = 'Chat' | 'Compare' | 'Assistants' | 'Providers' | 'Memory' | 'Activity' | 'Settings'

const navigation = [
  ['Chat', MessageSquare],
  ['Compare', GitCompareArrows],
  ['Assistants', Bot],
  ['Providers', PlugZap],
  ['Memory', Brain],
  ['Activity', Activity],
  ['Settings', Settings],
] as const

const providers = [
  { name: 'Ollama', description: 'Local runtime', status: 'Available' },
  { name: 'OpenAI', description: 'Cloud API', status: 'Not connected' },
  { name: 'Anthropic', description: 'Cloud API', status: 'Not connected' },
  { name: 'Google Gemini', description: 'Cloud API', status: 'Not connected' },
  { name: 'OpenRouter', description: 'Cloud API', status: 'Not connected' },
  { name: 'xAI (Grok)', description: 'Cloud API', status: 'Not connected' },
  { name: 'OmniRoute', description: 'Local gateway', status: 'Not connected' },
] as const

const genericPageCopy = {
  Compare: {
    eyebrow: 'Parallel model runs',
    description: 'Send one prompt to two models and compare latency, throughput, and output side by side.',
  },
  Assistants: {
    eyebrow: 'Reusable expertise',
    description: 'Create focused assistants with a system prompt, preferred model, and generation settings.',
  },
  Memory: {
    eyebrow: 'Your context',
    description: 'Review, pin, edit, or archive durable facts used to personalize conversations.',
  },
  Activity: {
    eyebrow: 'Run activity',
    description: 'Inspect sanitized model, token, latency, and error metadata without exposing prompt content.',
  },
  Settings: {
    eyebrow: 'Studio settings',
    description: 'Manage appearance, generation defaults, local data, imports, and privacy controls.',
  },
} as const

function Navigation({ page, onPage }: { page: Page; onPage: (page: Page) => void }) {
  return (
    <nav aria-label="Primary navigation" className="nav-rail">
      <div className="brand-mark" aria-label="Local AI Chat Studio"><Command data-icon="inline-start" /></div>
      <div className="nav-items">
        {navigation.map(([label, Icon]) => (
          <Button
            key={label}
            aria-label={label}
            aria-current={page === label ? 'page' : undefined}
            className="nav-button"
            onClick={() => onPage(label)}
            size="icon-lg"
            variant={page === label ? 'secondary' : 'ghost'}
          >
            <Icon data-icon="inline-start" />
          </Button>
        ))}
      </div>
      <div className="status-dot" title="Backend connected" />
    </nav>
  )
}

function ConversationHistory() {
  const conversations = ['Provider architecture', 'RAG evaluation notes', 'FastAPI streaming', 'Prompt experiments']
  return (
    <aside aria-label="Conversation history" className="history-pane">
      <div className="history-header">
        <div><p className="eyebrow">Workspace</p><h1>Studio</h1></div>
        <Button aria-label="New conversation" size="icon-sm" variant="outline"><CirclePlus data-icon="inline-start" /></Button>
      </div>
      <div className="search-wrap"><Search data-icon="inline-start" /><Input aria-label="Search conversations" placeholder="Search chats" /></div>
      <ScrollArea className="history-list">
        <p className="section-label">Today</p>
        {conversations.map((conversation, index) => (
          <button className={index === 0 ? 'conversation active' : 'conversation'} key={conversation} type="button">
            <span>{conversation}</span><small>{index === 0 ? 'Now' : `${index + 1}h`}</small>
          </button>
        ))}
      </ScrollArea>
      <div className="local-badge"><span className="pulse" /><div><strong>Local-first</strong><small>Data stays on this device</small></div></div>
    </aside>
  )
}

function ChatWorkspace() {
  const [prompt, setPrompt] = useState('')
  const suggestions = ['Audit this architecture', 'Compare two approaches', 'Explain this codebase']
  return (
    <main aria-label="Chat workspace" className="workspace">
      <header className="workspace-header">
        <div><p className="eyebrow">Conversation</p><h2>Provider architecture</h2></div>
        <Button variant="outline">Ollama · qwen3 <ChevronDown data-icon="inline-end" /></Button>
      </header>
      <Separator />
      <ScrollArea className="message-area">
        <div className="welcome">
          <div className="spark"><Sparkles /></div>
          <Badge variant="outline">Coding assistant</Badge>
          <h3>What are we building?</h3>
          <p>Use any connected local or cloud model. Your credentials remain in this browser session.</p>
          <div className="suggestions">
            {suggestions.map((item) => <Button key={item} onClick={() => setPrompt(item)} variant="outline">{item}</Button>)}
          </div>
        </div>
      </ScrollArea>
      <div className="composer-shell">
        <Textarea aria-label="Message" onChange={(event) => setPrompt(event.target.value)} placeholder="Message your model…" value={prompt} />
        <div className="composer-actions">
          <Button aria-label="Attach file" size="icon-sm" variant="ghost"><Paperclip data-icon="inline-start" /></Button>
          <span>Enter to send · Shift+Enter for newline</span>
          <Button aria-label="Send message" disabled={!prompt.trim()} size="icon"><Send data-icon="inline-start" /></Button>
        </div>
      </div>
    </main>
  )
}

function ProvidersPage() {
  return (
    <main className="page-workspace">
      <div className="page-heading"><div><p className="eyebrow">Connections</p><h2>Providers</h2><p>Bring your own keys. Session credentials are never written to disk.</p></div><Badge>7 adapters</Badge></div>
      <div className="provider-grid">
        {providers.map((provider) => (
          <Card key={provider.name}>
            <CardHeader><div className="provider-title"><div className="provider-icon">{provider.name[0]}</div><div><CardTitle>{provider.name}</CardTitle><CardDescription>{provider.description}</CardDescription></div></div></CardHeader>
            <CardContent><div className="provider-footer"><Badge variant="outline">{provider.status}</Badge><Button size="sm" variant="outline">Configure</Button></div></CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}

function GenericPage({ page }: { page: keyof typeof genericPageCopy }) {
  const { eyebrow, description } = genericPageCopy[page]
  return <main className="page-workspace"><p className="eyebrow">{eyebrow}</p><h2>{page}</h2><p className="page-description">{description}</p><Card className="empty-card"><CardContent><Sparkles /><h3>{eyebrow}</h3><p>This workspace is connected to the v2 application shell.</p><Button>Get started</Button></CardContent></Card></main>
}

function PageContent({ page }: { page: Page }) {
  if (page === 'Chat') return <><ConversationHistory /><ChatWorkspace /></>
  if (page === 'Providers') return <ProvidersPage />
  return <GenericPage page={page} />
}

function App() {
  const [page, setPage] = useState<Page>('Chat')
  return <TooltipProvider><div className="app-shell"><Navigation onPage={setPage} page={page} /><PageContent page={page} /></div></TooltipProvider>
}

export default App
