import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Copy, GitBranch, ThumbsDown, ThumbsUp, Wrench } from 'lucide-react'

import type { Conversation } from '@/api/client'
import { ArtifactPreview } from '@/features/artifact-preview/ArtifactPreview'
import type { Artifact } from '@/features/artifact-preview/artifact'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { MarkdownContent } from '@/components/MarkdownContent'
import type { ConversationLayout } from '@/routes/chat/types'

export function MessageList({
  conversation,
  liveOutput,
  layout,
  loading = false,
  onBranch,
  onFeedback,
  onSuggestion,
}: {
  conversation: Conversation | null
  liveOutput: string
  layout: ConversationLayout
  loading?: boolean
  onBranch: (messageId: string) => Promise<void>
  onFeedback: (messageId: string, rating: -1 | 1) => Promise<void>
  onSuggestion: (prompt: string) => void
}) {
  const [artifact, setArtifact] = useState<Artifact | null>(null)
  const [messageIndex, setMessageIndex] = useState(0)
  const [atTranscriptEnd, setAtTranscriptEnd] = useState(true)
  const [unreadOutput, setUnreadOutput] = useState(false)
  const messageRefs = useRef(new Map<string, HTMLElement>())
  const messageRegionRef = useRef<HTMLDivElement>(null)
  const liveMessageRef = useRef<HTMLElement>(null)
  const atTranscriptEndRef = useRef(true)
  const previousConversationId = useRef<string | undefined>(undefined)
  const previousLiveOutput = useRef('')
  const messages = conversation?.messages ?? []
  const lastMessageId = messages.at(-1)?.id

  useLayoutEffect(() => {
    const changedConversation = previousConversationId.current !== conversation?.id
    previousConversationId.current = conversation?.id
    if (changedConversation) {
      setArtifact(null)
      atTranscriptEndRef.current = true
      setAtTranscriptEnd(true)
      setUnreadOutput(false)
      messageRefs.current.get(lastMessageId ?? '')?.scrollIntoView({ behavior: 'auto', block: 'end' })
    }
    if (changedConversation || atTranscriptEndRef.current) setMessageIndex(Math.max(0, messages.length - 1))
  }, [conversation?.id, lastMessageId, messages.length])
  useEffect(() => {
    const viewport = messageRegionRef.current?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')
    if (!viewport) return
    const trackPosition = () => {
      if (!viewport.scrollHeight && !viewport.clientHeight) return
      const atEnd = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 32
      atTranscriptEndRef.current = atEnd
      setAtTranscriptEnd(atEnd)
      if (atEnd) {
        setUnreadOutput(false)
        setMessageIndex(Math.max(0, messages.length - 1))
      }
    }
    viewport.addEventListener('scroll', trackPosition, { passive: true })
    trackPosition()
    return () => viewport.removeEventListener('scroll', trackPosition)
  }, [conversation?.id, messages.length])
  useEffect(() => {
    const receivedOutput = liveOutput.length > previousLiveOutput.current.length
    previousLiveOutput.current = liveOutput
    if (!receivedOutput) return
    if (atTranscriptEndRef.current) liveMessageRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
    else setUnreadOutput(true)
  }, [liveOutput])

  const navigateMessage = (nextIndex: number, block: ScrollLogicalPosition = 'center') => {
    const boundedIndex = Math.max(0, Math.min(messages.length - 1, nextIndex))
    atTranscriptEndRef.current = false
    setAtTranscriptEnd(false)
    setMessageIndex(boundedIndex)
    messageRefs.current.get(messages[boundedIndex]?.id)?.scrollIntoView({ behavior: 'smooth', block })
  }
  const jumpToBottom = () => {
    const finalIndex = Math.max(0, messages.length - 1)
    atTranscriptEndRef.current = true
    setAtTranscriptEnd(true)
    setUnreadOutput(false)
    setMessageIndex(finalIndex)
    const target = liveMessageRef.current ?? messageRefs.current.get(messages[finalIndex]?.id)
    target?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }

  return <div className={artifact ? 'chat-workbench has-artifact' : 'chat-workbench'}>
    <div className="message-region" ref={messageRegionRef}><ScrollArea className="message-area">
      <div className={`messages layout-${layout}`}>
        {loading && <div aria-label="Loading conversation" className="workspace-skeleton"><Skeleton /><Skeleton /><Skeleton /></div>}
        {!loading && !conversation?.messages.length && !liveOutput && <div className="welcome"><div className="signal-mark">LOCAL / CONTEXT / CONTROL</div><h3>Work with the whole trail visible.</h3><p>Inspect what enters the prompt, keep private context local, and replay any answer.</p><div className="prompt-suggestions"><Button onClick={() => onSuggestion('Compare two approaches and explain the tradeoffs.')} size="sm" variant="outline">Compare two approaches</Button><Button onClick={() => onSuggestion('Summarize the attached material and list the key decisions.')} size="sm" variant="outline">Summarize material</Button><Button onClick={() => onSuggestion('Review this idea for risks, assumptions, and next steps.')} size="sm" variant="outline">Review an idea</Button></div></div>}
        {messages.map((message, index) => <article className={`message ${message.role}${index === messageIndex && messages.length > 1 ? ' navigation-target' : ''}`} key={message.id} ref={(node) => { if (node) messageRefs.current.set(message.id, node); else messageRefs.current.delete(message.id) }}>
          {message.role === 'tool' ? <details className="tool-activity"><summary><Wrench /><span>Tool activity</span><small>Expand result</small><ChevronDown /></summary><div className="tool-activity-content"><MarkdownContent content={message.content} onArtifact={setArtifact} /></div></details> : <>
            <div className="message-label"><span>{message.role === 'user' ? 'You' : 'Assistant'}</span>{message.run_id && <Badge variant="outline">evidence saved</Badge>}</div>
            <MarkdownContent content={message.content} onArtifact={setArtifact} />
            <div className="message-actions"><Button onClick={() => navigator.clipboard.writeText(message.content)} size="sm" variant="ghost"><Copy /> Copy</Button><Button onClick={() => onBranch(message.id)} size="sm" variant="ghost"><GitBranch /> Branch here</Button>{message.role === 'assistant' && <><Button aria-label="Helpful" onClick={() => onFeedback(message.id, 1)} size="icon-sm" variant="ghost"><ThumbsUp /></Button><Button aria-label="Not helpful" onClick={() => onFeedback(message.id, -1)} size="icon-sm" variant="ghost"><ThumbsDown /></Button></>}</div>
          </>}
        </article>)}
        {liveOutput && <article className="message assistant live" ref={liveMessageRef}><div className="message-label"><span>Assistant</span><Badge>streaming</Badge></div><MarkdownContent content={liveOutput} onArtifact={setArtifact} /></article>}
      </div>
    </ScrollArea>{(messages.length > 0 || liveOutput) && <nav aria-label="Message navigation" className={unreadOutput ? 'message-navigator has-unread' : 'message-navigator'}>
      {unreadOutput && <span aria-label="Unread output" className="message-unread" role="status">New output</span>}
      <Button aria-label="Jump to top" disabled={!messages.length || messageIndex === 0} onClick={() => navigateMessage(0, 'start')} size="icon-sm" variant="ghost"><ChevronsUp /></Button>
      <Button aria-label="Previous message" disabled={!messages.length || messageIndex === 0} onClick={() => navigateMessage(messageIndex - 1)} size="icon-sm" variant="ghost"><ChevronUp /></Button>
      <span aria-live="polite" className="message-position">{messages.length ? `${messageIndex + 1} / ${messages.length}` : 'Live'}</span>
      <Button aria-label="Next message" disabled={!messages.length || messageIndex === messages.length - 1} onClick={() => navigateMessage(messageIndex + 1)} size="icon-sm" variant="ghost"><ChevronDown /></Button>
      <Button aria-label={unreadOutput ? 'Jump to bottom, new output available' : 'Jump to bottom'} className={unreadOutput ? 'unread-target' : undefined} disabled={atTranscriptEnd && !unreadOutput} onClick={jumpToBottom} size="icon-sm" variant="ghost"><ChevronsDown /></Button>
    </nav>}</div>
    {artifact && <ArtifactPreview artifact={artifact} onClose={() => setArtifact(null)} />}
  </div>
}
