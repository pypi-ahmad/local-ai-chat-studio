import { useCallback, useEffect, useState } from 'react'

import type { InspectorTab } from '@/features/context/ContextInspector'
import { readStoredBoolean, writeStoredBoolean } from '@/state/uiPreferences'

function readInspectorTab(): InspectorTab {
  try {
    return localStorage.getItem('chat-studio.inspector-tab') === 'evidence' ? 'evidence' : 'context'
  } catch {
    return 'context'
  }
}

function readHistoryWidth() {
  try {
    const stored = Number(localStorage.getItem('chat-studio.history-width'))
    return Number.isFinite(stored) && stored >= 224 && stored <= 420 ? stored : 272
  } catch {
    return 272
  }
}

export function useWorkspacePreferences() {
  const [navigationCollapsed, setNavigationCollapsed] = useState(() => readStoredBoolean('chat-studio.navigation-collapsed', false))
  const [inspectorOpen, setInspectorOpen] = useState(() => readStoredBoolean('chat-studio.inspector-open', false))
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>(readInspectorTab)
  const [historyWidth, setStoredHistoryWidth] = useState(readHistoryWidth)

  useEffect(() => writeStoredBoolean('chat-studio.navigation-collapsed', navigationCollapsed), [navigationCollapsed])
  useEffect(() => writeStoredBoolean('chat-studio.inspector-open', inspectorOpen), [inspectorOpen])
  useEffect(() => {
    try { localStorage.setItem('chat-studio.inspector-tab', inspectorTab) } catch { /* Browser storage is optional. */ }
  }, [inspectorTab])

  const setHistoryWidth = useCallback((width: number) => {
    setStoredHistoryWidth(width)
    try { localStorage.setItem('chat-studio.history-width', String(width)) } catch { /* Browser storage is optional. */ }
  }, [])

  return {
    historyWidth,
    inspectorOpen,
    inspectorTab,
    navigationCollapsed,
    setHistoryWidth,
    setInspectorOpen,
    setInspectorTab,
    setNavigationCollapsed,
  }
}
