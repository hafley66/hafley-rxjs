import { Application, Container, Graphics } from "pixi.js"
import { useEffect, useRef } from "react"
import type { MarbleEvent, MarblePhase } from "./0_types"

const ROW_HEIGHT = 44
const HEADER_HEIGHT = 55
const WATERFALL_LEFT = 690
const DEFAULT_DOMAIN = [0, 3000] as const
const PHASE_COLOR: Record<MarblePhase["kind"], number> = {
  queue: 0x777f8b,
  send: 0xd59b47,
  wait: 0x8e57bc,
  receive: 0x3f8dbd,
  work: 0x49a56b,
}

export type WaterfallPixiProps = {
  rows: MarbleEvent[]
  scroller: React.RefObject<HTMLDivElement | null>
  domain?: readonly [number, number]
  onEventHover?: (event: MarbleEvent | null) => void
  onEventSelect?: (event: MarbleEvent) => void
}

export function WaterfallPixi({
  rows,
  scroller,
  domain = DEFAULT_DOMAIN,
  onEventHover,
  onEventSelect,
}: WaterfallPixiProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const rowsRef = useRef(rows)
  const domainRef = useRef(domain)
  const callbacksRef = useRef({ onEventHover, onEventSelect })
  const renderRef = useRef<() => void>(() => {})

  rowsRef.current = rows
  domainRef.current = domain
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
      return time >= row.start && time <= row.start + row.duration ? row : null
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
      const width = Math.max(1, scrollerElement.clientWidth - WATERFALL_LEFT)
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
          const left = x(phase.start)
          phasesGraphic?.rect(left, y + 16, Math.max(2, x(phase.end) - left), 12).fill({ color: PHASE_COLOR[phase.kind], alpha: 0.86 })
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
  }, [scroller])

  useEffect(() => renderRef.current(), [rows, domain[0], domain[1]])

  return <div ref={hostRef} className="waterfall-pixi" />
}
