import type { components } from './schema'

type RunCreate = components['schemas']['RunCreate']
type RunSnapshot = components['schemas']['RunSnapshot']

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) throw new Error(`API request failed (${response.status})`)
  return response.status === 204 ? (undefined as T) : response.json()
}

export const api = {
  createRun: (payload: RunCreate) =>
    request<RunSnapshot>('/runs', { method: 'POST', body: JSON.stringify(payload) }),
  cancelRun: (runId: string) => request<RunSnapshot>(`/runs/${runId}`, { method: 'DELETE' }),
  providers: () => request<{ providers: Array<{ id: string; label: string; key_source: string | null }> }>('/providers'),
}
