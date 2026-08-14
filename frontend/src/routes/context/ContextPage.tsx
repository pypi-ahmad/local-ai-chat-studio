import { useState } from 'react'
import { Backpack } from 'lucide-react'

import type { Backpack as BackpackRecord, ContextPlan } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Surface } from '@/components/shared/Surface'
import { ContextPlanSummary, ContextRail } from '@/features/context/ContextInspector'

export function ContextPage({ plan, backpacks, onCreate }: { plan: ContextPlan | null; backpacks: BackpackRecord[]; onCreate: (name: string, title: string, content: string) => Promise<void> }) {
  const [name, setName] = useState('Project context')
  const [title, setTitle] = useState('Constraint')
  const [content, setContent] = useState('')
  return <Surface eyebrow="What enters the model" title="Context control" description="Budget, inspect, and carry deliberate context between conversations."><ContextRail plan={plan} /><div className="surface-grid"><Card><CardHeader><CardTitle>Current plan</CardTitle><CardDescription>Sections are estimated locally and preserve 20% for output.</CardDescription></CardHeader><CardContent><ContextPlanSummary plan={plan} /></CardContent></Card><Card><CardHeader><CardTitle>Context backpack</CardTitle><CardDescription>Pin an immutable local snapshot for reuse.</CardDescription></CardHeader><CardContent className="form-stack"><Input onChange={(event) => setName(event.target.value)} value={name} /><Input onChange={(event) => setTitle(event.target.value)} value={title} /><Textarea onChange={(event) => setContent(event.target.value)} placeholder="Context to carry" value={content} /><Button disabled={!content.trim()} onClick={async () => { await onCreate(name, title, content); setContent('') }}><Backpack /> Save backpack</Button>{backpacks.map((item) => <div className="data-row" key={item.id}><span>{item.name}</span><small>{item.items.length} items</small></div>)}</CardContent></Card></div></Surface>
}
