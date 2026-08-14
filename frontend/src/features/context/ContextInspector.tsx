import { Brain, CheckCircle, ChevronRight, ShieldCheck, TriangleAlert } from 'lucide-react'

import type { ContextPlan, ModelSummary } from '@/api/client'
import type { Page } from '@/app/routes'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatUsd } from '@/features/models/modelMetadata'

export type InspectorTab = 'context' | 'evidence'

export function ContextRail({ plan, model }: { plan: ContextPlan | null; model?: ModelSummary }) {
  if (!plan) return <div className="context-rail empty"><span>Context preflight appears here</span></div>
  const percent = Math.round((plan.estimated_tokens / plan.budget_tokens) * 100)
  const remainingTokens = plan.budget_tokens - plan.estimated_tokens
  const state = remainingTokens < 0 ? 'overflow' : percent >= 80 ? 'warning' : 'safe'
  const estimatedInputCost = model?.pricing ? (plan.estimated_tokens / 1_000_000) * model.pricing.input_per_million : null
  const warning = state === 'overflow'
    ? `Context exceeds the safe input budget by ${Math.abs(remainingTokens).toLocaleString()} tokens. Remove sources or choose a larger-context model before sending.`
    : state === 'warning'
      ? `Only ${remainingTokens.toLocaleString()} tokens remain. Remove optional sources or choose a larger-context model.`
      : ''
  return (
    <div className={`context-rail ${state}`} aria-label="Context budget">
      <div className="rail-copy"><span>{plan.estimated_tokens.toLocaleString()} / {plan.budget_tokens.toLocaleString()} tokens{estimatedInputCost !== null ? ` · est. input ${formatUsd(estimatedInputCost)}` : ''}</span><strong>{percent}% of safe budget</strong></div>
      <div aria-label={`${percent}% of safe context budget used`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.min(100, percent)} className="rail-track" role="progressbar">
        <div className="rail-fill" style={{ width: `${Math.min(100, percent)}%` }}>
          {plan.sections.filter((section) => section.included && section.estimated_tokens).map((section) => (
            <span key={section.kind} style={{ flexGrow: Math.max(1, section.estimated_tokens) }} title={`${section.kind}: ${section.estimated_tokens}`} />
          ))}
        </div>
      </div>
      {plan.compression_applied && <div className="compression-status" role="status"><CheckCircle /><span>{plan.compressed_message_count} older messages compressed</span></div>}
      {warning && <div className="context-warning" role="alert"><TriangleAlert /><span>{warning}</span></div>}
    </div>
  )
}

export function ContextPlanSummary({ plan }: { plan: ContextPlan | null }) {
  if (!plan) return <p className="muted">Send a message to build a context plan.</p>
  return <div className="stack-list context-section-list">{plan.sections.map((section) => <div className="data-row" key={section.kind}><div><strong>{section.kind}</strong>{section.reason && <small>{section.reason}</small>}</div><Badge variant={section.included ? 'default' : 'outline'}>{section.included ? `${section.estimated_tokens.toLocaleString()} tokens` : 'excluded'}</Badge></div>)}</div>
}

export function EvidenceSourceList({ plan, excluded, onToggle }: { plan: ContextPlan | null; excluded: Set<string>; onToggle: (id: string) => void }) {
  if (!plan?.sources.length) return <p className="muted">No evidence sources are available for the current plan.</p>
  return <div className="stack-list">{plan.sources.map((source) => <div className="source-card" key={source.id}><div><strong>{source.title}</strong><small>{source.kind} · {source.estimated_tokens.toLocaleString()} tokens</small></div><Badge variant={source.trust === 'trusted' ? 'outline' : 'destructive'}>{source.trust}</Badge><p>{source.preview}</p><label><input checked={!excluded.has(source.id)} disabled={source.trust !== 'trusted'} onChange={() => onToggle(source.id)} type="checkbox" /> Include in next send</label>{source.url && <a href={source.url} rel="noreferrer" target="_blank">Open source</a>}</div>)}</div>
}

export function ContextEvidenceInspector({ plan, excluded, onToggle, tab, onTab, onClose, onPage }: { plan: ContextPlan | null; excluded: Set<string>; onToggle: (id: string) => void; tab: InspectorTab; onTab: (tab: InspectorTab) => void; onClose: () => void; onPage: (page: Page) => void }) {
  const openPage = (page: Page) => { onClose(); onPage(page) }
  return (
    <aside aria-label="Context and evidence inspector" className="context-inspector" id="context-evidence-inspector">
      <header className="inspector-header"><div><p className="eyebrow">Prompt trail</p><h2>Inspector</h2></div><Button aria-label="Close inspector" onClick={onClose} size="icon-sm" variant="ghost"><ChevronRight /></Button></header>
      <Tabs className="inspector-tabs" onValueChange={(value) => onTab(value as InspectorTab)} value={tab}>
        <TabsList><TabsTrigger value="context"><Brain /> Context</TabsTrigger><TabsTrigger value="evidence"><ShieldCheck /> Evidence</TabsTrigger></TabsList>
        <ScrollArea className="inspector-scroll">
          <TabsContent value="context"><div className="inspector-content"><ContextRail plan={plan} /><ContextPlanSummary plan={plan} /><Button onClick={() => openPage('Context')} variant="outline">Open full Context page</Button></div></TabsContent>
          <TabsContent value="evidence"><div className="inspector-content"><EvidenceSourceList excluded={excluded} onToggle={onToggle} plan={plan} /><Button onClick={() => openPage('Evidence')} variant="outline">Open full Evidence page</Button></div></TabsContent>
        </ScrollArea>
      </Tabs>
    </aside>
  )
}
