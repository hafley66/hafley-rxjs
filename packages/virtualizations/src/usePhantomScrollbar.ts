import { useCallback, useEffect, useState } from "react"
import { attachPhantomScrollbar } from "./phantomScrollbar"
import type { ScrollAxis } from "./scrollSync"

export type UsePhantomScrollbarOptions = {
  axis?: ScrollAxis
  onOverflowChange?: (overflowing: boolean) => void
}

export type UsePhantomScrollbarResult = {
  hostRef: (element: HTMLElement | null) => void
  contentRef: (element: HTMLElement | null) => void
  overflowing: boolean
}

// React binding over attachPhantomScrollbar. Callback refs backed by state so
// remounts re-attach the strip: when both host and content resolve, the
// phantom strip is created inside host. Returns the refs to spread onto your
// host strip and clipped content elements.
export function usePhantomScrollbar({
  axis = "x",
  onOverflowChange,
}: UsePhantomScrollbarOptions = {}): UsePhantomScrollbarResult {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [content, setContent] = useState<HTMLElement | null>(null)
  const [overflowing, setOverflowing] = useState(false)

  const hostRef = useCallback((element: HTMLElement | null) => setHost(element), [])
  const contentRef = useCallback((element: HTMLElement | null) => setContent(element), [])

  const handleOverflowChange = useCallback((next: boolean) => {
    setOverflowing(next)
    onOverflowChange?.(next)
  }, [onOverflowChange])

  // Re-attach whenever either element identity changes; a remount produces a
  // fresh node, so the old strip is disposed and a new one mirrors the new
  // content element.
  useEffect(() => {
    if (!host || !content) return
    const phantom = attachPhantomScrollbar({ host, content, axis, onOverflowChange: handleOverflowChange })
    return phantom.dispose
  }, [host, content, axis, handleOverflowChange])

  return { hostRef, contentRef, overflowing }
}
