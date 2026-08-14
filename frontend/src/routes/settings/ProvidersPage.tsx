import { useEffect, useState } from 'react'
import { Play } from 'lucide-react'

import { api, type OpenCodeAuthMethod, type ProviderPolicy, type ProviderSummary } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Surface } from '@/components/shared/Surface'

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
  const connectOauth = async (upstream: string, method: OpenCodeAuthMethod) => {
    const auth = await api.startOpenCodeAuth(upstream, method.method)
    window.open(auth.url, '_blank', 'noopener,noreferrer')
    const code = auth.method === 'code' ? window.prompt(auth.instructions || 'Enter the authorization code') : undefined
    if (auth.method === 'code' && !code) return
    await api.completeOpenCodeAuth(upstream, method.method, code || undefined)
    await onChanged()
  }
  const supportedOauth = Object.entries(oauthMethods).filter(([id]) => /openai|chatgpt|anthropic|claude|xai|grok/i.test(id))
  return <Card><CardHeader><div className="provider-title"><div className="provider-icon">{provider.label[0]}</div><div><CardTitle>{provider.label}</CardTitle><CardDescription>{provider.key_source ? `Connected from ${provider.key_source}` : provider.auth_modes.includes('none') ? 'Local connection · no key required' : 'Prompt-only cloud policy'}</CardDescription></div></div></CardHeader><CardContent className="form-stack">{provider.auth_modes.includes('api_key') && <div className="action-row"><Input aria-label={`${provider.label} API key`} onChange={(event) => setKey(event.target.value)} placeholder="Session API key" type="password" value={key} /><Button disabled={!key.trim()} onClick={async () => { await api.setCredential(provider.id, key); setKey(''); await onChanged() }}>Connect</Button>{provider.key_source && <Button onClick={async () => { await api.removeCredential(provider.id); await onChanged() }} variant="outline">Forget</Button>}</div>}{provider.auth_modes.includes('wif') && <small>Claude WIF is discovered from the backend environment or active Anthropic profile.</small>}{provider.id === 'openrouter' && <Button onClick={async () => { const auth = await api.startOpenRouterAuth(); window.location.assign(auth.authorization_url) }} variant="outline">Sign in with OpenRouter</Button>}{supportedOauth.flatMap(([upstream, methods]) => methods.map((method) => <Button key={`${upstream}-${method.method}`} onClick={() => connectOauth(upstream, method)} variant="outline">Connect {method.label} through OpenCode</Button>))}<div className="policy-grid">{Object.keys(policy).map((field) => <label key={field}><input checked={policy[field as keyof ProviderPolicy]} onChange={() => toggle(field as keyof ProviderPolicy)} type="checkbox" />{field.replace('allow_', '').replace('_', ' ')}</label>)}</div><Button onClick={async () => { const result = await api.simulateProvider(provider.id, 'rate_limit', provider.id === 'ollama-local' ? undefined : 'ollama-local'); setSimulation(result.recovered ? 'Fallback path recovered' : 'Failure surfaced safely') }} variant="outline"><Play /> Test failover</Button>{simulation && <small>{simulation}</small>}</CardContent></Card>
}

export function ProvidersPage({ providers, onChanged }: { providers: ProviderSummary[]; onChanged: () => Promise<void> }) {
  return <Surface eyebrow="Data boundaries" title="Providers" description="Credentials stay in memory. Remote providers start with prompt-only access."><div className="provider-grid">{providers.map((provider) => <ProviderCard key={provider.id} onChanged={onChanged} provider={provider} />)}</div></Surface>
}
