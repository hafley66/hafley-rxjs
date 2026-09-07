import { type AnySpec, type ValuesOf, clock, commit, inputId, page, reducedMotion, section } from "../kit/index.js"
import { f, mulberry32, pick } from "../lib/index.js"
import { LINKS } from "./0_nav.js"
import "./border.css"

// ---------- 1. local path recorder ----------
// local frame: +x along the edge, +y inward. maps are rotations only (det +1), so arc sweep flags survive.
type Cmd =
  | { k: "M" | "L" | "Q" | "C"; p: [number, number][] }
  | { k: "A"; r: number; sweep: number; large: number; p: [number, number][] }
type Rec = {
  M(x: number, y: number): Rec
  L(x: number, y: number): Rec
  Q(cx: number, cy: number, x: number, y: number): Rec
  C(a: number, b: number, d: number, e: number, x: number, y: number): Rec
  A(r: number, x: number, y: number, sweep?: number, large?: number): Rec
  cmds: Cmd[]
}
function rec(): Rec {
  const c: Cmd[] = []
  const api: Rec = {
    M: (x, y) => {
      c.push({ k: "M", p: [[x, y]] })
      return api
    },
    L: (x, y) => {
      c.push({ k: "L", p: [[x, y]] })
      return api
    },
    Q: (cx, cy, x, y) => {
      c.push({
        k: "Q",
        p: [
          [cx, cy],
          [x, y],
        ],
      })
      return api
    },
    C: (a, b, d, e, x, y) => {
      c.push({
        k: "C",
        p: [
          [a, b],
          [d, e],
          [x, y],
        ],
      })
      return api
    },
    A: (r, x, y, sweep = 1, large = 0) => {
      c.push({ k: "A", r, sweep, large, p: [[x, y]] })
      return api
    },
    cmds: c,
  }
  return api
}
type Map2 = (p: [number, number]) => [number, number]
function emit(cmds: Cmd[], map: Map2): string {
  let s = ""
  for (const c of cmds) {
    const p = c.p.map(map).map(([x, y]) => `${f(x)} ${f(y)}`)
    s += c.k === "A" ? `A${f(c.r)} ${f(c.r)} 0 ${c.large} ${c.sweep} ${p[0]}` : c.k + p.join(" ")
  }
  return s
}

// ---------- 2. rails: one edge, local u in [0, L], v inward ----------
// count fits the edge: n = round(L / cell) cells of width c = L / n. every rail starts at (0,0) and ends at (L,0).
const fitCells = (L: number, cell: number) => {
  const n = Math.max(1, Math.round(L / cell))
  return { n, c: L / n }
}
const sagittaR = (c: number, d: number) => ((c * c) / 4 + d * d) / (2 * d)
type Rail = (L: number, cell: number, d: number) => Rec
export const rails: Record<string, Rail> = {
  plain: L => rec().L(L, 0),
  cusp: (L, cell, d) => {
    const { n, c } = fitCells(L, cell)
    const r = sagittaR(c, d)
    const p = rec()
    for (let i = 1; i <= n; i++) p.A(r, i * c, 0, 1)
    return p
  },
  ogee: (L, cell, d) => {
    const { n, c } = fitCells(L, cell)
    const p = rec()
    for (let i = 0; i < n; i++) {
      const u = i * c
      p.Q(u + c * 0.25, d * 2, u + c * 0.5, d).Q(u + c * 0.75, 0, u + c, 0)
    }
    return p
  },
  crenel: (L, cell, d) => {
    const { n, c } = fitCells(L, cell)
    const p = rec()
    for (let i = 0; i < n; i++) {
      const u = i * c
      p.L(u + c * 0.25, 0)
        .L(u + c * 0.25, d)
        .L(u + c * 0.75, d)
        .L(u + c * 0.75, 0)
    }
    return p.L(L, 0)
  },
  dagger: (L, cell, d) => {
    const { n, c } = fitCells(L, cell)
    const r = sagittaR(c, d)
    const p = rec()
    for (let i = 1; i <= n; i++) {
      p.A(r, i * c, 0, 1)
      if (i < n) p.L(i * c, d * 1.6).L(i * c, 0)
    }
    return p
  },
}

// ---------- 3. corners: local frame at the corner, +x along the NEXT edge, +y inward ----------
// the previous edge ended at (0, m); the corner path must end at (m, 0). outward = negative coords.
type Corner = (m: number, k: number) => Rec
export const corners: Record<string, Corner> = {
  none: m => rec().L(0, 0).L(m, 0),
  loop: (m, k) => rec().C(0, -k * 1.4, -k * 1.4, 0, m, 0),
  point: (m, k) => {
    const r = Math.hypot(m, k) * 0.9
    return rec().A(r, -k, -k, 1).A(r, m, 0, 1)
  },
  trefoil: (m, k) => {
    const r = k * 0.55
    return rec()
      .A(r, -k * 0.35, -k * 0.35, 1)
      .A(r, -k, -k, 0)
      .A(r, -k * 0.35, -k * 0.35, 0)
      .A(r, m, 0, 1)
  },
  spiral: (m, k) => {
    const p = rec()
    const steps = 14
    const turns = 1.25
    for (let i = 0; i <= steps * turns; i++) {
      const t = i / steps
      const r = k * 0.55 ** t
      const a = Math.PI * 0.75 + t * Math.PI * 2
      p.L(-k * 0.5 + r * Math.cos(a), -k * 0.5 + r * Math.sin(a))
    }
    return p.L(m, 0)
  },
}

// ---------- 4. border: one continuous path around a w x h rect ----------
// clockwise from the top edge start. edges are rotated copies of the local rail; corners join rail ends.
export type Plan = {
  rail: string[]
  corner: string
  cell: number
  depth: number
  margin: number
  k: number
  inset: number
}
export function border(w: number, h: number, o: Plan): string {
  const m = o.margin
  const k = o.k
  const ins = o.inset
  const x0 = ins
  const y0 = ins
  const x1 = w - ins
  const y1 = h - ins
  const E = [
    { o: [x0, y0], a: [1, 0], n: [0, 1], L: w - 2 * ins },
    { o: [x1, y0], a: [0, 1], n: [-1, 0], L: h - 2 * ins },
    { o: [x1, y1], a: [-1, 0], n: [0, -1], L: w - 2 * ins },
    { o: [x0, y1], a: [0, -1], n: [1, 0], L: h - 2 * ins },
  ]
  const mapOf =
    (e: (typeof E)[number], shift: number): Map2 =>
    ([u, v]) => [e.o[0] + e.a[0] * (u + shift) + e.n[0] * v, e.o[1] + e.a[1] * (u + shift) + e.n[1] * v]
  let d = `M${f(x0 + m)} ${f(y0)}`
  for (let i = 0; i < 4; i++) {
    const e = E[i]
    const L = e.L - 2 * m
    d += emit(rails[o.rail[i]](L, o.cell, o.depth).cmds, mapOf(e, m))
    d += emit(corners[o.corner](m, k).cmds, mapOf(E[(i + 1) % 4], 0))
  }
  return d
}

// ---------- 5. plan per host: seeded picks ----------
type Ui = { seed: number; rail: string; corner: string; cell: number; depth: number }
export function plan(w: number, h: number, seed: number, ui: Ui): Plan {
  const rng = mulberry32(seed)
  const railNames = Object.keys(rails).filter(n => n !== "plain")
  const one = ui.rail === "auto" ? pick(rng, railNames) : ui.rail
  const rail =
    ui.rail === "auto" && rng() < 0.35 ? [one, pick(rng, railNames), one, pick(rng, railNames)] : [one, one, one, one]
  const corner =
    ui.corner === "auto"
      ? pick(
          rng,
          Object.keys(corners).filter(n => n !== "none"),
        )
      : ui.corner
  const s = Math.min(w, h)
  const cell = Math.min(ui.cell, s / 3)
  const depth = Math.min(ui.depth, cell * 0.6)
  return { rail, corner, cell, depth, margin: Math.min(s * 0.18, cell * 1.2), k: Math.min(s * 0.16, cell), inset: 0 }
}

// ---------- 6. mount / scrub ----------
const SPEC = {
  seed: { kind: "seed", default: 7 },
  rail: { kind: "select", options: ["auto", "cusp", "ogee", "crenel", "dagger", "plain"], default: "auto" },
  corner: { kind: "select", options: ["auto", "loop", "point", "trefoil", "spiral", "none"], default: "auto" },
  cell: { kind: "range", min: 8, max: 64, default: 22 },
  depth: { kind: "range", min: 2, max: 24, default: 6 },
  weight: { kind: "range", min: 0.5, max: 4, step: 0.1, default: 1.2, static: true },
  t: { kind: "range", min: 0, max: 100, step: 0.1, default: 100, label: "offset", shuffle: false },
  ms: { kind: "number", default: 4000, step: 250, shuffle: false },
  ghost: { kind: "bool", default: true, static: true },
  pen: { kind: "bool", default: true, static: true },
} as const satisfies AnySpec
type V = ValuesOf<typeof SPEC>
const PRESETS = {
  cathedral: { rail: "cusp", corner: "trefoil", cell: 18, depth: 5 },
  castle: { rail: "crenel", corner: "point", cell: 28, depth: 8 },
} satisfies Record<string, Partial<V>>
type Host = { el: HTMLElement; ink: SVGPathElement; pen: SVGCircleElement; len: number; cap: HTMLElement; p: Plan }
const hosts: Host[] = []
let stage: HTMLElement
let tv: HTMLElement
let statsEl: HTMLElement
let tInput: HTMLInputElement
let playBtn: HTMLButtonElement
let U: V
function mount(el: HTMLElement, i: number): Host {
  const w = el.offsetWidth
  const h = el.offsetHeight
  const p = plan(w, h, U.seed * 7919 + i * 104729, U)
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
  return { el, ink, pen, len, cap, p }
}
function scrub(t: number) {
  document.documentElement.style.setProperty("--t", String(t))
  tv.textContent = `${(t * 100).toFixed(1)}%`
  for (const m of hosts) {
    const q = m.ink.getPointAtLength(t * m.len)
    m.pen.setAttribute("cx", String(f(q.x)))
    m.pen.setAttribute("cy", String(f(q.y)))
  }
}
function renderAll() {
  hosts.length = 0
  ;[...stage.querySelectorAll<HTMLElement>(".host")].forEach((el, i) => {
    hosts.push(mount(el, i))
  })
  scrub(Number(tInput.value) / 100)
  statsEl.textContent = `${hosts.length} rects`
}
// random rects: seeded by seed, so the layout replays; sizes 48..320
function spawn() {
  const rng = mulberry32(U.seed ^ 0x9e3779b9)
  const W = stage.clientWidth
  const H = stage.clientHeight
  const n = 8 + Math.floor(rng() * 6)
  stage.innerHTML = ""
  for (let i = 0; i < n; i++) {
    const w = 48 + Math.floor(rng() * 272)
    const h = 40 + Math.floor(rng() * 200)
    const el = document.createElement("div")
    el.className = "host"
    el.style.cssText = `left:${Math.floor(rng() * (W - w))}px;top:${Math.floor(rng() * (H - h))}px;width:${w}px;height:${h}px;--hb:oklch(${18 + rng() * 10}% .02 ${rng() * 360})`
    el.innerHTML = `<span>${w}×${h}</span><span class="cap"></span>`
    stage.append(el)
  }
  renderAll()
}

// play: t advances by dt / ms, loops; reduced-motion pins t to the slider. the slider is live while playing: the URL takes t on pause
const clk = clock(
  (_e, dt, running) => {
    if (!running) return
    let t = Number(tInput.value) / 100 + dt / U.ms
    if (t > 1) t -= 1
    tInput.value = (t * 100).toFixed(1)
    scrub(t)
  },
  { running: false },
)
function play() {
  if (clk.running()) {
    clk.run(false)
    delete tInput.dataset.live
    playBtn.textContent = "play"
    commit("replace", () => sec.values.$({ ...sec.values.$(), t: Number(tInput.value) }))
    return
  }
  if (reducedMotion) return
  tInput.dataset.live = "1"
  playBtn.textContent = "pause"
  clk.run(true)
}

// ---------- 7. wiring ----------
page({ id: "border", title: "gothic: border draw lab", links: LINKS })
const sec = section({
  id: "border",
  title: "border",
  spec: SPEC,
  presets: PRESETS,
  render(v, _host, ctx) {
    U = v
    if (ctx.first) {
      ctx.extra.innerHTML = `<button type="button" class="respawn">respawn rects</button><button type="button" class="play">play</button><b class="tv">100%</b><span class="stats"></span>`
      tv = ctx.extra.querySelector(".tv") as HTMLElement
      statsEl = ctx.extra.querySelector(".stats") as HTMLElement
      playBtn = ctx.extra.querySelector(".play") as HTMLButtonElement
      tInput = document.getElementById(inputId("border", "t")) as HTMLInputElement
      stage = document.createElement("div")
      stage.id = "stage"
      _host.parentElement?.append(stage)
      ;(ctx.extra.querySelector(".respawn") as HTMLButtonElement).addEventListener("click", spawn)
      playBtn.addEventListener("click", play)
      addEventListener("resize", renderAll)
    }
    document.documentElement.style.setProperty("--w", `${v.weight}px`)
    document.body.classList.toggle("noghost", !v.ghost)
    document.body.classList.toggle("nopen", !v.pen)
    const ch = ctx.changed
    if (ctx.first || ch.has("seed")) return spawn()
    if (ch.has("rail") || ch.has("corner") || ch.has("cell") || ch.has("depth")) return renderAll()
    if (ch.has("t")) scrub(v.t / 100)
  },
})
Object.assign(window, { border, plan, rails, corners, scrub, hosts })
