import { useEffect, useRef, useState } from "react"
import { gutter } from "@hafley66/xdom"
import { useSignal } from "@hafley66/signals/react"
import { clampProseWidth, normalizeProseWidthBounds } from "./lib/1_proseWidth.js"
import { proseWidthFor, proseWidthSignalFor, setProseWidthFor } from "./signals.js"
import { useProseWidth } from "./2_useProseWidth.js"

export interface ProseWidthControlProps {
  pid: string
  zoom?: number
  className?: string
}

/** Toolbar control with a keyboard-accessible width slider and editable bounds. */
export function ProseWidthControl({ pid, className }: ProseWidthControlProps) {
  const model = useProseWidth(pid)
  const [widthDraft, setWidthDraft] = useState(() => String(model.width))
  const [minDraft, setMinDraft] = useState(() => String(model.bounds.min))
  const [maxDraft, setMaxDraft] = useState(() => String(model.bounds.max))
  useEffect(() => setWidthDraft(String(model.width)), [model.width])
  useEffect(() => setMinDraft(String(model.bounds.min)), [model.bounds.min])
  useEffect(() => setMaxDraft(String(model.bounds.max)), [model.bounds.max])
  const commitWidth = () => {
    const width = clampProseWidth(Number(widthDraft), model.bounds)
    model.setWidth(width)
    setWidthDraft(String(width))
  }
  const commitBounds = (patch: { min?: number; max?: number }) => {
    const bounds = normalizeProseWidthBounds({ ...model.bounds, ...patch })
    model.setBounds(bounds)
    setMinDraft(String(bounds.min))
    setMaxDraft(String(bounds.max))
  }
  return (
    <div className={className} role="group" aria-label="Prose reading width">
      <label>
        width
        <input
          type="range"
          min={model.bounds.min}
          max={model.bounds.max}
          step={1}
          value={model.width}
          onChange={(event) => model.setWidth(Number(event.target.value))}
          aria-label="Prose reading width"
        />
      </label>
      <label>
        <span>px</span>
        <input
          type="number"
          min={model.bounds.min}
          max={model.bounds.max}
          step={1}
          value={widthDraft}
          onChange={(event) => setWidthDraft(event.target.value)}
          onBlur={commitWidth}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              event.currentTarget.blur()
            }
          }}
          aria-label="Prose width in pixels"
        />
      </label>
      <label>
        min
        <input
          type="number"
          min={240}
          max={2400}
          step={1}
          value={minDraft}
          onChange={(event) => setMinDraft(event.target.value)}
          onBlur={() => commitBounds({ min: Number(minDraft) })}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              event.currentTarget.blur()
            }
          }}
          aria-label="Minimum prose width in pixels"
        />
      </label>
      <label>
        max
        <input
          type="number"
          min={model.bounds.min}
          max={2400}
          step={1}
          value={maxDraft}
          onChange={(event) => setMaxDraft(event.target.value)}
          onBlur={() => commitBounds({ max: Number(maxDraft) })}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              event.currentTarget.blur()
            }
          }}
          aria-label="Maximum prose width in pixels"
        />
      </label>
      <button type="button" onClick={model.reset} aria-label="Reset prose width">
        reset
      </button>
    </div>
  )
}

/**
 * A draggable content edge. The edge itself is intentionally separate from
 * the toolbar so diagrams, code, tables, and other sealed blocks can stay
 * outside the prose width wrapper.
 */
export function ProseWidthHandle({ pid, zoom = 1, className }: ProseWidthControlProps) {
  const model = useProseWidth(pid)
  const ref = useRef<HTMLDivElement>(null)
  const widthSignal = proseWidthSignalFor(pid)
  const draggedWidth = useSignal(widthSignal.$)

  useEffect(() => {
    if (draggedWidth !== proseWidthFor(pid)) setProseWidthFor(pid, draggedWidth)
  }, [draggedWidth, pid])

  useEffect(() => {
    const element = ref.current
    if (!element) return
    return gutter(element, proseWidthSignalFor(pid), {
      axis: "x",
      commit: "release",
      // The ruler is centered: moving its right edge by one CSS pixel changes
      // both the left and right margins, so the stored width changes by two.
      scale: zoom,
      multiplier: 2,
    })
  }, [model.setWidth, pid, zoom])

  return (
    <div
      ref={ref}
      className={className}
      role="separator"
      tabIndex={0}
      aria-label="Resize prose reading width"
      aria-valuemin={model.bounds.min}
      aria-valuemax={model.bounds.max}
      aria-valuenow={model.width}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault()
          model.setWidth(model.width - 16)
        } else if (event.key === "ArrowRight") {
          event.preventDefault()
          model.setWidth(model.width + 16)
        } else if (event.key === "Home") {
          event.preventDefault()
          model.setWidth(model.bounds.min)
        } else if (event.key === "End") {
          event.preventDefault()
          model.setWidth(model.bounds.max)
        }
      }}
    />
  )
}
