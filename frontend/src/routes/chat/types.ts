// Chat route: shared types passed between ChatWorkspace and the composer/message
// components it composes. No logic here — see ChatWorkspace.tsx for how these are used.
import type { ConversationExportFormat, ConversationSettings } from '@/api/client'

export type ContextMode = 'full' | 'chat' | 'files'

export type ComposerSettings = {
  contextMode: ContextMode
  temperature: number
  includeWeb: boolean
  autoCompressHistory: boolean
}

export type ConversationLayout = ConversationSettings['layout']
export type ChatExportFormat = ConversationExportFormat | 'bundle'
export type AttachmentStage = 'uploading' | 'processing'
