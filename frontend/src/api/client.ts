import type { components } from './schema'

export type Conversation = components['schemas']['Conversation']
export type ContextPlan = components['schemas']['ContextPlan']
export type TurnPreflight = components['schemas']['TurnPreflight']
export type TurnCreate = components['schemas']['TurnCreate']
export type RunCreate = components['schemas']['RunCreate']
export type RunSnapshot = components['schemas']['RunSnapshot']
export type RunEvent = { type: string; run_id: string; data: Record<string, unknown>; timestamp: string }
export type ProviderPolicy = components['schemas']['ProviderPolicy']
export type Backpack = components['schemas']['Backpack']
export type FocusSession = components['schemas']['FocusSession']
export type Memory = components['schemas']['Memory']
export type Preset = components['schemas']['Preset']
export type Upload = components['schemas']['Upload']
export type ReplayBundle = components['schemas']['ReplayBundle']

export type ProviderSummary = { id: string; label: string; key_source: string | null }
export type ModelSummary = {
  provider: string
  id: string
  label?: string | null
  context_length?: number | null
  capabilities?: string[]
}

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
    const body = await response.json().catch(() => ({ detail: response.statusText }))
    throw new ApiError(response.status, body.detail ?? body)
  }
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
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      const data = frame.split('\n').find((line) => line.startsWith('data: '))
      if (data) onEvent(JSON.parse(data.slice(6)) as RunEvent)
    }
    if (done) break
  }
}

export const api = {
  health: () => request<{ status: string; version: string }>('/health'),
  runtimeHealth: () => request<{ ollama_available: boolean; running_models: { name: string; size_gb: number }[] }>('/runtime/health'),
  profile: () => request<{ content: string }>('/profile'),
  setProfile: (content: string) => request<{ content: string }>('/profile', { method: 'PUT', body: JSON.stringify({ content }) }),
  sanitize: (content: string) =>
    request<{ content: string }>('/safety/sanitize', { method: 'POST', body: JSON.stringify({ content }) }),
  conversations: (query = '') =>
    request<Conversation[]>(`/conversations${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  conversation: (id: string) => request<Conversation>(`/conversations/${id}`),
  createConversation: (title = 'New chat') =>
    request<Conversation>('/conversations', { method: 'POST', body: JSON.stringify({ title }) }),
  updateConversation: (id: string, payload: { title?: string; pinned?: boolean }) =>
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
  setCredential: (provider: string, apiKey: string) =>
    request<void>(`/providers/${provider}/credential`, { method: 'PUT', body: JSON.stringify({ api_key: apiKey }) }),
  removeCredential: (provider: string) => request<void>(`/providers/${provider}/credential`, { method: 'DELETE' }),
  startOpenRouterAuth: () => request<{ authorization_url: string }>('/providers/openrouter/auth/start', { method: 'POST' }),
  providerPolicy: (provider: string) => request<ProviderPolicy>(`/providers/${provider}/policy`),
  setProviderPolicy: (provider: string, policy: ProviderPolicy) =>
    request<ProviderPolicy>(`/providers/${provider}/policy`, { method: 'PUT', body: JSON.stringify(policy) }),
  memories: () => request<Memory[]>('/memories'),
  createMemory: (content: string, category = 'fact') =>
    request<Memory>('/memories', { method: 'POST', body: JSON.stringify({ content, category }) }),
  updateMemory: (id: string, payload: { status?: Memory['status']; pinned?: boolean; content?: string; category?: string }) =>
    request<Memory>(`/memories/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteMemory: (id: string) => request<void>(`/memories/${id}`, { method: 'DELETE' }),
  presets: () => request<Preset[]>('/presets'),
  createPreset: (payload: Omit<Preset, 'id'>) =>
    request<Preset>('/presets', { method: 'POST', body: JSON.stringify(payload) }),
  deletePreset: (id: string) => request<void>(`/presets/${id}`, { method: 'DELETE' }),
  backpacks: () => request<Backpack[]>('/backpacks'),
  createBackpack: (name: string, title: string, content: string) =>
    request<Backpack>('/backpacks', {
      method: 'POST', body: JSON.stringify({ name, items: [{ title, content }] }),
    }),
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
  exportData: () => request<{ jsonl: string }>('/data/export'),
  importData: (jsonl: string) =>
    request<{ imported: number }>('/data/import', { method: 'POST', body: JSON.stringify({ jsonl }) }),
  importV2: () => request<{ imported: number }>('/data/import-v2', { method: 'POST', body: JSON.stringify({ confirmation: 'IMPORT_V2' }) }),
  wipeData: () => request<void>('/data/wipe', { method: 'POST', body: JSON.stringify({ confirmation: 'WIPE' }) }),
  simulateProvider: (provider: string, scenario: string, fallbackProvider?: string) =>
    request<{ recovered: boolean; events: { type: string; provider: string; message: string }[] }>(`/providers/${provider}/simulate`, {
      method: 'POST', body: JSON.stringify({ scenario, fallback_provider: fallbackProvider || null }),
    }),
}
