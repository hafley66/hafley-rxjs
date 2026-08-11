import { useEffect, useRef } from "react"
import type { MarbleEvent, MarblePhase } from "./0_types"

const ROW_HEIGHT = 44
const HEADER_HEIGHT = 55
const PHASE_COLOR: Record<MarblePhase["kind"], string> = {
  queue: "#777f8b",
  send: "#d59b47",
  wait: "#8e57bc",
  receive: "#3f8dbd",
  work: "#49a56b",
}

export function WaterfallCanvas({ rows, scroller, domain = [0, 3000] }: {
  rows: MarbleEvent[]
  scroller: React.RefObject<HTMLDivElement | null>
  domain?: readonly [number, number]
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const host = scroller.current
    if (!canvas || !host) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const draw = () => {
      const width = Math.max(1, host.clientWidth - 690)
      const height = Math.max(1, host.clientHeight - HEADER_HEIGHT)
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      canvas.style.transform = `translateY(${host.scrollTop}px)`
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.clearRect(0, 0, width, height)

      const scrollTop = host.scrollTop
      const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT))
      const last = Math.min(rows.length, Math.ceil((scrollTop + height) / ROW_HEIGHT) + 1)
      const span = Math.max(1, domain[1] - domain[0])
      const x = (time: number) => ((time - domain[0]) / span) * width
      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace"
      ctx.textBaseline = "middle"

      for (let i = first; i < last; i++) {
        const row = rows[i]
        const y = i * ROW_HEIGHT - scrollTop
        for (const phase of row.phases) {
          const left = x(phase.start)
          ctx.fillStyle = PHASE_COLOR[phase.kind]
          ctx.fillRect(left, y + 16, Math.max(2, x(phase.end) - left), 12)
        }
        ctx.fillStyle = "#b8bec8"
        ctx.fillText(`${row.duration} ms`, Math.min(width - 42, x(row.start + row.duration) + 6), y + 22)
      }
    }

    const resize = new ResizeObserver(draw)
    resize.observe(host)
    host.addEventListener("scroll", draw, { passive: true })
    draw()
    return () => {
      resize.disconnect()
      host.removeEventListener("scroll", draw)
    }
  }, [rows, scroller, domain[0], domain[1]])

  return <canvas ref={canvasRef} className="waterfall-canvas" data-testid="waterfall-canvas" />
}
