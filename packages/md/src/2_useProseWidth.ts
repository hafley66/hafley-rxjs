import { useCallback, useMemo } from "react"
import { useSignal } from "@hafley66/signals/react"
import type { CSSProperties } from "react"
import {
  clampProseWidth,
  DEFAULT_PROSE_WIDTH,
  normalizeProseWidthBounds,
  type ProseWidthBounds,
} from "./lib/1_proseWidth.js"
import {
  mdUi,
  proseWidthBounds,
  setProseWidthBounds,
  setProseWidthFor,
} from "./signals.js"

export interface ProseWidthModel {
  width: number
  bounds: ProseWidthBounds
  style: CSSProperties
  setWidth: (value: number) => void
  setBounds: (bounds: Partial<ProseWidthBounds>) => void
  reset: () => void
}

export function useProseWidth(pid: string): ProseWidthModel {
  // This hook remains reactive when used outside SignalReact, which lets the
  // toolbar and the content edge be mounted independently.
  const ui = useSignal(mdUi.$)
  const bounds = proseWidthBounds()
  const width = clampProseWidth(ui.proseWidths[pid] ?? ui.proseWidth, bounds)

  const setWidth = useCallback(
    (value: number) => setProseWidthFor(pid, value),
    [pid],
  )
  const setBounds = useCallback(
    (patch: Partial<ProseWidthBounds>) => setProseWidthBounds(patch),
    [],
  )
  const reset = useCallback(
    () => setWidth(DEFAULT_PROSE_WIDTH),
    [setWidth],
  )
  const style = useMemo(
    () => ({ "--md-prose-width": `${width}px` }) as CSSProperties,
    [width],
  )

  return {
    width,
    bounds: normalizeProseWidthBounds(bounds),
    style,
    setWidth,
    setBounds,
    reset,
  }
}
