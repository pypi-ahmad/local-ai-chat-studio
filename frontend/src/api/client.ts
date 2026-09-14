// Typed HTTP client for the backend API. Responsible for building requests,
// normalizing error responses into ApiError, and parsing the SSE run-event
// stream; must not contain UI or React state — callers (App.tsx and the
// route/feature components) own all of that. Response/request shapes below
// are re-exported from the generated `./schema` (see that file's header —
// it's produced by openapi-typescript and should not be hand-edited).
import type { components } from './schema'

export type Conversation = components['schemas']['Conversation']
export type ConversationSettings = components['schemas']['ConversationSettings']
export type ContextPlan = components['schemas']['ContextPlan']
export type TurnPreflight = components['schemas']['TurnPreflight']
export type ReasoningEffort = NonNullable<TurnPreflight['reasoning_effort']>
export type TurnCreate = components['schemas']['TurnCreate']
export type RunCreate = components['schemas']['RunCreate']
export type RunSnapshot = components['schemas']['RunSnapshot']
// On-wire shape of one Server-Sent Event frame from the run stream, after
// JSON-decoding the `data:` line. `type` is a discriminant the caller
// switches on (e.g. 'run.delta' | 'run.completed' | 'run.failed' — see
// App.tsx's submitTurn); `data`'s shape depends on `type` and isn't
// otherwise typed here, so callers must narrow it themselves.
export type RunEvent = { type: string; run_id: string; data: Record<string, unknown>; timestamp: string }
export type ProviderPolicy = components['schemas']['ProviderPolicy']
export type Backpack = components['schemas']['Backpack']
export type FocusSession = components['schemas']['FocusSession']
export type KnowledgeBase = components['schemas']['KnowledgeBase']
export type KnowledgeBaseCreate = components['schemas']['KnowledgeBaseCreate']
export type Memory = components['schemas']['Memory']
export type Preset = components['schemas']['Preset']
export type Upload = components['schemas']['Upload']
export type ReplayBundle = components['schemas']['ReplayBundle']
export type McpServer = components['schemas']['McpServer']
export type McpServerCreate = components['schemas']['McpServerCreate']
export type McpTool = components['schemas']['McpTool']
export type ToolRequest = components['schemas']['ToolRequest']
export type ToolRequestCreate = components['schemas']['ToolRequestCreate']
export type ConversationExportFormat = 'markdown' | 'html' | 'txt' | 'json'

export type ProviderSummary = {
  id: string
  label: string
  key_source: string | null
  auth_modes: string[]
  connected: boolean
  health: string
}
export type OpenCodeAuthMethod = { type: 'oauth'; label: string; method: number }
export type OpenCodeAuthStart = { url: string; method: 'auto' | 'code'; instructions: string }
export type ModelSummary = {
  provider: string
  id: string
  label?: string | null
  context_length?: number | null
  capabilities?: string[]
  reasoning_efforts?: ReasoningEffort[]
  pricing?: {
    input_per_million: number
    output_per_million: number
    source_url: string
    as_of: string
  } | null
}

// Wraps every non-2xx HTTP response from the backend. `detail` carries the
// raw, untrusted response body (or plain statusText as a last resort) so
// callers can decide how to surface it; it is not guaranteed to be a string
// (see messageOf() in App.tsx for how callers narrow it safely).
export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(status: number, detail: unknown) {
    super(typeof detail === 'string' ? detail : `API request failed (${status})`)
    this.status = status
    this.detail = detail
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    // The backend's error body is JSON with a `detail` field, but a proxy or
    // network layer in front of it could return something else (or nothing
    // parseable) — fall back to statusText rather than letting .json() throw.
    const body = await response.json().catch(() => ({ detail: response.statusText }))
    throw new ApiError(response.status, body.detail ?? body)
  }
  // A 204 has no body; response.json() would throw on the empty string, so
  // short-circuit to undefined instead of trying to parse it.
  return response.status === 204 ? (undefined as T) : response.json()
}

async function requestText(path: string): Promise<string> {
  const response = await fetch(`/api/v1${path}`, { credentials: 'same-origin' })
  if (!response.ok) throw new ApiError(response.status, response.statusText)
  return response.text()
}

export async function streamRun(
  runId: string,
  onEvent: (event: RunEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`/api/v1/runs/${runId}/events`, {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok || !response.body) throw new ApiError(response.status, 'Run stream unavailable')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  // Minimal SSE parser: frames are separated by a blank line, and a chunk
  // read from the stream can end mid-frame, so any trailing partial frame
  // is kept in `buffer` and prefixed onto the next chunk rather than parsed.
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      // Only the `data:` line is consumed; an `event:` line (if present,
      // see the mocked streams in App.test.tsx) is currently ignored since
      // the payload's own `type` field is the discriminant callers use.
      const data = frame.split('\n').find((line) => line.startsWith('data: '))
      if (data) onEvent(JSON.parse(data.slice(6)) as RunEvent)
    }
    if (done) break
  }
}

export const api = {
  health: () => request<{ status: string; version: string }>('/health'),
  runtimeHealth: () => request<{ ollama_available: boolean; running_models: { name: string; size_gb: number }[] }>('/runtime/health'),
  // Backend rejects this endpoint without the header, so it can't be
  // triggered by anything other than the local UI (see CODEBASE.md).
  shutdown: () => request<{ status: string }>('/runtime/shutdown', {
    method: 'POST', headers: { 'X-Local-Studio': 'shutdown' },
  }),
  profile: () => request<{ content: string }>('/profile'),
  setProfile: (content: string) => request<{ content: string }>('/profile', { method: 'PUT', body: JSON.stringify({ content }) }),
  sanitize: (content: string) =>
    request<{ content: string }>('/safety/sanitize', { method: 'POST', body: JSON.stringify({ content }) }),
  conversations: (query = '') =>
    request<Conversation[]>(`/conversations${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  conversation: (id: string) => request<Conversation>(`/conversations/${id}`),
  createConversation: (title = 'New chat', settings?: ConversationSettings) =>
    request<Conversation>('/conversations', { method: 'POST', body: JSON.stringify({ title, settings }) }),
  updateConversation: (id: string, payload: components['schemas']['ConversationUpdate']) =>
    request<Conversation>(`/conversations/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteConversation: (id: string) => request<void>(`/conversations/${id}`, { method: 'DELETE' }),
  branchConversation: (id: string, messageId: string, title = 'Branch') =>
    request<Conversation>(`/conversations/${id}/branch`, {
      method: 'POST', body: JSON.stringify({ message_id: messageId, title }),
    }),
  preflight: (conversationId: string, payload: TurnPreflight) =>
    request<ContextPlan>(`/conversations/${conversationId}/turns/preflight`, {
      method: 'POST', body: JSON.stringify(payload),
    }),
  createTurn: (conversationId: string, payload: TurnCreate) =>
    request<RunSnapshot>(`/conversations/${conversationId}/turns`, {
      method: 'POST', body: JSON.stringify(payload),
    }),
  createRun: (payload: RunCreate) =>
    request<RunSnapshot>('/runs', { method: 'POST', body: JSON.stringify(payload) }),
  cancelRun: (runId: string) => request<RunSnapshot>(`/runs/${runId}`, { method: 'DELETE' }),
  providers: () => request<{ providers: ProviderSummary[] }>('/providers'),
  models: () => request<Record<string, { provider: string; models: ModelSummary[]; error?: string }>>('/providers/models'),
  mcpServers: () => request<McpServer[]>('/mcp/servers'),
  createMcpServer: (payload: McpServerCreate) =>
    request<McpServer>('/mcp/servers', { method: 'POST', body: JSON.stringify(payload) }),
  deleteMcpServer: (id: string) => request<void>(`/mcp/servers/${id}`, { method: 'DELETE' }),
  discoverMcpTools: (id: string) =>
    request<McpTool[]>(`/mcp/servers/${id}/discover`, { method: 'POST' }),
  mcpTools: (id: string) => request<McpTool[]>(`/mcp/servers/${id}/tools`),
  toolRequests: () => request<ToolRequest[]>('/tool-requests'),
  createToolRequest: (payload: ToolRequestCreate) =>
    request<ToolRequest>('/tool-requests', { method: 'POST', body: JSON.stringify(payload) }),
  approveToolRequest: (id: string, reason: string) =>
    request<ToolRequest>(`/tool-requests/${id}/approve`, { method: 'POST', body: JSON.stringify({ reason }) }),
  denyToolRequest: (id: string, reason: string) =>
    request<ToolRequest>(`/tool-requests/${id}/deny`, { method: 'POST', body: JSON.stringify({ reason }) }),
  setCredential: (provider: string, apiKey: string) =>
    request<void>(`/providers/${provider}/credential`, { method: 'PUT', body: JSON.stringify({ api_key: apiKey }) }),
  removeCredential: (provider: string) => request<void>(`/providers/${provider}/credential`, { method: 'DELETE' }),
  startOpenRouterAuth: () => request<{ authorization_url: string }>('/providers/openrouter/auth/start', { method: 'POST' }),
  openCodeAuthMethods: () => request<Record<string, OpenCodeAuthMethod[]>>('/providers/opencode-bridge/auth/methods'),
  startOpenCodeAuth: (provider: string, method: number) =>
    request<OpenCodeAuthStart>(`/providers/opencode-bridge/auth/${provider}/start`, {
      method: 'POST', body: JSON.stringify({ method }),
    }),
  completeOpenCodeAuth: (provider: string, method: number, code?: string) =>
    request<{ connected: boolean }>(`/providers/opencode-bridge/auth/${provider}/complete`, {
      method: 'POST', body: JSON.stringify({ method, code }),
    }),
  providerPolicy: (provider: string) => request<ProviderPolicy>(`/providers/${provider}/policy`),
  setProviderPolicy: (provider: string, policy: ProviderPolicy) =>
    request<ProviderPolicy>(`/providers/${provider}/policy`, { method: 'PUT', body: JSON.stringify(policy) }),
  memories: () => request<Memory[]>('/memories'),
  createMemory: (content: string, category = 'fact') =>
    request<Memory>('/memories', { method: 'POST', body: JSON.stringify({ content, category }) }),
  updateMemory: (id: string, payload: { status?: Memory['status']; pinned?: boolean; content?: string; category?: string }) =>
    request<Memory>(`/memories/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteMemory: (id: string) => request<void>(`/memories/${id}`, { method: 'DELETE' }),
  extractMemories: (conversationId: string, payload: { provider: string; model: string; cloud_confirmed: boolean }) =>
    request<{ saved: number; quarantined: number; discarded: number }>(`/conversations/${conversationId}/memories/extract`, {
      method: 'POST', body: JSON.stringify(payload),
    }),
  presets: () => request<Preset[]>('/presets'),
  createPreset: (payload: Omit<Preset, 'id'>) =>
    request<Preset>('/presets', { method: 'POST', body: JSON.stringify(payload) }),
  deletePreset: (id: string) => request<void>(`/presets/${id}`, { method: 'DELETE' }),
  backpacks: () => request<Backpack[]>('/backpacks'),
  createBackpack: (name: string, title: string, content: string) =>
    request<Backpack>('/backpacks', {
      method: 'POST', body: JSON.stringify({ name, items: [{ title, content }] }),
    }),
  knowledgeBases: () => request<KnowledgeBase[]>('/knowledge-bases'),
  createKnowledgeBase: (payload: KnowledgeBaseCreate) =>
    request<KnowledgeBase>('/knowledge-bases', { method: 'POST', body: JSON.stringify(payload) }),
  updateKnowledgeBase: (id: string, payload: KnowledgeBaseCreate) =>
    request<KnowledgeBase>(`/knowledge-bases/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteKnowledgeBase: (id: string) => request<void>(`/knowledge-bases/${id}`, { method: 'DELETE' }),
  createFocus: (payload: {
    conversation_id: string; objective: string; success_criteria: string; constraints: string[]
  }) => request<FocusSession>('/focus-sessions', { method: 'POST', body: JSON.stringify(payload) }),
  focusSessions: (conversationId?: string) =>
    request<FocusSession[]>(`/focus-sessions${conversationId ? `?conversation_id=${encodeURIComponent(conversationId)}` : ''}`),
  updateFocus: (id: string, status: 'completed' | 'abandoned') =>
    request<FocusSession>(`/focus-sessions/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  upload: (conversationId: string, filename: string, contentBase64: string) =>
    request<Upload>('/uploads', {
      method: 'POST',
      body: JSON.stringify({ conversation_id: conversationId, filename, content_base64: contentBase64 }),
    }),
  uploads: (conversationId: string) => request<Upload[]>(`/conversations/${conversationId}/uploads`),
  deleteUpload: (uploadId: string) => request<void>(`/uploads/${uploadId}`, { method: 'DELETE' }),
  activity: () => request<RunSnapshot[]>('/activity'),
  bundle: (runId: string, mode: 'full' | 'redacted' = 'full') =>
    request<ReplayBundle>(`/runs/${runId}/bundle?mode=${mode}`),
  replay: (runId: string, provider: string, model: string) =>
    request<RunSnapshot>(`/runs/${runId}/replay`, {
      method: 'POST', body: JSON.stringify({ provider, model }),
    }),
  diff: (leftId: string, rightId: string) =>
    request<{ changed: boolean; diff: string }>(`/runs/${leftId}/diff/${rightId}`),
  setFeedback: (messageId: string, rating: -1 | 1) =>
    request<void>(`/messages/${messageId}/feedback`, { method: 'PUT', body: JSON.stringify({ rating }) }),
  conversationMarkdown: (id: string) => requestText(`/conversations/${id}/export.md`),
  conversationExport: (id: string, format: ConversationExportFormat) =>
    requestText(`/conversations/${id}/export/${format}`),
  exportData: () => request<{ jsonl: string }>('/data/export'),
  importData: (jsonl: string) =>
    request<{ imported: number }>('/data/import', { method: 'POST', body: JSON.stringify({ jsonl }) }),
  // The literal confirmation strings must match the backend's required
  // literal exactly (see backend/app/contracts.py) — a guard against
  // accidentally invoking these destructive endpoints, not a secret.
  importV2: () => request<{ imported: number }>('/data/import-v2', { method: 'POST', body: JSON.stringify({ confirmation: 'IMPORT_V2' }) }),
  wipeData: () => request<void>('/data/wipe', { method: 'POST', body: JSON.stringify({ confirmation: 'WIPE' }) }),
  simulateProvider: (provider: string, scenario: string, fallbackProvider?: string) =>
    request<{ recovered: boolean; events: { type: string; provider: string; message: string }[] }>(`/providers/${provider}/simulate`, {
      method: 'POST', body: JSON.stringify({ scenario, fallback_provider: fallbackProvider || null }),
    }),
}
