import { useEffect, useRef, useState } from 'react'
import { CirclePlus, Play, Square, Trash2 } from 'lucide-react'

import { api, streamRun, type ModelSummary, type ProviderSummary } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MarkdownContent } from '@/components/MarkdownContent'
import { Input } from '@/components/ui/input'
import { Surface } from '@/components/shared/Surface'
import { modelKey, pricingLabel } from '@/features/models/modelMetadata'
import { ProviderModelPicker } from '@/features/models/ProviderModelPicker'

type ComparisonResult = {
  key: string
  output: string
  status: 'waiting' | 'starting' | 'streaming' | 'completed' | 'failed' | 'cancelled'
  error?: string
}

// Compare route: fans one prompt out to 2-4 models as independent concurrent runs and
// streams each back via streamRun (api/client.ts). Cancellation and stale-update
// guarding below are the non-obvious parts — see the comments on `run`/`cancelAll`.
export function ComparePage({ models, providers }: { models: ModelSummary[]; providers: ProviderSummary[] }) {
  const [prompt, setPrompt] = useState('')
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [results, setResults] = useState<ComparisonResult[]>([])
  const [running, setRunning] = useState(false)
  const controllers = useRef(new Map<string, AbortController>())
  const runIds = useRef(new Map<string, string>())
  // Incremented on every new run() call; each in-flight stream closure captures the id
  // it started with and checks it still matches batch.current before writing to state.
  // This stops results from a superseded batch (e.g. the user hit Run again, or
  // cancelled and started over) from landing after a newer batch has already reset
  // `results` — without this, a slow late-arriving event could clobber the new batch.
  const batch = useRef(0)

  useEffect(() => {
    if (selectedModels.length || !models.length) return
    setSelectedModels(models.slice(0, 2).map(modelKey))
  }, [models, selectedModels.length])

  const selectedTargets = selectedModels.flatMap((key) => {
    const model = models.find((candidate) => modelKey(candidate) === key)
    return model ? [model] : []
  })
  // Every write site passes the batchId it started with; if a newer batch has started
  // since, the write is dropped (see the comment on `batch` above).
  const updateResult = (key: string, update: Partial<ComparisonResult>, batchId: number) => {
    if (batch.current !== batchId) return
    setResults((current) => current.map((result) => result.key === key ? { ...result, ...update } : result))
  }
  const run = async () => {
    if (!prompt.trim() || selectedTargets.length < 2) return
    const batchId = ++batch.current
    controllers.current.clear()
    runIds.current.clear()
    setResults(selectedTargets.map((target) => ({ key: modelKey(target), output: '', status: 'starting' })))
    setRunning(true)
    await Promise.allSettled(selectedTargets.map(async (target) => {
      const key = modelKey(target)
      const controller = new AbortController()
      controllers.current.set(key, controller)
      try {
        const created = await api.createRun({ provider: target.provider, model: target.id, messages: [{ role: 'user', content: prompt.trim(), images: [] }], temperature: 0.7 })
        runIds.current.set(key, created.id)
        // The run was created but may have already been aborted (cancelAll fired while
        // createRun was still in flight) — cancel it server-side too instead of streaming
        // a run nothing is listening for; a failure to cancel is not worth surfacing here.
        if (controller.signal.aborted) { await api.cancelRun(created.id).catch(() => undefined); return }
        await streamRun(created.id, (event) => {
          if (event.type === 'run.started') updateResult(key, { status: 'streaming' }, batchId)
          if (event.type === 'run.delta') {
            const delta = String(event.data.delta ?? '')
            if (batch.current === batchId) setResults((current) => current.map((result) => result.key === key ? { ...result, output: result.output + delta, status: 'streaming' } : result))
          }
          if (event.type === 'run.completed') updateResult(key, { output: String(event.data.output ?? ''), status: 'completed' }, batchId)
          if (event.type === 'run.failed') updateResult(key, { status: 'failed', error: String(event.data.error ?? 'Generation failed') }, batchId)
          if (event.type === 'run.cancelled') updateResult(key, { status: 'cancelled' }, batchId)
        }, controller.signal)
      } catch (error) {
        if (controller.signal.aborted) updateResult(key, { status: 'cancelled' }, batchId)
        else updateResult(key, { status: 'failed', error: error instanceof Error ? error.message : 'Generation failed' }, batchId)
      }
    }))
    if (batch.current === batchId) setRunning(false)
  }
  const cancelAll = async () => {
    // Snapshot the batch id before the awaited cancel calls: if the user starts a new
    // run while those are still in flight, batch.current will have moved on and this
    // stale cancelAll must not overwrite the new batch's results below.
    const activeBatch = batch.current
    controllers.current.forEach((controller) => controller.abort())
    await Promise.allSettled([...runIds.current.values()].map((runId) => api.cancelRun(runId)))
    if (batch.current === activeBatch) {
      setResults((current) => current.map((result) => ['starting', 'streaming'].includes(result.status) ? { ...result, status: 'cancelled' } : result))
      setRunning(false)
    }
  }
  const replaceSelection = (index: number, key: string) => setSelectedModels((current) => current.map((item, itemIndex) => itemIndex === index ? key : item))
  const addModel = () => {
    const available = models.find((model) => !selectedModels.includes(modelKey(model)))
    if (available) setSelectedModels((current) => [...current, modelKey(available)])
  }
  const removeModel = (index: number) => setSelectedModels((current) => current.filter((_, itemIndex) => itemIndex !== index))

  return <Surface eyebrow="Parallel run" title="Compare" description="Send one prompt to 2–4 models and compare their independent streams.">
    <div className="compare-models">{selectedModels.map((selected, index) => <div className="compare-model-field" key={`${index}-${selected}`}><div className="action-row"><ProviderModelPicker disabled={running} excludedKeys={new Set(selectedModels.filter((_, itemIndex) => itemIndex !== index))} modelLabel={`Comparison model ${index + 1}`} models={models} onChange={(key) => replaceSelection(index, key)} providerLabel={`Comparison provider ${index + 1}`} providers={providers} value={selected} />{selectedModels.length > 2 && <Button aria-label={`Remove model ${index + 1}`} disabled={running} onClick={() => removeModel(index)} size="icon-sm" variant="ghost"><Trash2 /></Button>}</div></div>)}{selectedModels.length < Math.min(4, models.length) && <Button disabled={running} onClick={addModel} variant="outline"><CirclePlus /> Add model</Button>}</div>
    <div className="compare-prompt"><Input aria-label="Comparison prompt" disabled={running} onChange={(event) => setPrompt(event.target.value)} placeholder="What should the models answer?" value={prompt} />{running ? <Button onClick={cancelAll} variant="destructive"><Square /> Cancel all</Button> : <Button disabled={!prompt.trim() || selectedTargets.length < 2} onClick={run}><Play /> Run {selectedTargets.length} models</Button>}</div>
    <p className="compare-cost-note">Each selected cloud model receives a separate request and may incur provider charges.</p>
    <div className="comparison-grid">{results.length ? results.map((result) => { const model = models.find((candidate) => modelKey(candidate) === result.key); return <Card key={result.key}><CardHeader><div className="comparison-title"><div><CardTitle>{model?.label || model?.id || result.key}</CardTitle><CardDescription>{model?.provider} · {model ? pricingLabel(model) : 'pricing unavailable'}</CardDescription></div><Badge variant={result.status === 'failed' ? 'destructive' : 'outline'}>{result.status}</Badge></div></CardHeader><CardContent><MarkdownContent className="comparison-markdown" content={result.error || result.output || (result.status === 'starting' ? 'Starting run…' : 'Waiting for response…')} /></CardContent></Card> }) : selectedTargets.map((model) => <Card key={modelKey(model)}><CardHeader><CardTitle>{model.label || model.id}</CardTitle><CardDescription>{model.provider} · {pricingLabel(model)}</CardDescription></CardHeader><CardContent><MarkdownContent className="comparison-markdown" content="Waiting for a run." /></CardContent></Card>)}</div>
  </Surface>
}
