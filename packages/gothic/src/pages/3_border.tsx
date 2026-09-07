import type { AnySpec, ValuesOf } from "@hafley66/report-shell"
import { type RefObject, useEffect, useRef } from "react"
import type { PageSpec } from "../app/0_pages.js"
import type { SectionState } from "../app/2_state.js"
import { border, f, mulberry32, type Plan, plan } from "../lib/index.js"
import { reducedMotion, useClock } from "../ui/0_hooks.js"
import { inputId } from "../ui/1_Bar.js"
import { Section } from "../ui/2_Section.js"

const SPEC = {
  seed: { kind: "seed", hint: "seed for the rails, the corners and the random rects", default: 7 },
  rail: {
    kind: "select",
    hint: "edge motif repeated along each side; auto picks from the seed",
    options: ["auto", "cusp", "ogee", "crenel", "dagger", "plain"],
    default: "auto",
  },
  corner: {
    kind: "select",
    hint: "motif at each corner; auto picks from the seed",
    options: ["auto", "loop", "point", "trefoil", "spiral", "none"],
    default: "auto",
  },
  cell: { kind: "range", hint: "motif cell size in px", min: 8, max: 64, default: 22 },
  depth: { kind: "range", hint: "how far the motif reaches into the rect, in px", min: 2, max: 24, default: 6 },
  weight: {
    kind: "range",
    hint: "stroke width multiplier for every path in the section",
    min: 0.5,
    max: 4,
    step: 0.1,
    default: 1.2,
    static: true,
  },
  t: {
    kind: "range",
    hint: "pen position along the one continuous path, in %; the loop drives it while playing",
    min: 0,
    max: 100,
    step: 0.1,
    default: 100,
    label: "offset",
    shuffle: false,
  },
  ms: { kind: "number", hint: "one full pass of the pen, in ms", default: 4000, step: 250, shuffle: false },
  ghost: { kind: "bool", hint: "show the finished path faintly under the ink", default: true, static: true },
  pen: { kind: "bool", hint: "show the pen dot at the drawing tip", default: true, static: true },
} as const satisfies AnySpec
type V = ValuesOf<typeof SPEC>
const PRESETS = {
  cathedral: { rail: "cusp", corner: "trefoil", cell: 18, depth: 5 },
  castle: { rail: "crenel", corner: "point", cell: 28, depth: 8 },
} satisfies Record<string, Partial<V>>

type Host = { el: HTMLElement; ink: SVGPathElement; pen: SVGCircleElement; len: number; p: Plan }

function mount(el: HTMLElement, i: number, v: V): Host {
  const w = el.offsetWidth
  const h = el.offsetHeight
  const p = plan(w, h, v.seed * 7919 + i * 104729, v)
  const d = border(w, h, p)
  let svg = el.querySelector<SVGSVGElement>("svg.frame")
  if (!svg) {
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.classList.add("frame")
    el.append(svg)
  }
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`)
  svg.innerHTML = `<path class="ghost" d="${d}"/><path class="ink" d="${d}" pathLength="1"/><circle class="pen" r="2.5"/>`
  const ink = svg.querySelector(".ink") as SVGPathElement
  const pen = svg.querySelector(".pen") as SVGCircleElement
  const len = ink.getTotalLength()
  const cap = el.querySelector(".cap") as HTMLElement
  cap.textContent = `${p.rail.join("/")} · ${p.corner} · ${Math.round(len)}px`
  return { el, ink, pen, len, p }
}

// random rects: seeded by seed, so the layout replays; sizes 48..320
function spawnRects(stage: HTMLElement, seed: number): void {
  const rng = mulberry32(seed ^ 0x9e3779b9)
  const W = stage.clientWidth
  const H = stage.clientHeight
  const n = 8 + Math.floor(rng() * 6)
  stage.innerHTML = ""
  for (let i = 0; i < n; i++) {
    const w = 48 + Math.floor(rng() * 272)
    const h = 40 + Math.floor(rng() * 200)
    const el = document.createElement("div")
    el.className =
      "host absolute grid place-items-center rounded-[2px] text-xs uppercase tracking-[0.04em] text-[color-mix(in_oklab,var(--color-fg)_70%,var(--hb))]"
    el.style.cssText = `left:${Math.floor(rng() * (W - w))}px;top:${Math.floor(rng() * (H - h))}px;width:${w}px;height:${h}px;--hb:oklch(${18 + rng() * 10}% .02 ${rng() * 360});background:var(--hb)`
    el.innerHTML = `<span>${w}×${h}</span><span class="cap absolute left-1.5 bottom-1 text-[10px] normal-case tracking-normal text-[#8b8f9c]"></span>`
    stage.append(el)
  }
}

type Props = {
  v: V
  state: SectionState<AnySpec>
  stats: RefObject<HTMLSpanElement | null>
  tv: RefObject<HTMLElement | null>
  playBtn: RefObject<HTMLButtonElement | null>
  respawn: RefObject<HTMLButtonElement | null>
}

function BorderBody({ v, state, stats, tv, playBtn, respawn }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const hosts = useRef<Host[]>([])
  const knobs = useRef<V>(v)
  knobs.current = v

  const scrub = (t: number) => {
    document.documentElement.style.setProperty("--t", String(t))
    if (tv.current) tv.current.textContent = `${(t * 100).toFixed(1)}%`
    for (const m of hosts.current) {
      const q = m.ink.getPointAtLength(t * m.len)
      m.pen.setAttribute("cx", String(f(q.x)))
      m.pen.setAttribute("cy", String(f(q.y)))
    }
  }
  const renderAll = () => {
    const stage = stageRef.current
    if (!stage) return
    hosts.current = [...stage.querySelectorAll<HTMLElement>(".host")].map((el, i) => mount(el, i, knobs.current))
    scrub(tInput()?.value ? Number(tInput()?.value) / 100 : knobs.current.t / 100)
    if (stats.current) stats.current.textContent = `${hosts.current.length} rects`
  }
  const tInput = () => document.getElementById(inputId("border", "t")) as HTMLInputElement | null
  const spawn = () => {
    const stage = stageRef.current
    if (!stage) return
    spawnRects(stage, knobs.current.seed)
    renderAll()
  }

  useEffect(() => {
    document.documentElement.style.setProperty("--w", `${v.weight}px`)
  }, [v.weight])
  useEffect(() => {
    document.body.classList.toggle("noghost", !v.ghost)
    document.body.classList.toggle("nopen", !v.pen)
  }, [v.ghost, v.pen])
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new seed means a new rect layout
  useEffect(() => {
    spawn()
  }, [v.seed])
  // biome-ignore lint/correctness/useExhaustiveDependencies: the plan knobs redraw the same rects
  useEffect(() => {
    renderAll()
  }, [v.rail, v.corner, v.cell, v.depth])
  // biome-ignore lint/correctness/useExhaustiveDependencies: the offset only moves the pen
  useEffect(() => {
    if (!tInput()?.dataset.live) scrub(v.t / 100)
  }, [v.t])
  useEffect(() => {
    const onResize = () => renderAll()
    addEventListener("resize", onResize)
    return () => removeEventListener("resize", onResize)
  })

  // play: t advances by dt / ms and loops; the slider is live while playing, the url takes t on pause
  const clk = useClock(
    (_e, dt, running) => {
      const input = tInput()
      if (!running || !input) return
      let t = Number(input.value) / 100 + dt / knobs.current.ms
      if (t > 1) t -= 1
      input.value = (t * 100).toFixed(1)
      scrub(t)
    },
    { running: false },
  )

  useEffect(() => {
    const btn = playBtn.current
    const re = respawn.current
    if (!btn || !re) return
    const play = () => {
      const input = tInput()
      if (!input) return
      if (clk.running()) {
        clk.run(false)
        delete input.dataset.live
        btn.textContent = "play"
        state.set({ t: Number(input.value) })
        return
      }
      if (reducedMotion) return
      input.dataset.live = "1"
      btn.textContent = "pause"
      clk.run(true)
    }
    btn.addEventListener("click", play)
    re.addEventListener("click", spawn)
    return () => {
      btn.removeEventListener("click", play)
      re.removeEventListener("click", spawn)
    }
  })

  return <div ref={stageRef} id="stage" className="relative mx-4 mb-4 h-[760px] overflow-hidden" />
}

function BorderPage() {
  const stats = useRef<HTMLSpanElement>(null)
  const tv = useRef<HTMLElement>(null)
  const playBtn = useRef<HTMLButtonElement>(null)
  const respawn = useRef<HTMLButtonElement>(null)
  const btn = "rounded-sm border border-edge px-1.5 py-px text-fg hover:border-ink"
  const extra = (
    <>
      <button
        ref={respawn}
        type="button"
        className={`respawn ${btn}`}
        title="new random rects under the same border settings; the pen restarts"
      >
        respawn rects
      </button>
      <button
        ref={playBtn}
        type="button"
        className={`play ${btn}`}
        title="run the pen from 0 to 100% over ms; the offset slider follows"
      >
        play
      </button>
      <b ref={tv} className="tv min-w-[6ch] font-medium text-fg tabular-nums" title="pen position along the path">
        100%
      </b>
      <span ref={stats} />
    </>
  )
  return (
    <Section page="border" def={{ id: "border", title: "border", spec: SPEC, presets: PRESETS }} extra={extra}>
      {(v, ctx) => (
        <BorderBody v={v as V} state={ctx.state} stats={stats} tv={tv} playBtn={playBtn} respawn={respawn} />
      )}
    </Section>
  )
}

export const PAGE: PageSpec = {
  id: "border",
  title: "gothic: border draw lab",
  path: "/border",
  specs: { border: SPEC },
  Component: BorderPage,
}
