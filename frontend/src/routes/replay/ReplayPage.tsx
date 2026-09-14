import { useState } from 'react'
import { Download, RotateCcw, ShieldCheck } from 'lucide-react'

import { api, type ModelSummary, type ProviderSummary, type RunSnapshot } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Surface } from '@/components/shared/Surface'
import { ProviderModelPicker } from '@/features/models/ProviderModelPicker'

// Replay route: re-runs a past prompt against a (possibly different) model, diffs two
// past outputs, and exports full or redacted reproducibility bundles. Also rendered
// embedded inside the runs sheet from ChatWorkspace (see `embedded`) instead of as its
// own page. All data fetching for a single action goes through api/client.ts calls
// made directly here (bundle/diff); the run list itself is passed in as `activity`.
export function ReplayPage({ activity, models, providers, selectedModel, onModel, onReplay, embedded = false }: { activity: RunSnapshot[]; models: ModelSummary[]; providers: ProviderSummary[]; selectedModel: string; onModel: (value: string) => void; onReplay: (run: RunSnapshot, modelKey: string) => Promise<void>; embedded?: boolean }) {
  const [left, setLeft] = useState<string | null>(null)
  const [diff, setDiff] = useState('')
  // Builds a local object URL for the bundle JSON, triggers a synthetic download click,
  // then revokes the URL immediately after — the anchor is never attached to the DOM.
  const saveBundle = async (run: RunSnapshot, mode: 'full' | 'redacted') => { const bundle = await api.bundle(run.id, mode); const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${run.id}-${mode}.json`; anchor.click(); URL.revokeObjectURL(url) }
  // Two-click diff selection: the first click on any run stores it as `left` and waits;
  // the next click on any run diffs it against that stored run and clears the selection.
  const compare = async (run: RunSnapshot) => { if (!left) { setLeft(run.id); setDiff(''); return } const result = await api.diff(left, run.id); setDiff(result.diff || 'Outputs are identical.'); setLeft(null) }
  const content = <><div className="replay-target"><p className="section-label">Replay target</p><ProviderModelPicker modelLabel="Replay model" models={models} onChange={onModel} providerLabel="Replay provider" providers={providers} value={selectedModel} /></div><div className="timeline">{activity.map((run) => <Card key={run.id}><CardContent className="run-row"><div><Badge variant="outline">{run.status}</Badge><h3>{run.model}</h3><p>{run.output.slice(0, 180) || run.error || 'No output yet'}</p><small>{run.receipt_hash ? `receipt ${run.receipt_hash.slice(0, 12)}` : 'receipt pending'}</small></div><div className="inline-actions"><Button disabled={!selectedModel} onClick={() => onReplay(run, selectedModel)} variant="outline"><RotateCcw /> Replay</Button><Button onClick={() => compare(run)} variant="outline">{left ? 'Compare here' : 'Select for diff'}</Button><Button onClick={() => saveBundle(run, 'full')} size="icon-sm" variant="ghost" title="Export full local bundle"><Download /></Button><Button onClick={() => saveBundle(run, 'redacted')} size="icon-sm" variant="ghost" title="Export redacted share bundle"><ShieldCheck /></Button></div></CardContent></Card>)}{diff && <pre className="output-block">{diff}</pre>}</div></>
  if (embedded) return <section className="runs-panel"><SheetHeader><SheetTitle>Runs</SheetTitle><SheetDescription>Replay, compare, or export recorded answers.</SheetDescription></SheetHeader>{content}</section>
  return <Surface eyebrow="Prompt tape" title="Replay lab" description="Re-run a recorded prompt, compare outputs, and export full or privacy-safe bundles.">{content}</Surface>
}
