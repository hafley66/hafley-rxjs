import { Application, Container, Graphics } from "pixi.js"
import { useEffect, useRef } from "react"
import { DEFAULT_PHASE_STYLES, FALLBACK_PHASE_STYLE, type MarbleEvent, type PhaseStyle } from "./0_types.js"

const ROW_HEIGHT = 44
const HEADER_HEIGHT = 55
const WATERFALL_LEFT = 690
const DEFAULT_DOMAIN = [0, 3000] as const
const FRAME_ERROR_COLOR = 0xd05050
const FRAME_COLOR: Record<"in" | "out" | "self", number> = {
  in: 0x3f8dbd,
  out: 0x49a56b,
  self: 0x777f8b,
}

function hexNumber(color: string): number {
  return Number.parseInt(color.replace("#", ""), 16)
}

export type WaterfallPixiProps = {
  rows: MarbleEvent[]
  scroller: React.RefObject<HTMLDivElement | null>
  domain?: readonly [number, number]
  leftOffset?: number
  phaseStyles?: Record<string, PhaseStyle>
  onEventHover?: (event: MarbleEvent | null) => void
  onEventSelect?: (event: MarbleEvent) => void
}

export function WaterfallPixi({
  rows,
  scroller,
  domain = DEFAULT_DOMAIN,
  leftOffset = WATERFALL_LEFT,
  phaseStyles = DEFAULT_PHASE_STYLES,
  onEventHover,
  onEventSelect,
}: WaterfallPixiProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const rowsRef = useRef(rows)
  const domainRef = useRef(domain)
  const phaseStylesRef = useRef(phaseStyles)
  const callbacksRef = useRef({ onEventHover, onEventSelect })
  const renderRef = useRef<() => void>(() => {})

  rowsRef.current = rows
  domainRef.current = domain
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
      return row.start !== null && row.duration !== null && time >= row.start && time <= row.start + row.duration ? row : null
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

      rowsRef.current.slice(first, last).forEach((event, visibleIndex) => {
        const y = (first + visibleIndex) * ROW_HEIGHT - scrollTop
        event.phases.forEach((phase) => {
          if (phase.start === null || phase.end === null) return
          const left = x(phase.start)
          const style = phaseStylesRef.current[phase.kind] ?? FALLBACK_PHASE_STYLE
          phasesGraphic?.rect(left, y + 16, Math.max(2, x(phase.end) - left), 12).fill({ color: hexNumber(style.color), alpha: 0.86 })
        })
        event.frames?.forEach((frame) => {
          const color = frame.severity === "error" ? FRAME_ERROR_COLOR : FRAME_COLOR[frame.direction]
          phasesGraphic?.rect(x(frame.t), y + 16, 2, 12).fill({ color, alpha: 0.95 })
        })
      })
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
        app.destroy(true, { children: true })
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
      if (app.renderer) app.destroy(true, { children: true })
    }
  }, [scroller, leftOffset])

  useEffect(() => renderRef.current(), [rows, domain[0], domain[1], phaseStyles])

  return <div ref={hostRef} className="waterfall-pixi" style={{ left: leftOffset }} />
}
