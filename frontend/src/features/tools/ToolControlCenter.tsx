import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CircleOff, Fingerprint, PlugZap, RefreshCw, Server, ShieldCheck, Trash2, Wrench } from 'lucide-react'

import { api, type McpServer, type McpServerCreate, type McpTool, type ToolRequest } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

import './ToolControlCenter.css'

const messageOf = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)

function RequestCard({ request, onDecision }: { request: ToolRequest; onDecision: (id: string, decision: 'approve' | 'deny', reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('')
  const busy = request.status === 'running'
  return (
    <article className={`tool-request-card status-${request.status}`}>
      <header>
        <div><p className="eyebrow">{request.status === 'pending' ? 'Approval required' : 'Audit record'}</p><h3>{request.tool_name}</h3></div>
        <Badge variant={request.status === 'completed' ? 'outline' : request.status === 'pending' ? 'destructive' : 'secondary'}>{request.status}</Badge>
      </header>
      <div className="tool-request-route"><span>{request.server_name}</span><span>→</span><span>{request.origin}</span></div>
      <p>{request.rationale}</p>
      <pre aria-label="Exact tool arguments">{JSON.stringify(request.arguments ?? request.arguments_preview, null, 2)}</pre>
      <div className="execution-hash"><Fingerprint /><code>{request.argument_hash}</code></div>
      {request.status === 'pending' && <div className="approval-actions">
        <Input aria-label="Approval reason" onChange={(event) => setReason(event.target.value)} placeholder="Why is this action allowed or denied?" value={reason} />
        <Button disabled={!reason.trim() || busy} onClick={() => void onDecision(request.id, 'approve', reason)}><ShieldCheck /> Approve and run</Button>
        <Button disabled={!reason.trim() || busy} onClick={() => void onDecision(request.id, 'deny', reason)} variant="outline"><CircleOff /> Deny</Button>
      </div>}
      {request.decision_reason && <small>Decision: {request.decision_reason}</small>}
      {request.result_preview && <div className="tool-result"><strong>Result preview</strong><pre>{request.result_preview}</pre></div>}
      {request.error && <p className="error-text">{request.error}</p>}
    </article>
  )
}

export function ToolControlCenter() {
  const [servers, setServers] = useState<McpServer[]>([])
  const [selectedServerId, setSelectedServerId] = useState('')
  const [tools, setTools] = useState<McpTool[]>([])
  const [selectedTool, setSelectedTool] = useState('')
  const [requests, setRequests] = useState<ToolRequest[]>([])
  const [argumentsText, setArgumentsText] = useState('{}')
  const [rationale, setRationale] = useState('')
  const [origin, setOrigin] = useState<'user' | 'agent'>('agent')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [serverDraft, setServerDraft] = useState<McpServerCreate>({ name: '', transport: 'stdio', command: 'uvx', args: [], env_keys: [], url: null })
  const [argsText, setArgsText] = useState('')
  const [envText, setEnvText] = useState('')

  const selectedServer = servers.find((server) => server.id === selectedServerId)
  const tool = tools.find((item) => item.name === selectedTool)
  const pending = requests.filter((request) => request.status === 'pending')
  const history = requests.filter((request) => request.status !== 'pending')

  const refreshRequests = useCallback(async () => setRequests(await api.toolRequests()), [])
  const loadTools = useCallback(async (serverId: string) => {
    const found = await api.mcpTools(serverId)
    setTools(found)
    setSelectedTool((current) => found.some((item) => item.name === current) ? current : found[0]?.name ?? '')
  }, [])

  useEffect(() => {
    void Promise.all([api.mcpServers(), api.toolRequests()]).then(([foundServers, foundRequests]) => {
      setServers(foundServers)
      setRequests(foundRequests)
      const first = foundServers[0]
      if (first) {
        setSelectedServerId(first.id)
        if (first.tested_at) void loadTools(first.id)
      }
    }).catch((cause) => setError(messageOf(cause)))
  }, [loadTools])

  const exactInvocation = useMemo(() => selectedServer?.transport === 'stdio'
    ? JSON.stringify({ command: selectedServer.command, args: selectedServer.args, env_keys: selectedServer.env_keys }, null, 2)
    : selectedServer?.url ?? '', [selectedServer])

  const discover = async (server: McpServer) => {
    if (!window.confirm(`Connect to this MCP server and discover its tools?\n\n${server.command_preview}`)) return
    setBusy(true); setError('')
    try {
      const found = await api.discoverMcpTools(server.id)
      setTools(found); setSelectedTool(found[0]?.name ?? '')
      setServers(await api.mcpServers())
    } catch (cause) { setError(messageOf(cause)) } finally { setBusy(false) }
  }

  const createServer = async () => {
    setBusy(true); setError('')
    try {
      const payload: McpServerCreate = serverDraft.transport === 'stdio'
        ? { ...serverDraft, args: argsText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean), env_keys: envText.split(',').map((item) => item.trim()).filter(Boolean), url: null }
        : { name: serverDraft.name, transport: 'streamable_http', command: null, args: [], env_keys: [], url: serverDraft.url }
      const created = await api.createMcpServer(payload)
      setServers((current) => [created, ...current]); setSelectedServerId(created.id); setTools([]); setShowSetup(false)
    } catch (cause) { setError(messageOf(cause)) } finally { setBusy(false) }
  }

  const queue = async () => {
    if (!selectedServer || !tool) return
    setError('')
    try {
      const argumentsValue = JSON.parse(argumentsText) as Record<string, unknown>
      const created = await api.createToolRequest({ server_id: selectedServer.id, tool_name: tool.name, arguments: argumentsValue, rationale, origin, conversation_id: null })
      setRequests((current) => [created, ...current]); setRationale('')
    } catch (cause) { setError(messageOf(cause)) }
  }

  const decide = async (id: string, decision: 'approve' | 'deny', reason: string) => {
    setBusy(true); setError('')
    try {
      const updated = decision === 'approve' ? await api.approveToolRequest(id, reason) : await api.denyToolRequest(id, reason)
      setRequests((current) => current.map((item) => item.id === id ? updated : item))
      await refreshRequests()
    } catch (cause) { setError(messageOf(cause)) } finally { setBusy(false) }
  }

  return (
    <main className="tool-control page-shell">
      <header className="tool-hero">
        <div><p className="eyebrow">Guarded agent runtime</p><h1>Work Mode</h1><p>Connect MCP tools, inspect every proposed action, and keep a durable decision trail.</p></div>
        <div className="tool-safety-seal"><ShieldCheck /><span><strong>Approval locked</strong><small>No tool runs before a one-time decision</small></span></div>
      </header>

      <div className="tool-boundary-note"><Server /><p><strong>Security boundary</strong> Local stdio servers run without a shell, with a minimal environment and isolated working directory. This is not a full OS sandbox; only connect servers you trust.</p></div>
      {error && <div className="error-banner">{error}</div>}

      <section className="tool-control-grid">
        <div className="tool-column">
          <header className="column-heading"><div><p className="eyebrow">01 · Connections</p><h2>MCP servers</h2></div><Button onClick={() => setShowSetup((value) => !value)} size="sm" variant="outline"><PlugZap /> Add server</Button></header>
          {showSetup && <div className="server-setup-card">
            <Input aria-label="Server name" onChange={(event) => setServerDraft({ ...serverDraft, name: event.target.value })} placeholder="Server name" value={serverDraft.name} />
            <label>Transport<select aria-label="MCP transport" onChange={(event) => setServerDraft({ ...serverDraft, transport: event.target.value as McpServerCreate['transport'] })} value={serverDraft.transport}><option value="stdio">Local stdio</option><option value="streamable_http">Remote HTTPS</option></select></label>
            {serverDraft.transport === 'stdio' ? <>
              <Input aria-label="Server command" onChange={(event) => setServerDraft({ ...serverDraft, command: event.target.value })} value={serverDraft.command ?? ''} />
              <Textarea aria-label="Server arguments" onChange={(event) => setArgsText(event.target.value)} placeholder="One argument per line" value={argsText} />
              <Input aria-label="Environment variable names" onChange={(event) => setEnvText(event.target.value)} placeholder="API_KEY_NAME, OTHER_KEY" value={envText} />
              <small>Only variable names are saved. Values are read from this process at launch and are never returned to the UI.</small>
            </> : <Input aria-label="Server URL" onChange={(event) => setServerDraft({ ...serverDraft, url: event.target.value })} placeholder="https://example.com/mcp" value={serverDraft.url ?? ''} />}
            <Button disabled={busy || !serverDraft.name.trim()} onClick={() => void createServer()}>Save without connecting</Button>
          </div>}
          <div className="server-stack">{servers.map((server) => <article className={server.id === selectedServerId ? 'server-card selected' : 'server-card'} key={server.id}>
            <button className="server-select" onClick={() => { setSelectedServerId(server.id); setTools([]); if (server.tested_at) void loadTools(server.id) }} type="button"><span className="server-icon"><Server /></span><span><strong>{server.name}</strong><small>{server.transport === 'stdio' ? 'Local stdio' : 'Remote HTTPS'} · {server.tested_at ? 'tested' : 'not tested'}</small></span></button>
            <div className="server-actions"><Button disabled={busy} onClick={() => void discover(server)} size="icon-sm" title="Connect and discover"><RefreshCw /></Button><Button disabled={busy} onClick={async () => { await api.deleteMcpServer(server.id); setServers(await api.mcpServers()); setTools([]) }} size="icon-sm" title="Remove server" variant="ghost"><Trash2 /></Button></div>
          </article>)}</div>
          {!servers.length && <p className="empty-copy">Add an MCP server. Saving a configuration does not start or connect it.</p>}
          {selectedServer && <details className="invocation-preview"><summary>Exact connection configuration</summary><pre>{exactInvocation}</pre></details>}
        </div>

        <div className="tool-column tool-catalog">
          <header className="column-heading"><div><p className="eyebrow">02 · Proposal</p><h2>Available tools</h2></div><Badge variant="outline">{tools.length}</Badge></header>
          <div className="tool-tabs">{tools.map((item) => <button aria-pressed={item.name === selectedTool} key={item.name} onClick={() => setSelectedTool(item.name)} type="button"><Wrench /> {item.title || item.name}</button>)}</div>
          {tool ? <div className="tool-proposal">
            <div><h3>{tool.title || tool.name}</h3><p>{tool.description || 'No description supplied by this MCP server.'}</p></div>
            <details><summary>Input schema</summary><pre>{JSON.stringify(tool.input_schema, null, 2)}</pre></details>
            <Textarea aria-label="Tool arguments" onChange={(event) => setArgumentsText(event.target.value)} rows={7} spellCheck={false} value={argumentsText} />
            <Textarea aria-label="Tool rationale" onChange={(event) => setRationale(event.target.value)} placeholder="Why does this action help the current task?" value={rationale} />
            <label>Request origin<select aria-label="Request origin" onChange={(event) => setOrigin(event.target.value as 'user' | 'agent')} value={origin}><option value="agent">Agent proposed</option><option value="user">User initiated</option></select></label>
            <Button disabled={!rationale.trim()} onClick={() => void queue()}><Fingerprint /> Request approval</Button>
          </div> : <p className="empty-copy">Select a tested server or connect and discover its tools.</p>}
        </div>

        <div className="tool-column approval-column">
          <header className="column-heading"><div><p className="eyebrow">03 · Decision</p><h2>Approval inbox</h2></div><Badge variant={pending.length ? 'destructive' : 'outline'}>{pending.length}</Badge></header>
          {pending.map((request) => <RequestCard key={request.id} onDecision={decide} request={request} />)}
          {!pending.length && <div className="approval-empty"><CheckCircle2 /><strong>No action is waiting</strong><span>Proposed tools appear here before execution.</span></div>}
        </div>
      </section>

      <section className="audit-section"><header className="column-heading"><div><p className="eyebrow">Flight recorder</p><h2>Tool audit log</h2></div><Button onClick={() => void refreshRequests()} size="sm" variant="ghost"><RefreshCw /> Refresh</Button></header><div className="audit-grid">{history.map((request) => <RequestCard key={request.id} onDecision={decide} request={request} />)}{!history.length && <p className="empty-copy">Completed, denied, and failed requests remain here for review.</p>}</div></section>
    </main>
  )
}
