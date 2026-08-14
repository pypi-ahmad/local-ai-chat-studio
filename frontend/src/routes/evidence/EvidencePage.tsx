import type { ContextPlan, RunSnapshot } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Surface } from '@/components/shared/Surface'
import { EvidenceSourceList } from '@/features/context/ContextInspector'

export function EvidencePage({ activity, plan, excluded, onToggle }: { activity: RunSnapshot[]; plan: ContextPlan | null; excluded: Set<string>; onToggle: (id: string) => void }) {
  return <Surface eyebrow="Why this answer" title="Evidence" description="Inspect sources, exclude individual records, and verify integrity receipts."><div className="surface-grid"><Card><CardHeader><CardTitle>Retrieved sources</CardTitle></CardHeader><CardContent><EvidenceSourceList excluded={excluded} onToggle={onToggle} plan={plan} /></CardContent></Card><Card><CardHeader><CardTitle>Integrity chain</CardTitle></CardHeader><CardContent className="stack-list">{activity.map((run) => <div className="data-row" key={run.id}><div><strong>{run.model}</strong><small>{run.status} · {String(run.metrics.elapsed_seconds ?? '—')}s</small></div><code>{run.receipt_hash?.slice(0, 12) || 'pending'}</code></div>)}</CardContent></Card></div></Surface>
}
