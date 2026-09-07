import { useEffect, useRef } from "react"

export const reducedMotion: boolean =
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

export type Frame = (elapsed: number, dt: number, running: boolean) => void
export type Clock = {
  elapsed(): number
  running(): boolean
  run(on: boolean): void
  tempo(x: number): void
  seek(ms: number): void
  reset(): void
  start(): void
  stop(): void
  bindScrub(input: HTMLInputElement, period: () => number): void
}

// elapsed advances only while running, scaled by tempo; the frame callback fires every rAF regardless
export function clock(frame: Frame, o: { tempo?: number; running?: boolean } = {}): Clock {
  let t = 0
  let tempo = o.tempo ?? 1
  let running = o.running ?? true
  let last = 0
  let raf = 0
  let scrub: { input: HTMLInputElement; period: () => number } | null = null
  const tick = (now: number) => {
    const dt = last ? now - last : 0
    last = now
    if (running) t += dt * tempo
    if (scrub && running) {
      const p = scrub.period() || 1
      scrub.input.value = (((t % p) / p) * 100).toFixed(1)
    }
    frame(t, dt, running)
    raf = requestAnimationFrame(tick)
  }
  return {
    elapsed: () => t,
    running: () => running,
    run: on => {
      running = on
    },
    tempo: x => {
      tempo = x
    },
    seek: ms => {
      t = ms
    },
    reset: () => {
      t = 0
      last = 0
    },
    start: () => {
      if (!raf) raf = requestAnimationFrame(tick)
    },
    stop: () => {
      cancelAnimationFrame(raf)
      raf = 0
    },
    bindScrub(input, period) {
      scrub = { input, period }
      input.addEventListener("input", () => {
        t = (Number(input.value) / 100) * (period() || 1)
      })
    },
  }
}

export function useClock(frame: Frame, o: { tempo?: number; running?: boolean } = {}): Clock {
  const cb = useRef<Frame>(frame)
  cb.current = frame
  const ref = useRef<Clock | null>(null)
  if (!ref.current) ref.current = clock((e, dt, r) => cb.current(e, dt, r), o)
  const c = ref.current
  useEffect(() => {
    c.start()
    return () => c.stop()
  }, [c])
  return c
}
