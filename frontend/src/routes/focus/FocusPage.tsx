import { useState } from 'react'
import { Focus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Surface } from '@/components/shared/Surface'

export function FocusPage({ conversationId, onCreate }: { conversationId: string | null; onCreate: (objective: string, criteria: string, constraints: string[]) => Promise<void> }) {
  const [objective, setObjective] = useState('')
  const [criteria, setCriteria] = useState('')
  const [constraints, setConstraints] = useState('')
  return <Surface eyebrow="Temporary contract" title="Focus" description="Keep one objective and its finish line visible without streaks or scoring."><Card className="focus-card"><CardContent className="form-stack"><label>Objective<Input onChange={(event) => setObjective(event.target.value)} placeholder="What must this conversation accomplish?" value={objective} /></label><label>Success criteria<Textarea onChange={(event) => setCriteria(event.target.value)} placeholder="How will you know it is done?" value={criteria} /></label><label>Constraints<Input onChange={(event) => setConstraints(event.target.value)} placeholder="Comma-separated boundaries" value={constraints} /></label><Button disabled={!conversationId || !objective.trim() || !criteria.trim()} onClick={() => onCreate(objective, criteria, constraints.split(',').map((item) => item.trim()).filter(Boolean))}><Focus /> Start focus session</Button></CardContent></Card></Surface>
}
