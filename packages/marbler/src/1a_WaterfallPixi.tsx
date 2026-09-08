import { Application, Container, Graphics } from "pixi.js"
import { useEffect, useRef } from "react"

// pixi: `app.destroy(true)` also means releaseGlobalResources, which clears the batch pool shared by every renderer
// on the page; the other marbler canvas then pulls a destroyed Batch on its next frame. Drop the view only.
const DESTROY_RENDERER = { removeView: true } as const
import { DEFAULT_PHASE_STYLES, FALLBACK_PHASE_STYLE, type MarbleEvent, type PhaseStyle } from "./0_types.js"
import type { AggregateExtent } from "./1c_aggregate.js"

const ROW_HEIGHT = 44
const HEADER_HEIGHT = 55
const WATERFALL_LEFT = 690
const DEFAULT_DOMAIN = [0, 3000] as const
const BAR_TOP = 6
const BAR_HEIGHT = 32
const BAR_DEPTH_STEP = 6
const MIN_BAR_HEIGHT = 12
const BAR_COLOR = 0x8ca4c2
const BAR_RECEIPT_LIMIT = 40
const FRAME_ERROR_COLOR = 0xd05050
const FRAME_COLOR: Record<"in" | "out" | "self", number> = {
  in: 0x3f8dbd,
  out: 0x49a56b,
  self: 0x777f8b,
}

function hexNumber(color: string): number {
  return Number.parseInt(color.replace("#", ""), 16)
}

function barSpan(event: MarbleEvent, extent?: AggregateExtent): { start: number | null; end: number | null } {
  if (extent) return { start: extent.start, end: extent.end }
  if (event.start === null) return { start: null, end: null }
  return { start: event.start, end: event.start + (event.duration ?? 0) }
}

export type WaterfallPixiProps = {
  rows: MarbleEvent[]
  scroller: React.RefObject<HTMLDivElement | null>
  domain?: readonly [number, number]
  // Aggregate extents keyed by event id: a parent bar spans its subtree, stratified by tree depth.
  extents?: ReadonlyMap<string, AggregateExtent>
  leftOffset?: number
  phaseStyles?: Record<string, PhaseStyle>
  onEventHover?: (event: MarbleEvent | null) => void
  onEventSelect?: (event: MarbleEvent) => void
}

export function WaterfallPixi({
  rows,
  scroller,
  domain = DEFAULT_DOMAIN,
  extents,
  leftOffset = WATERFALL_LEFT,
  phaseStyles = DEFAULT_PHASE_STYLES,
  onEventHover,
  onEventSelect,
}: WaterfallPixiProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const rowsRef = useRef(rows)
  const domainRef = useRef(domain)
  const extentsRef = useRef(extents)
  const phaseStylesRef = useRef(phaseStyles)
  const callbacksRef = useRef({ onEventHover, onEventSelect })
  const renderRef = useRef<() => void>(() => {})

  rowsRef.current = rows
  domainRef.current = domain
  extentsRef.current = extents
  phaseStylesRef.current = phaseStyles
  callbacksRef.current = { onEventHover, onEventSelect }

  useEffect(() => {
    const mount = hostRef.current
    const scrollerElement = scroller.current
    if (!mount || !scrollerElement) return

    const app = new Application()
    let disposed = false
    let world: Container | null = null
    let phasesGraphic: Graphics | null = null
    let hoveredId: string | null = null
    let interactionElement: HTMLCanvasElement | null = null

    const hitTest = (event: MouseEvent) => {
      const bounds = (interactionElement ?? mount).getBoundingClientRect()
      const width = Math.max(1, bounds.width)
      const rowIndex = Math.floor((event.clientY - bounds.top + scrollerElement.scrollTop) / ROW_HEIGHT)
      const row = rowsRef.current[rowIndex]
      if (!row) return null
      const currentDomain = domainRef.current
      const time = currentDomain[0] + ((event.clientX - bounds.left) / width) * (currentDomain[1] - currentDomain[0])
      const { start, end } = barSpan(row, extentsRef.current?.get(row.id))
      return start !== null && end !== null && time >= start && time <= end ? row : null
    }
    const pointerMove = (event: MouseEvent) => {
      const row = hitTest(event)
      if ((row?.id ?? null) === hoveredId) return
      hoveredId = row?.id ?? null
      callbacksRef.current.onEventHover?.(row)
    }
    const pointerLeave = () => {
      if (hoveredId === null) return
      hoveredId = null
      callbacksRef.current.onEventHover?.(null)
    }
    const pointerClick = (event: MouseEvent) => {
      const row = hitTest(event)
      if (row) callbacksRef.current.onEventSelect?.(row)
    }

    const render = () => {
      if (!world || !phasesGraphic || disposed) return
      const width = Math.max(1, scrollerElement.clientWidth - leftOffset)
      const height = Math.max(1, scrollerElement.clientHeight - HEADER_HEIGHT)
      const scrollTop = scrollerElement.scrollTop
      const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT))
      const last = Math.min(rowsRef.current.length, Math.ceil((scrollTop + height) / ROW_HEIGHT) + 1)
      const currentDomain = domainRef.current
      const span = Math.max(1, currentDomain[1] - currentDomain[0])
      const x = (time: number) => ((time - currentDomain[0]) / span) * width

      app.renderer.resize(width, height)
      app.canvas.style.width = `${width}px`
      app.canvas.style.height = `${height}px`
      mount.style.width = `${width}px`
      mount.style.height = `${height}px`
      mount.style.transform = `translateY(${scrollTop}px)`
      phasesGraphic.clear()

      const receipts: string[] = []
      rowsRef.current.slice(first, last).forEach((event, visibleIndex) => {
        const y = (first + visibleIndex) * ROW_HEIGHT - scrollTop
        const extent = extentsRef.current?.get(event.id)
        const { start, end } = barSpan(event, extent)
        const barHeight = Math.max(MIN_BAR_HEIGHT, BAR_HEIGHT - (extent?.depth ?? 0) * BAR_DEPTH_STEP)
        const barY = y + BAR_TOP
        if (start !== null && end !== null && x(end) >= 0 && x(start) <= width) {
          const left = Math.max(-2, x(start))
          const right = Math.min(width + 2, x(end))
          phasesGraphic?.rect(left, barY, Math.max(2, right - left), barHeight).fill({ color: BAR_COLOR, alpha: 0.22 })
          if (receipts.length < BAR_RECEIPT_LIMIT) receipts.push(`${event.id}:${Math.round(left)}:${Math.round(right)}`)
        }
        const phaseY = barY + 3
        const phaseHeight = Math.max(4, barHeight - 6)
        event.phases.forEach((phase) => {
          if (phase.start === null || phase.end === null) return
          const left = x(phase.start)
          const style = phaseStylesRef.current[phase.kind] ?? FALLBACK_PHASE_STYLE
          phasesGraphic?.rect(left, phaseY, Math.max(2, x(phase.end) - left), phaseHeight).fill({ color: hexNumber(style.color), alpha: 0.86 })
        })
        event.frames?.forEach((frame) => {
          const color = frame.severity === "error" ? FRAME_ERROR_COLOR : FRAME_COLOR[frame.direction]
          phasesGraphic?.rect(x(frame.t), barY, 2, barHeight).fill({ color, alpha: 0.95 })
        })
      })
      mount.setAttribute("data-bars", receipts.join(","))
      app.renderer.render(app.stage)
    }
    renderRef.current = render

    const resize = new ResizeObserver(render)
    const initialize = async () => {
      await app.init({
        width: 1,
        height: 1,
        autoStart: false,
        antialias: false,
        backgroundAlpha: 0,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        preference: "webgl",
      })
      if (disposed) {
        app.destroy(DESTROY_RENDERER, { children: true })
        return
      }
      app.canvas.className = "waterfall-canvas"
      app.canvas.setAttribute("data-testid", "waterfall-pixi")
      mount.append(app.canvas)
      interactionElement = app.canvas
      interactionElement.addEventListener("mousemove", pointerMove)
      interactionElement.addEventListener("mouseleave", pointerLeave)
      interactionElement.addEventListener("click", pointerClick)
      app.stage.eventMode = "static"
      app.stage.hitArea = app.screen
      world = new Container({ isRenderGroup: true })
      phasesGraphic = new Graphics()
      world.addChild(phasesGraphic)
      app.stage.addChild(world)
      resize.observe(scrollerElement)
      scrollerElement.addEventListener("scroll", render, { passive: true })
      render()
    }
    void initialize()

    return () => {
      disposed = true
      renderRef.current = () => {}
      resize.disconnect()
      scrollerElement.removeEventListener("scroll", render)
      interactionElement?.removeEventListener("mousemove", pointerMove)
      interactionElement?.removeEventListener("mouseleave", pointerLeave)
      interactionElement?.removeEventListener("click", pointerClick)
      if (app.renderer) app.destroy(DESTROY_RENDERER, { children: true })
    }
  }, [scroller, leftOffset])

  useEffect(() => renderRef.current(), [rows, domain[0], domain[1], extents, phaseStyles])

  return <div ref={hostRef} className="waterfall-pixi" style={{ left: leftOffset }} />
}
