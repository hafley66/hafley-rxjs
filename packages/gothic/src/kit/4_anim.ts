export const reducedMotion: boolean =
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

// draw-in: add class kit-draw to any svg ancestor; --kit-ms and --kit-stagger tune it; stagger() numbers the paths
export function stagger(root: ParentNode, selector = "path"): number {
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
  raf = requestAnimationFrame(tick)
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
    },
    stop: () => cancelAnimationFrame(raf),
    bindScrub(input, period) {
      scrub = { input, period }
      input.addEventListener("input", () => {
        t = (Number(input.value) / 100) * (period() || 1)
      })
    },
  }
}
