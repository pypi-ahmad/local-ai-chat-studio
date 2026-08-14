import type { ModelSummary } from '@/api/client'

export const modelKey = (model: ModelSummary) => `${model.provider}::${model.id}`

export function formatUsd(value: number) {
  if (value === 0) return '$0.00'
  if (value < 0.01) return `$${value.toFixed(4)}`
  return `$${value.toFixed(2)}`
}

export function pricingLabel(model: ModelSummary) {
  const pricing = model.pricing
  return pricing ? `${formatUsd(pricing.input_per_million)} in / ${formatUsd(pricing.output_per_million)} out per 1M` : 'pricing unavailable'
}

export function contextLengthLabel(length?: number | null) {
  if (!length) return 'Context unknown'
  if (length >= 1_000_000) return `${Number((length / 1_000_000).toFixed(1))}M context`
  if (length >= 1_000) return `${Math.round(length / 1_000)}K context`
  return `${length.toLocaleString()} context`
}

export function hasVision(model: ModelSummary) {
  return model.capabilities?.some((capability) => ['vision', 'image', 'images'].includes(capability.toLowerCase())) ?? false
}

export function modelSearchText(model: ModelSummary) {
  return [model.label, model.id, model.provider, ...(model.capabilities ?? []), model.reasoning_efforts?.length ? 'reasoning effort' : '', contextLengthLabel(model.context_length), model.pricing ? 'priced' : 'unpriced'].filter(Boolean).join(' ').toLowerCase()
}
