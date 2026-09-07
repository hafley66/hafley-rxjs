import { useEffect, useRef } from "react"

export const reducedMotion: boolean =
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

// draw-in: every path carries pathLength=1 and gets --i for the stagger; the keyframes live in app.css
export function stagger(root: ParentNode | null, selector = "path"): number {
  if (!root) return 0
  let n = 0
  for (const svg of root.querySelectorAll("svg")) {
    let i = 0
    for (const e of svg.querySelectorAll<SVGElement>(selector)) e.style.setProperty("--i", String(i++))
    n += i
  }
  return n
}

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

// draw-in numbering after every render of the host
export function useDrawIn(ref: { current: HTMLElement | null }, deps: readonly unknown[]): void {
  useEffect(() => {
    stagger(ref.current)
  }, [ref, ...deps])
}

export function useResizeVar(ref: { current: HTMLElement | null }, name: string): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty(name, `${el.offsetHeight}px`))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, name])
}

const timelines = new Set<string>()
const VIEW_TIMELINES = typeof CSS !== "undefined" && CSS.supports("animation-timeline: view()")
let io: IntersectionObserver | null = null

// the anchor lights while its section intersects: a named view timeline, or IntersectionObserver where that is missing
export function useAnchor(id: string, ref: { current: HTMLElement | null }): void {
  useEffect(() => {
    const sec = ref.current
    const a = document.querySelector<HTMLAnchorElement>(`[data-anchor="${CSS.escape(id)}"]`)
    if (!sec || !a) return
    const name = `--kit-tl-${id.replace(/[^a-z0-9_-]/gi, "_")}`
    if (VIEW_TIMELINES) {
      timelines.add(name)
      sec.style.setProperty("view-timeline-name", name)
      a.style.setProperty("animation-timeline", name)
      document.body.style.setProperty("timeline-scope", [...timelines].join(", "))
      return () => {
        timelines.delete(name)
        sec.style.removeProperty("view-timeline-name")
        document.body.style.setProperty("timeline-scope", [...timelines].join(", "))
      }
    }
    io ??= new IntersectionObserver(
      entries => {
        for (const e of entries) {
          const link = document.querySelector<HTMLAnchorElement>(`[data-anchor="${CSS.escape(e.target.id)}"]`)
          if (link) link.toggleAttribute("data-active", e.isIntersecting)
        }
      },
      { rootMargin: "-10% 0px -10% 0px" },
    )
    io.observe(sec)
    return () => io?.unobserve(sec)
  }, [id, ref])
}
