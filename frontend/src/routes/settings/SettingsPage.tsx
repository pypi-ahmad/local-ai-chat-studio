import { useEffect, useRef, useState } from 'react'
import { Download, FileUp, Power, Trash2 } from 'lucide-react'

import { ApiError, api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Surface } from '@/components/shared/Surface'

function messageOf(error: unknown) {
  if (error instanceof ApiError && typeof error.detail === 'object' && error.detail) {
    const detail = error.detail as { message?: string }
    return detail.message ?? error.message
  }
  return error instanceof Error ? error.message : 'Request failed'
}
export function SettingsPage({ connected, onRefresh }: { connected: boolean; onRefresh: () => Promise<void> }) {
  const importRef = useRef<HTMLInputElement>(null)
  const [runtime, setRuntime] = useState<{ ollama_available: boolean; running_models: { name: string; size_gb: number }[] } | null>(null)
  const [profile, setProfile] = useState('')
  const [stopping, setStopping] = useState(false)
  const [stopError, setStopError] = useState('')
  useEffect(() => { void Promise.all([api.runtimeHealth(), api.profile()]).then(([health, saved]) => { setRuntime(health); setProfile(saved.content) }) }, [])
  const download = async () => { const { jsonl } = await api.exportData(); const url = URL.createObjectURL(new Blob([jsonl], { type: 'application/x-ndjson' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'local-ai-chat-studio.jsonl'; anchor.click(); URL.revokeObjectURL(url) }
  const stopStudio = async () => {
    if (!window.confirm('Stop Local AI Chat Studio? Active generations will be cancelled. Ollama and OpenCode will keep running.')) return
    setStopError('')
    try {
      await api.shutdown()
      setStopping(true)
    } catch (cause) {
      setStopError(messageOf(cause))
    }
  }
  return <Surface eyebrow="Local runtime" title="Settings" description="Operational defaults and portable data controls are visible here."><div className="surface-grid"><Card><CardHeader><CardTitle>Privacy and data</CardTitle></CardHeader><CardContent className="stack-list"><div className="data-row"><span>Cloud context</span><Badge>Prompt only</Badge></div><div className="data-row"><span>Credentials</span><Badge variant="outline">Process memory</Badge></div><div className="data-row"><span>Context output reserve</span><Badge variant="outline">20%</Badge></div><Textarea onChange={(event) => setProfile(event.target.value)} placeholder="Personalization profile" value={profile} /><Button onClick={() => api.setProfile(profile)} variant="outline">Save profile</Button><Button onClick={download} variant="outline"><Download /> Export JSONL</Button><input accept=".jsonl,.ndjson,.txt" hidden onChange={async (event) => { const file = event.target.files?.[0]; if (file) { await api.importData(await file.text()); await onRefresh() } }} ref={importRef} type="file" /><Button onClick={() => importRef.current?.click()} variant="outline"><FileUp /> Import JSONL</Button><Button onClick={async () => { if (window.confirm('Import the previous v2 database into data/app.db? A backup is created first.')) { await api.importV2(); await onRefresh() } }} variant="outline">Import previous v2 data</Button><Button onClick={async () => { if (window.confirm('Permanently wipe all local workspace data?')) { await api.wipeData(); await onRefresh() } }} variant="destructive"><Trash2 /> Panic wipe</Button></CardContent></Card><Card><CardHeader><CardTitle>Runtime</CardTitle></CardHeader><CardContent className="stack-list"><div className="data-row"><span>FastAPI</span><Badge variant={connected ? 'default' : 'destructive'}>{connected ? 'Connected' : 'Unavailable'}</Badge></div><div className="data-row"><span>Ollama</span><Badge variant={runtime?.ollama_available ? 'default' : 'outline'}>{runtime?.ollama_available ? 'Available' : 'Offline'}</Badge></div>{runtime?.running_models.map((model) => <div className="data-row" key={model.name}><span>{model.name}</span><small>{model.size_gb.toFixed(1)} GB VRAM</small></div>)}<div className="data-row"><span>Canonical data</span><code>data/app.db</code></div><div className="data-row"><span>Vector data</span><code>data/chroma</code></div><Button aria-label={stopping ? 'Stopping…' : 'Stop Studio'} disabled={stopping} onClick={stopStudio} variant="destructive"><Power /> {stopping ? 'Stopping…' : 'Stop Studio'}</Button>{stopping && <small>Studio stopped. You may close this tab.</small>}{stopError && <small className="error-strip">{stopError}</small>}</CardContent></Card></div></Surface>
}
