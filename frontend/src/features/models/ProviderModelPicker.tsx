import { useEffect, useState } from 'react'
import { CheckCircle, ChevronDown, Search, Star } from 'lucide-react'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { ModelSummary, ProviderSummary } from '@/api/client'
import { contextLengthLabel, hasTools, hasVision, modelKey, modelSearchText, pricingLabel, providerMonogram } from '@/features/models/modelMetadata'
import { readFavoriteModels, readRecentModels, writeFavoriteModels, writeRecentModels } from '@/features/models/modelPreferences'

type ModelCapabilityFilter = 'all' | 'vision' | 'reasoning' | 'tools'

function ProviderMark({ id, label }: { id: string; label: string }) {
  return <span aria-label={`${label} provider`} className={`provider-mark provider-${id}`}>{providerMonogram(id)}</span>
}

export function ProviderModelPicker({
  models,
  providers,
  value,
  onChange,
  providerLabel = 'Provider',
  modelLabel = 'Model',
  disabled = false,
  excludedKeys = new Set<string>(),
}: {
  models: ModelSummary[]
  providers: ProviderSummary[]
  value: string
  onChange: (value: string) => void
  providerLabel?: string
  modelLabel?: string
  disabled?: boolean
  excludedKeys?: Set<string>
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [capability, setCapability] = useState<ModelCapabilityFilter>('all')
  const [favoriteModels, setFavoriteModels] = useState<string[]>(readFavoriteModels)
  const [recentModels, setRecentModels] = useState<string[]>(readRecentModels)
  const selected = models.find((model) => modelKey(model) === value)
  const providerIds = [...new Set(models.map((model) => model.provider))]
  const selectedProvider = selected?.provider ?? providerIds[0] ?? ''
  const availableModels = models.filter((model) => model.provider === selectedProvider && (!excludedKeys.has(modelKey(model)) || modelKey(model) === value))
  const displayedModel = selected?.provider === selectedProvider ? selected : availableModels[0]
  const providerName = (id: string) => providers.find((provider) => provider.id === id)?.label ?? ({ openai: 'OpenAI', agnes: 'Agnes', anthropic: 'Anthropic', google: 'Google', openrouter: 'OpenRouter', xai: 'xAI' }[id] ?? id)
  const normalizedQuery = query.trim().toLowerCase()
  const visibleModels = availableModels.filter((model) => {
    if (capability === 'vision' && !hasVision(model)) return false
    if (capability === 'reasoning' && !model.reasoning_efforts?.length) return false
    if (capability === 'tools' && !hasTools(model)) return false
    return !normalizedQuery || modelSearchText(model).includes(normalizedQuery)
  })
  const favoriteSet = new Set(favoriteModels)
  const recentSet = new Set(recentModels)
  const favoriteOptions = visibleModels.filter((model) => favoriteSet.has(modelKey(model)))
  const recentOptions = visibleModels.filter((model) => recentSet.has(modelKey(model)) && !favoriteSet.has(modelKey(model)))
  const otherOptions = visibleModels.filter((model) => !favoriteSet.has(modelKey(model)) && !recentSet.has(modelKey(model)))

  useEffect(() => writeFavoriteModels(favoriteModels), [favoriteModels])
  useEffect(() => writeRecentModels(recentModels), [recentModels])

  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (!next) { setQuery(''); setCapability('all') }
  }

  const selectModel = (key: string) => {
    setRecentModels((current) => [key, ...current.filter((item) => item !== key)].slice(0, 6))
    onChange(key)
    changeOpen(false)
  }

  const toggleFavorite = (key: string) => setFavoriteModels((current) => current.includes(key) ? current.filter((item) => item !== key) : [key, ...current])

  const renderOption = (model: ModelSummary) => {
    const key = modelKey(model)
    const current = key === value
    const favorite = favoriteSet.has(key)
    const label = model.label || model.id
    return <div aria-selected={current} className="model-option" key={key} onClick={() => selectModel(key)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectModel(key) } }} role="option" tabIndex={0}><div className="model-option-main"><ProviderMark id={model.provider} label={providerName(model.provider)} /><div className="model-option-copy"><div className="model-option-title"><div><strong>{label}</strong><code>{model.id}</code></div>{current && <CheckCircle />}</div><div className="model-capabilities"><span>{contextLengthLabel(model.context_length)}</span>{hasVision(model) && <span>Vision</span>}{hasTools(model) && <span>Tools</span>}{Boolean(model.reasoning_efforts?.length) && <span>Reasoning · {model.reasoning_efforts?.length} levels</span>}</div><small>{pricingLabel(model)}</small></div><button aria-label={`${favorite ? 'Remove' : 'Add'} ${label} ${favorite ? 'from' : 'to'} favorites`} aria-pressed={favorite} className="model-favorite" onClick={(event) => { event.stopPropagation(); toggleFavorite(key) }} type="button"><Star fill={favorite ? 'currentColor' : 'none'} /></button></div></div>
  }

  return (
    <div className="provider-model-picker">
      <label><span>{providerLabel}</span><select aria-label={providerLabel} disabled={disabled || !providerIds.length} onChange={(event) => {
        const next = models.find((model) => model.provider === event.target.value && !excludedKeys.has(modelKey(model)))
        if (next) onChange(modelKey(next))
      }} value={selectedProvider}>
        {!providerIds.length && <option value="">No providers available</option>}
        {providerIds.map((provider) => <option disabled={!models.some((model) => model.provider === provider && (!excludedKeys.has(modelKey(model)) || modelKey(model) === value))} key={provider} value={provider}>{providerName(provider)}</option>)}
      </select></label>
      <label><span>{modelLabel}</span><button aria-expanded={open} aria-haspopup="dialog" aria-label={modelLabel} className="model-picker-trigger" disabled={disabled || !availableModels.length} onClick={() => setOpen(true)} role="combobox" type="button">{displayedModel && <ProviderMark id={displayedModel.provider} label={providerName(displayedModel.provider)} />}<span><strong>{displayedModel?.label || displayedModel?.id || 'No models available'}</strong>{displayedModel && <small>{displayedModel.id}</small>}</span><ChevronDown /></button></label>
      <Dialog onOpenChange={changeOpen} open={open}>
        <DialogContent className="model-picker-dialog">
          <DialogHeader><DialogTitle>{providerName(selectedProvider)} models</DialogTitle><DialogDescription>Search discovered models and compare the capabilities relevant to this task.</DialogDescription></DialogHeader>
          <div className="model-search-wrap"><Search /><Input aria-label={`Search ${modelLabel.toLowerCase()}`} autoFocus onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, ID, or capability" value={query} /></div>
          <div aria-label="Model capability filter" className="model-capability-filters">{(['all', 'vision', 'reasoning', 'tools'] as const).map((filter) => <button aria-pressed={capability === filter} key={filter} onClick={() => setCapability(filter)} type="button">{filter === 'all' ? 'All models' : filter}</button>)}</div>
          <div aria-label={`${modelLabel} options`} className="model-option-list" role="listbox">
            {favoriteOptions.length > 0 && <div aria-label="Favorites" className="model-option-section" role="group"><p>Favorites</p>{favoriteOptions.map(renderOption)}</div>}
            {recentOptions.length > 0 && <div aria-label="Recent" className="model-option-section" role="group"><p>Recent</p>{recentOptions.map(renderOption)}</div>}
            {otherOptions.length > 0 && <div aria-label={favoriteOptions.length || recentOptions.length ? 'All models' : 'Available models'} className="model-option-section" role="group"><p>{favoriteOptions.length || recentOptions.length ? 'All models' : 'Available models'}</p>{otherOptions.map(renderOption)}</div>}
            {!visibleModels.length && <div className="model-picker-empty"><Search /><strong>No matching models</strong><span>Change the search or capability filter.</span></div>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
