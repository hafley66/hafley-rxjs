import type { Ticker } from "pixi.js"

export type PixiPanProbeReceipt = {
  pointerMoves: number
  gotPointerCapture: number
  lostPointerCapture: number
  frames: number
  droppedFrames: number
  frameGapP95Ms: number
  frameGapMaxMs: number
  stickyRequests: number
  stickyFlushes: number
}

export function createPixiPanProbe(config: {
  canvas: HTMLCanvasElement
  ticker: Ticker
  stickyReceipt: () => { requests: number; flushes: number }
  publish: (receipt: PixiPanProbeReceipt) => void
}): { destroy(): void } {
  let active = false
  let pointerMoves = 0
  let gotPointerCapture = 0
  let lostPointerCapture = 0
  let frameTimes: number[] = []
  let previousFrameTime = 0
  let stickyStart = config.stickyReceipt()

  const pointerDown = () => {
    active = true
    pointerMoves = 0
    gotPointerCapture = 0
    lostPointerCapture = 0
    frameTimes = []
    previousFrameTime = performance.now()
    stickyStart = config.stickyReceipt()
  }
  const pointerMove = () => {
    if (active) pointerMoves += 1
  }
  const capture = () => {
    if (active) gotPointerCapture += 1
  }
  const release = () => {
    if (active) lostPointerCapture += 1
  }
  const frame = () => {
    if (!active) return
    const now = performance.now()
    frameTimes.push(now - previousFrameTime)
    previousFrameTime = now
  }
  const pointerUp = () => {
    if (!active) return
    active = false
    const sorted = [...frameTimes].sort((left, right) => left - right)
    const stickyEnd = config.stickyReceipt()
    config.publish({
      pointerMoves,
      gotPointerCapture,
      lostPointerCapture,
      frames: frameTimes.length,
      droppedFrames: frameTimes.filter(value => value > 16.67).length,
      frameGapP95Ms: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0,
      frameGapMaxMs: sorted.at(-1) ?? 0,
      stickyRequests: stickyEnd.requests - stickyStart.requests,
      stickyFlushes: stickyEnd.flushes - stickyStart.flushes,
    })
  }

  config.canvas.addEventListener("pointerdown", pointerDown)
  config.canvas.addEventListener("pointermove", pointerMove)
  config.canvas.addEventListener("gotpointercapture", capture)
  config.canvas.addEventListener("lostpointercapture", release)
  window.addEventListener("pointerup", pointerUp)
  window.addEventListener("pointercancel", pointerUp)
  config.ticker.add(frame)

  return {
    destroy() {
      config.canvas.removeEventListener("pointerdown", pointerDown)
      config.canvas.removeEventListener("pointermove", pointerMove)
      config.canvas.removeEventListener("gotpointercapture", capture)
      config.canvas.removeEventListener("lostpointercapture", release)
      window.removeEventListener("pointerup", pointerUp)
      window.removeEventListener("pointercancel", pointerUp)
      config.ticker.remove(frame)
    },
  }
}
