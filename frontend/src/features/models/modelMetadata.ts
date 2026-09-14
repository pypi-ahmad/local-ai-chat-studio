import type { ModelSummary } from '@/api/client'

// Models feature: pure formatting/derivation helpers over a ModelSummary from the API.
// No network calls or state here — see modelPreferences.ts for persisted favorites/recents,
// and ProviderModelPicker.tsx for the component that composes all of this.

// Canonical identity for a model across providers; used as the value in <select>s,
// storage keys (modelPreferences.ts), and lookups — keep this format in sync everywhere it's parsed.
export const modelKey = (model: ModelSummary) => `${model.provider}::${model.id}`

// Sub-cent per-token prices round to zero at 2 decimals, so show 4 decimals below $0.01
// to keep small per-million-token rates visibly non-zero.
export function formatUsd(value: number) {
  if (value === 0) return '$0.00'
  if (value < 0.01) return `$${value.toFixed(4)}`
  return `$${value.toFixed(2)}`
}

export function pricingLabel(model: ModelSummary) {
  const pricing = model.pricing
  return pricing ? `${formatUsd(pricing.input_per_million)} in / ${formatUsd(pricing.output_per_million)} out per 1M` : 'pricing unavailable'
}

// length is in tokens. Falsy (undefined/null/0) means the provider didn't report it.
export function contextLengthLabel(length?: number | null) {
  if (!length) return 'Context unknown'
  if (length >= 1_000_000) return `${Number((length / 1_000_000).toFixed(1))}M context`
  if (length >= 1_000) return `${Math.round(length / 1_000)}K context`
  return `${length.toLocaleString()} context`
}

// Capability strings come from each provider's own API and aren't standardized,
// so vision/tool support is detected via known aliases rather than an exact match.
export function hasVision(model: ModelSummary) {
  return model.capabilities?.some((capability) => ['vision', 'image', 'images'].includes(capability.toLowerCase())) ?? false
}

export function hasTools(model: ModelSummary) {
  return model.capabilities?.some((capability) => ['tool', 'tools', 'tool_use', 'function_calling'].includes(capability.toLowerCase())) ?? false
}

// Explicit two-letter marks for known providers; anything else falls back to the
// first letter of each hyphen/underscore/space-separated word, capped at two letters.
export function providerMonogram(provider: string) {
  const known: Record<string, string> = { openai: 'OA', agnes: 'AG', anthropic: 'AN', google: 'GG', openrouter: 'OR', xai: 'XA', 'ollama-local': 'OL', 'ollama-cloud': 'OC', echo: 'EC' }
  return known[provider] ?? provider.split(/[-_\s]+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

// Builds a lowercase, space-joined blob of a model's searchable attributes (label,
// id, provider, capabilities, and derived tags) for substring search in ProviderModelPicker.
export function modelSearchText(model: ModelSummary) {
  return [model.label, model.id, model.provider, ...(model.capabilities ?? []), hasVision(model) ? 'vision image' : '', hasTools(model) ? 'tools function calling' : '', model.reasoning_efforts?.length ? 'reasoning effort' : '', contextLengthLabel(model.context_length), model.pricing ? 'priced' : 'unpriced'].filter(Boolean).join(' ').toLowerCase()
}
