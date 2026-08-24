import { Application, Container, Graphics } from "pixi.js"
import { useEffect, useRef } from "react"
import { densityBuckets, type TimelineGesture, type TimelineMark, type TimeViewport } from "./0a_TimeViewport.js"

const LANE_HEIGHT = 14
const LANE_TOP = 10
const VERTICAL_PADDING = 12

export type TimeNavigatorPixiProps = {
  marks: readonly TimelineMark[]
  viewport: TimeViewport
  highlightedId?: string | null
  laneLabels?: readonly string[]
  onMarkHover?: (id: string | null) => void
  onGesture: (gesture: TimelineGesture) => void
}

export function TimeNavigatorPixi({ marks, viewport, highlightedId = null, laneLabels = [], onMarkHover, onGesture }: TimeNavigatorPixiProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ marks, viewport, highlightedId, laneLabels, onMarkHover, onGesture })
  const drawRef = useRef<() => void>(() => {})
  const laneCount = Math.max(1, marks.reduce((count, mark) => {
    if (mark.kind === "link") return Math.max(count, mark.from.lane + 1, mark.to.lane + 1)
    return Math.max(count, (mark.lane ?? 0) + 1)
  }, 1))
  const navigatorHeight = LANE_TOP + laneCount * LANE_HEIGHT + VERTICAL_PADDING
  stateRef.current = { marks, viewport, highlightedId, laneLabels, onMarkHover, onGesture }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const app = new Application()
    let disposed = false
    let scene: Container | null = null
    let overview: Graphics | null = null
    let viewportGraphic: Graphics | null = null
    let dragX: number | null = null
    let hoveredMarkId: string | null = null
    let hitDots: Array<{ id: string; x: number; y: number }> = []

    const draw = () => {
      if (!scene || !overview || !viewportGraphic || disposed) return
      const overviewGraphics = overview
      const viewportWindow = viewportGraphic
      const width = Math.max(1, host.clientWidth)
      const height = Math.max(1, host.clientHeight)
      const { marks: currentMarks, viewport: currentViewport, highlightedId: currentHighlightedId, laneLabels: currentLaneLabels } = stateRef.current
      const plotLeft = currentLaneLabels.length > 0 ? 190 : 0
      const plotWidth = Math.max(1, width - plotLeft)
      const [fullStart, fullEnd] = currentViewport.full
      const fullSpan = Math.max(1, fullEnd - fullStart)
      const x = (time: number) => plotLeft + ((time - fullStart) / fullSpan) * plotWidth
      app.renderer.resize(width, height)
      overviewGraphics.clear()
      viewportWindow.clear()

      const density = densityBuckets(currentMarks, currentViewport.full, Math.max(1, Math.floor(plotWidth / 2)))
      const peak = density.reduce((max, value) => Math.max(max, value), 1)
      hitDots = []
      density.forEach((value, index) => {
        if (value === 0) return
        const barHeight = Math.max(1, (value / peak) * (height - 12))
        overviewGraphics.rect(plotLeft + index * 2, height - barHeight, 1, barHeight).fill({ color: 0x70839b, alpha: 0.18 })
      })

      if (currentLaneLabels.length > 0) {
        currentLaneLabels.forEach((_, lane) => {
          const y = LANE_TOP + lane * LANE_HEIGHT
          overviewGraphics.moveTo(plotLeft, y).lineTo(width, y).stroke({ color: 0x566170, alpha: 0.55, width: 1 })
        })
      }

      if (currentMarks.length <= width * 4) currentMarks.forEach((mark) => {
        if (mark.kind === "dot") {
          const markX = x(mark.time)
          const markY = LANE_TOP + (mark.lane ?? 0) * LANE_HEIGHT
          if (mark.variant === "complete") {
            overviewGraphics.moveTo(markX, markY - 5).lineTo(markX, markY + 5).stroke({ color: 0x7fc49a, alpha: 1, width: 2 })
          } else if (mark.variant === "error") {
            overviewGraphics.moveTo(markX - 4, markY - 4).lineTo(markX + 4, markY + 4).moveTo(markX + 4, markY - 4).lineTo(markX - 4, markY + 4).stroke({ color: 0xd77b85, alpha: 1, width: 2 })
          } else if (mark.variant === "suppressed") {
            overviewGraphics.circle(markX, markY, 3).stroke({ color: 0x7d8794, alpha: 0.8, width: 1 })
          } else {
            overviewGraphics.circle(markX, markY, 4).fill({ color: 0x91b8e3, alpha: 1 })
          }
          hitDots.push({ id: mark.id, x: markX, y: markY })
        } else if (mark.kind === "span") {
          const markX = x(mark.start)
          const markY = LANE_TOP + (mark.lane ?? 0) * LANE_HEIGHT
          overviewGraphics.rect(markX, markY - 2, Math.max(1, x(mark.end) - markX), 3).fill({ color: 0x8ca4c2, alpha: 0.65 })
          overviewGraphics.circle(markX, markY, 3).fill({ color: 0xd5dce5, alpha: 1 })
          hitDots.push({ id: mark.id, x: markX, y: markY })
        } else {
          const fromX = x(mark.from.time)
          const toX = x(mark.to.time)
          const fromY = LANE_TOP + mark.from.lane * LANE_HEIGHT
          const toY = LANE_TOP + mark.to.lane * LANE_HEIGHT
          overviewGraphics.moveTo(fromX, fromY).bezierCurveTo((fromX + toX) / 2, fromY, (fromX + toX) / 2, toY, toX, toY).stroke({ color: 0x8e9eb1, alpha: 0.5, width: 1 })
        }
      })

      const highlighted = currentMarks.find((mark) => mark.id === currentHighlightedId)
      if (highlighted?.kind === "dot") {
        overviewGraphics.circle(x(highlighted.time), LANE_TOP + (highlighted.lane ?? 0) * LANE_HEIGHT, 5).fill({ color: 0xe3e9f1, alpha: 1 })
      } else if (highlighted?.kind === "span") {
        overviewGraphics.rect(x(highlighted.start), LANE_TOP - 4 + (highlighted.lane ?? 0) * LANE_HEIGHT, Math.max(3, x(highlighted.end) - x(highlighted.start)), 8).fill({ color: 0xd9e2ee, alpha: 0.95 })
      } else if (highlighted?.kind === "link") {
        const fromX = x(highlighted.from.time)
        const toX = x(highlighted.to.time)
        const fromY = LANE_TOP + highlighted.from.lane * LANE_HEIGHT
        const toY = LANE_TOP + highlighted.to.lane * LANE_HEIGHT
        overviewGraphics.moveTo(fromX, fromY).bezierCurveTo((fromX + toX) / 2, fromY, (fromX + toX) / 2, toY, toX, toY).stroke({ color: 0xe3e9f1, alpha: 1, width: 2 })
      }

      const left = x(currentViewport.visible[0])
      const right = x(currentViewport.visible[1])
      viewportWindow.rect(plotLeft, 0, Math.max(0, left - plotLeft), height).fill({ color: 0x06080c, alpha: 0.58 })
      viewportWindow.rect(right, 0, Math.max(0, width - right), height).fill({ color: 0x06080c, alpha: 0.58 })
      viewportWindow.rect(left, 0, Math.max(2, right - left), height).stroke({ color: 0xa8b4c4, alpha: 0.9, width: 1 })
      viewportWindow.rect(left - 2, 0, 4, height).fill({ color: 0xb9c3d0, alpha: 0.75 })
      viewportWindow.rect(right - 2, 0, 4, height).fill({ color: 0xb9c3d0, alpha: 0.75 })
      app.renderer.render(app.stage)
    }
    drawRef.current = draw

    const initialize = async () => {
      await app.init({ width: 1, height: 1, autoStart: false, antialias: false, backgroundAlpha: 0, preference: "webgl" })
      if (disposed) return app.destroy(true, { children: true })
      app.canvas.setAttribute("data-testid", "time-navigator")
      app.canvas.setAttribute("aria-label", "Time overview and visible viewport")
      host.append(app.canvas)
      scene = new Container()
      overview = new Graphics()
      viewportGraphic = new Graphics()
      scene.addChild(overview, viewportGraphic)
      app.stage.addChild(scene)
      const resize = new ResizeObserver(draw)
      resize.observe(host)
      ;(app as Application & { __resize?: ResizeObserver }).__resize = resize
      draw()
    }
    void initialize()

    const pointerDown = (event: PointerEvent) => {
      dragX = event.clientX
      host.setPointerCapture(event.pointerId)
    }
    const pointerMove = (event: PointerEvent) => {
      if (dragX !== null) {
        const deltaPx = event.clientX - dragX
        dragX = event.clientX
        stateRef.current.onGesture({ type: "pan", deltaPx, widthPx: host.clientWidth })
        return
      }
      const bounds = host.getBoundingClientRect()
      const x = event.clientX - bounds.left
      const y = event.clientY - bounds.top
      const hit = hitDots.find((dot) => Math.abs(dot.x - x) <= 6 && Math.abs(dot.y - y) <= 6)?.id ?? null
      if (hit === hoveredMarkId) return
      hoveredMarkId = hit
      stateRef.current.onMarkHover?.(hit)
    }
    const pointerUp = (event: PointerEvent) => {
      dragX = null
      if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId)
    }
    const pointerLeave = () => {
      hoveredMarkId = null
      stateRef.current.onMarkHover?.(null)
    }
    const wheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        event.preventDefault()
        stateRef.current.onGesture({ type: "pan", deltaPx: -event.deltaX, widthPx: host.clientWidth })
      } else if (event.ctrlKey) {
        event.preventDefault()
        stateRef.current.onGesture({ type: "zoom", anchorPx: event.clientX - host.getBoundingClientRect().left, factor: Math.exp(event.deltaY * 0.0015), widthPx: host.clientWidth })
      }
    }
    const fit = () => stateRef.current.onGesture({ type: "fit" })
    host.addEventListener("pointerdown", pointerDown)
    host.addEventListener("pointermove", pointerMove)
    host.addEventListener("pointerup", pointerUp)
    host.addEventListener("pointercancel", pointerUp)
    host.addEventListener("pointerleave", pointerLeave)
    host.addEventListener("wheel", wheel, { passive: false })
    host.addEventListener("dblclick", fit)

    return () => {
      disposed = true
      drawRef.current = () => {}
      host.removeEventListener("pointerdown", pointerDown)
      host.removeEventListener("pointermove", pointerMove)
      host.removeEventListener("pointerup", pointerUp)
      host.removeEventListener("pointercancel", pointerUp)
      host.removeEventListener("pointerleave", pointerLeave)
      host.removeEventListener("wheel", wheel)
      host.removeEventListener("dblclick", fit)
      ;(app as Application & { __resize?: ResizeObserver }).__resize?.disconnect()
      if (app.renderer) app.destroy(true, { children: true })
    }
  }, [])

  useEffect(() => drawRef.current(), [marks, viewport, highlightedId, laneLabels])
  const labeledDots = laneLabels.length > 0 ? marks.filter((mark): mark is Extract<TimelineMark, { kind: "dot" }> => mark.kind === "dot" && Boolean(mark.label) && mark.variant !== "suppressed") : []
  const fullSpan = Math.max(1, viewport.full[1] - viewport.full[0])
  return <div ref={hostRef} className={laneLabels.length > 0 ? "time-navigator labeled" : "time-navigator"} style={{ height: navigatorHeight }} data-mark-count={marks.length}>
    {laneLabels.length > 0 && <div className="time-lane-labels">{laneLabels.map((label) => <span key={label}>{label}</span>)}</div>}
    {labeledDots.length > 0 && <div className="time-mark-values">{labeledDots.map((mark) => <span
      key={mark.id}
      style={{ left: `calc(190px + ${(mark.time - viewport.full[0]) / fullSpan} * (100% - 190px))`, top: LANE_TOP + (mark.lane ?? 0) * LANE_HEIGHT - 7 }}
    >{mark.label}</span>)}</div>}
  </div>
}
