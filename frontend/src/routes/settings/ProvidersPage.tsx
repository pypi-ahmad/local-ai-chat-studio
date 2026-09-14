import { useEffect, useState } from 'react'
import { Play } from 'lucide-react'

import { api, type OpenCodeAuthMethod, type ProviderPolicy, type ProviderSummary } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Surface } from '@/components/shared/Surface'

// Settings/Providers route: manages per-provider credentials, capability policy toggles,
// and OAuth/failover testing, all through api/client.ts. Credentials are described in
// the UI as staying in process memory (not written to disk) — this file doesn't persist
// them itself, it only forwards what the user enters to the backend via setCredential.

const defaultPolicy: ProviderPolicy = {
  allow_memory: false,
  allow_retrieval: false,
  allow_attachments: false,
  allow_web: false,
  allow_backpacks: false,
}
function ProviderCard({ provider, onChanged }: { provider: ProviderSummary; onChanged: () => Promise<void> }) {
  const [key, setKey] = useState('')
  const [policy, setPolicy] = useState<ProviderPolicy>(defaultPolicy)
  const [simulation, setSimulation] = useState('')
  const [oauthMethods, setOauthMethods] = useState<Record<string, OpenCodeAuthMethod[]>>({})
  useEffect(() => { void api.providerPolicy(provider.id).then(setPolicy).catch(() => setPolicy(defaultPolicy)) }, [provider.id])
  useEffect(() => {
    if (provider.id === 'opencode-bridge') void api.openCodeAuthMethods().then(setOauthMethods).catch(() => setOauthMethods({}))
  }, [provider.id])
  const toggle = async (field: keyof ProviderPolicy) => {
    const next = { ...policy, [field]: !policy[field] }
    setPolicy(next)
    await api.setProviderPolicy(provider.id, next)
  }
  // Two OAuth shapes from OpenCode: a plain redirect flow (no further input needed once
  // the browser tab completes it) or a manual "code" flow where the user pastes back an
  // authorization code from the opened tab via a prompt().
  const connectOauth = async (upstream: string, method: OpenCodeAuthMethod) => {
    const auth = await api.startOpenCodeAuth(upstream, method.method)
    window.open(auth.url, '_blank', 'noopener,noreferrer')
    const code = auth.method === 'code' ? window.prompt(auth.instructions || 'Enter the authorization code') : undefined
    if (auth.method === 'code' && !code) return
    await api.completeOpenCodeAuth(upstream, method.method, code || undefined)
    await onChanged()
  }
  // OpenCode can report many upstream ids; only surface the ones this UI has a home for.
  const supportedOauth = Object.entries(oauthMethods).filter(([id]) => /openai|chatgpt|anthropic|claude|xai|grok/i.test(id))
  return <Card><CardHeader><div className="provider-title"><div className="provider-icon">{provider.label[0]}</div><div><CardTitle>{provider.label}</CardTitle><CardDescription>{provider.key_source ? `Connected from ${provider.key_source}` : provider.auth_modes.includes('none') ? 'Local connection · no key required' : 'Prompt-only cloud policy'}</CardDescription></div></div></CardHeader><CardContent className="form-stack">{provider.auth_modes.includes('api_key') && <div className="action-row"><Input aria-label={`${provider.label} API key`} onChange={(event) => setKey(event.target.value)} placeholder="Session API key" type="password" value={key} /><Button disabled={!key.trim()} onClick={async () => { await api.setCredential(provider.id, key); setKey(''); await onChanged() }}>Connect</Button>{provider.key_source && <Button onClick={async () => { await api.removeCredential(provider.id); await onChanged() }} variant="outline">Forget</Button>}</div>}{provider.auth_modes.includes('wif') && <small>Claude WIF is discovered from the backend environment or active Anthropic profile.</small>}{provider.id === 'openrouter' && <Button onClick={async () => { const auth = await api.startOpenRouterAuth(); window.location.assign(auth.authorization_url) }} variant="outline">Sign in with OpenRouter</Button>}{supportedOauth.flatMap(([upstream, methods]) => methods.map((method) => <Button key={`${upstream}-${method.method}`} onClick={() => connectOauth(upstream, method)} variant="outline">Connect {method.label} through OpenCode</Button>))}<div className="policy-grid">{Object.keys(policy).map((field) => <label key={field}><input checked={policy[field as keyof ProviderPolicy]} onChange={() => toggle(field as keyof ProviderPolicy)} type="checkbox" />{field.replace('allow_', '').replace('_', ' ')}</label>)}</div>{/* Simulates a rate-limit failure and falls back to the local Ollama provider, except when testing ollama-local itself, which has no further local fallback. */}<Button onClick={async () => { const result = await api.simulateProvider(provider.id, 'rate_limit', provider.id === 'ollama-local' ? undefined : 'ollama-local'); setSimulation(result.recovered ? 'Fallback path recovered' : 'Failure surfaced safely') }} variant="outline"><Play /> Test failover</Button>{simulation && <small>{simulation}</small>}</CardContent></Card>
}

export function ProvidersPage({ providers, onChanged }: { providers: ProviderSummary[]; onChanged: () => Promise<void> }) {
  return <Surface eyebrow="Data boundaries" title="Providers" description="Credentials stay in memory. Remote providers start with prompt-only access."><div className="provider-grid">{providers.map((provider) => <ProviderCard key={provider.id} onChanged={onChanged} provider={provider} />)}</div></Surface>
}
