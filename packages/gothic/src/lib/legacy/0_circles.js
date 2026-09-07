import * as z from "zod"

// the notebook's global knobs; the page assigns them before every render (they were the #ctl inputs)
export const G = {
  weight: 1,
  seed: 7,
  sym: 0,
  intensity: 0.5,
  noise: 0,
  density: 10,
  lambda: 1.3,
  minPx: 6,
  anim: false,
  ms: 1200,
}

/* ============================================================ core (copied from arches.html, trimmed) ============================================================ */
const f = n => Math.round(n * 100) / 100
const M = (x, y) => `M${f(x)} ${f(y)}`,
  L = (x, y) => `L${f(x)} ${f(y)}`
const arc = (r, x, y, sw = 1, lg = 0) => `A${f(r)} ${f(r)} 0 ${lg} ${sw} ${f(x)} ${f(y)}`
const circle = (cx, cy, r) => M(cx - r, cy) + arc(r, cx + r, cy, 1, 1) + arc(r, cx - r, cy, 1, 1)
const line = (x0, y0, x1, y1) => M(x0, y0) + L(x1, y1)
const polar = (r, a) => [r * Math.cos(a), r * Math.sin(a)]
const poly = pts => pts.map((p, i) => (i ? L : M)(p[0], p[1])).join("") + "Z"
const TAU = Math.PI * 2
export const mulberry32 = seed => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hash3 = (x, y, z) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1442695041)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const sm = t => t * t * (3 - 2 * t),
  lerp = (a, b, t) => a + (b - a) * t
export function vnoise(x, y = 0, seed = G.seed) {
  const x0 = Math.floor(x),
    y0 = Math.floor(y),
    tx = sm(x - x0),
    ty = sm(y - y0)
  return (
    2 *
      lerp(
        lerp(hash3(x0, y0, seed), hash3(x0 + 1, y0, seed), tx),
        lerp(hash3(x0, y0 + 1, seed), hash3(x0 + 1, y0 + 1, seed), tx),
        ty,
      ) -
    1
  )
}
/** foil ring: n discs tangent inside radius R, union boundary; rho = lambda * touching radius (bisection) */
export function foilRing(cx, cy, R, n, lambda = G.lambda) {
  const P = [],
    N = []
  for (let i = 0; i < n; i++) {
    const t = -Math.PI / 2 + (i / n) * TAU
    P.push([cx + R * Math.cos(t), cy + R * Math.sin(t)])
    N.push([-Math.cos(t), -Math.sin(t)])
  }
  const centers = rho => P.map((p, i) => [p[0] + N[i][0] * rho, p[1] + N[i][1] * rho])
  const g = rho => {
    const C = centers(rho)
    let w = -Infinity
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      w = Math.max(w, Math.hypot(C[j][0] - C[i][0], C[j][1] - C[i][1]) - 2 * rho)
    }
    return w
  }
  let lo = 0,
    hi = R
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2
    g(m) > 0 ? (lo = m) : (hi = m)
  }
  const rho = Math.min(hi * lambda, R * 0.97),
    C = centers(rho)
  const cusp = (i, j) => {
    const [x0, y0] = C[i],
      [x1, y1] = C[j],
      d = Math.hypot(x1 - x0, y1 - y0),
      h = Math.sqrt(Math.max(0, rho * rho - (d / 2) ** 2)),
      mx = (x0 + x1) / 2,
      my = (y0 + y1) / 2,
      ux = (x1 - x0) / d,
      uy = (y1 - y0) / d
    const p1 = [mx - uy * h, my + ux * h],
      p2 = [mx + uy * h, my - ux * h]
    return Math.hypot(p1[0] - cx, p1[1] - cy) > Math.hypot(p2[0] - cx, p2[1] - cy) ? p1 : p2
  }
  const ang = (c, p) => Math.atan2(p[1] - c[1], p[0] - c[0]),
    mod = x => ((x % TAU) + TAU) % TAU
  const cusps = []
  for (let i = 0; i < n; i++) cusps.push(cusp(i, (i + 1) % n))
  let d = M(cusps[n - 1][0], cusps[n - 1][1])
  for (let i = 0; i < n; i++) {
    const from = cusps[(i + n - 1) % n],
      to = cusps[i],
      as = ang(C[i], from),
      ae = ang(C[i], to)
    let sweep = 1,
      span = mod(ae - as)
    if (mod(ang(C[i], P[i]) - as) > span) {
      sweep = 0
      span = TAU - span
    }
    d += arc(rho, to[0], to[1], sweep, span > Math.PI ? 1 : 0)
  }
  return d + "Z"
}
/** scene: px coords. every stroke gets pathLength=1 so the animation layer is one CSS rule */
function scene() {
  const parts = [],
    defs = []
  const sc = {
    parts,
    defs,
    path: (d, cls, attrs = "") => parts.push(`<path d="${d}" pathLength="1"${cls ? ` class="${cls}"` : ""} ${attrs}/>`),
    raw: s => parts.push(s),
    def: s => defs.push(s),
    svg: ([x0, y0, w, h]) =>
      `<svg viewBox="${f(x0)} ${f(y0)} ${f(w)} ${f(h)}" width="${f(w)}" height="${f(h)}"><defs>${defs.join("")}</defs>${parts.join("")}</svg>`,
  }
  return sc
}
let uid = 0
const id = p => `${p}${(uid++).toString(36)}`
const boxOf = R => [-R - 3, -R - 3, 2 * R + 6, 2 * R + 6]

/* ============================================================ 1. ring layout + band kinds ============================================================ */
const KINDS = [
  "ring",
  "runes",
  "ticks",
  "polygon",
  "nodes",
  "foils",
  "chords",
  "arcs",
  "spokes",
  "dots",
  "sub",
  "empty",
]
const CORES = ["eye", "star", "flower", "spiro", "glyph", "foil", "empty"]
const Band = z.object({
  w: z.number().positive().default(1),
  kind: z.enum(KINDS).default("ring"),
  k: z.number().int().min(1).max(12).optional(),
  step: z.number().int().min(1).optional(),
  sides: z.number().int().min(2).max(24).optional(),
  text: z.string().optional(),
  lobes: z.number().int().min(3).max(12).optional(),
  pattern: z.string().optional(),
  cell: z.number().positive().optional(),
  double: z.boolean().optional(),
  inner: z.boolean().optional(),
  dark: z.number().min(0).max(1).optional(),
  out: z.boolean().optional(),
  rot: z.number().optional(),
  get spec() {
    return Spec.optional()
  },
})
const Spec = z.object({
  n: z.number().int().min(1).max(64).default(6),
  rot: z.number().default(0),
  core: z.number().min(0.02).max(0.8).default(0.16),
  gap: z.number().min(0).max(0.1).default(0.015),
  center: z
    .object({ kind: z.enum(CORES).default("eye"), n: z.number().int().optional(), text: z.string().optional() })
    .default({ kind: "eye" }),
  bands: z.array(Band).min(1),
})
const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ"
const ALCH = "☉☽☿♀♂♃♄🜁🜂🜃🜄🜍🜔🜚🜛🜞🝞"
/** weights -> [r0, r1] per band from the core outward, flex-style */
export function layoutRings(R, spec) {
  const core = R * spec.core,
    gap = R * spec.gap,
    W = spec.bands.reduce((s, b) => s + b.w, 0),
    free = R - core - gap * spec.bands.length
  let r = core
  return spec.bands.map(b => {
    const h = (free * b.w) / W,
      o = { ...b, r0: r, r1: r + h, h }
    r += h + gap
    return o
  })
}
function runeText(rng, len, alpha = RUNES) {
  let s = ""
  for (let i = 0; i < len; i++) s += alpha[Math.floor(rng() * alpha.length)] + (rng() < 0.18 ? " " : "")
  return s
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a)
const annulus = (r0, r1) => circle(0, 0, r1) + circle(0, 0, r0)
const starPoly = (sc, pts, st) => {
  const s = pts.length
  for (let start = 0; start < gcd(s, st); start++) {
    const seq = []
    for (let i = start, c = 0; c < s / gcd(s, st); i = (i + st) % s, c++) seq.push(pts[i])
    sc.path(poly(seq))
  }
}
/** draw one band. n slots at rot + i*TAU/n */
function band(sc, b, n, rot, rng, depth) {
  const { r0, r1, h } = b,
    rm = (r0 + r1) / 2,
    slots = Array.from({ length: n }, (_, i) => rot + (b.rot ?? 0) + (i * TAU) / n)
  const at = (r, i) => polar(r, slots[i % n])
  switch (b.kind) {
    case "ring":
      sc.path(circle(0, 0, r1))
      if (b.double) sc.path(circle(0, 0, r0))
      break
    case "runes": {
      const pid = id("tp"),
        fs = h * 0.78,
        text = b.text ?? runeText(rng, Math.ceil((TAU * rm) / (fs * 0.75)), rng() < 0.5 ? RUNES : ALCH)
      sc.def(`<path id="${pid}" d="${M(-rm, 0) + arc(rm, rm, 0, 1, 1) + arc(rm, -rm, 0, 1, 1)}"/>`)
      if (fs >= G.minPx)
        sc.raw(
          `<text font-size="${f(fs)}" dominant-baseline="middle" letter-spacing="${f(fs * 0.12)}"><textPath href="#${pid}">${text}</textPath></text>`,
        )
      if (b.double) {
        sc.path(circle(0, 0, r0))
        sc.path(circle(0, 0, r1))
      }
      break
    }
    case "ticks": {
      const k = n * (b.k ?? 4)
      for (let i = 0; i < k; i++) {
        const a = rot + (i * TAU) / k,
          long = i % (b.k ?? 4) === 0,
          [x0, y0] = polar(long ? r0 : r0 + h * 0.5, a),
          [x1, y1] = polar(r1, a)
        sc.path(line(x0, y0, x1, y1))
      }
      break
    }
    case "polygon": {
      const s = b.sides ?? n,
        pts = Array.from({ length: s }, (_, i) => polar(r1, rot + (b.rot ?? 0) + (i * TAU) / s))
      starPoly(sc, pts, b.step ?? 1)
      if (b.inner)
        sc.path(poly(Array.from({ length: s }, (_, i) => polar(r0, rot + (b.rot ?? 0) + ((i + 0.5) * TAU) / s))))
      break
    }
    case "nodes":
      for (let i = 0; i < n; i++) {
        const [x, y] = at(rm, i),
          rr = h * 0.46
        sc.path(circle(x, y, rr))
        if (b.inner && rr * 0.5 >= G.minPx) sc.path(circle(x, y, rr * 0.5))
        if (b.double) sc.path(circle(x, y, rr * 0.8))
      }
      break
    case "foils":
      for (let i = 0; i < n; i++) {
        const [x, y] = at(rm, i),
          rr = h * 0.46
        if ((TAU * rr) / (b.lobes ?? 4) >= G.minPx) sc.path(foilRing(x, y, rr, b.lobes ?? 4))
        else sc.path(circle(x, y, rr))
      }
      break
    case "chords": {
      const st = b.step ?? 2
      for (let i = 0; i < n; i++) {
        const [x0, y0] = at(r1, i),
          [x1, y1] = at(r1, i + st)
        sc.path(line(x0, y0, x1, y1))
      }
      break
    }
    case "arcs":
      for (let i = 0; i < n; i++) {
        const [x0, y0] = at(b.out ? r0 : r1, i),
          [x1, y1] = at(b.out ? r0 : r1, i + 1),
          c = Math.hypot(x1 - x0, y1 - y0)
        sc.path(M(x0, y0) + arc(c * (b.out ? 0.55 : 0.62), x1, y1, b.out ? 1 : 0))
      }
      break
    case "spokes": {
      const k = n * (b.k ?? 1)
      for (let i = 0; i < k; i++) {
        const a = rot + (i * TAU) / k,
          [x0, y0] = polar(r0, a),
          [x1, y1] = polar(r1, a)
        sc.path(line(x0, y0, x1, y1))
      }
      break
    }
    case "dots": {
      const k = n * (b.k ?? 3)
      for (let i = 0; i < k; i++) {
        const [x, y] = polar(rm, rot + (i * TAU) / k)
        sc.path(circle(x, y, Math.max(1, h * 0.12)), "dark")
      }
      break
    }
    case "sub": {
      const rr = h * 0.48
      if (rr * 2 >= G.minPx * 4 && depth < 3)
        for (let i = 0; i < n; i++) {
          const [x, y] = at(rm, i),
            sub = b.spec ?? randomSpec(rng, 0.4, Math.max(3, Math.min(8, n))),
            s2 = scene()
          diagram(s2, rr, sub, rng, depth + 1)
          sc.defs.push(...s2.defs)
          sc.raw(
            `<g transform="translate(${f(x)} ${f(y)}) rotate(${f((slots[i] * 180) / Math.PI + 90)})">${s2.parts.join("")}</g>`,
          )
        }
      else
        for (let i = 0; i < n; i++) {
          const [x, y] = at(rm, i)
          sc.path(circle(x, y, rr))
        }
      break
    }
    case "empty":
      break
  }
}
function core(sc, R, c, n, rng) {
  switch (c.kind) {
    case "eye":
      sc.path(circle(0, 0, R))
      if ((TAU * R * 0.6) / 3 >= G.minPx) sc.path(foilRing(0, 0, R * 0.62, c.n ?? 3))
      sc.path(circle(0, 0, R * 0.18), "dark")
      break
    case "star": {
      const s = c.n ?? n
      starPoly(
        sc,
        Array.from({ length: s }, (_, i) => polar(R, -Math.PI / 2 + (i * TAU) / s)),
        s > 4 ? 2 : 1,
      )
      sc.path(circle(0, 0, R))
      break
    }
    case "flower":
      flowerOfLife(sc, R, 1, R / 2)
      break
    case "spiro":
      spiro(sc, R, c.n ?? 5, 3, 0.8)
      break
    case "glyph": {
      const fs = R * 1.4
      if (fs >= G.minPx)
        sc.raw(
          `<text font-size="${f(fs)}" text-anchor="middle" dominant-baseline="central">${c.text ?? ALCH[Math.floor(rng() * ALCH.length)]}</text>`,
        )
      sc.path(circle(0, 0, R))
      break
    }
    case "foil":
      sc.path(foilRing(0, 0, R, c.n ?? n))
      break
    case "empty":
      break
  }
}
/** render a spec at radius R into sc */
export function diagram(sc, R, spec, rng = mulberry32(G.seed), depth = 0) {
  const s = Spec.parse(spec),
    n = s.n
  for (const b of layoutRings(R, s)) band(sc, b, n, s.rot, rng, depth)
  core(sc, R * s.core * 0.9, s.center, n, rng)
  return sc
}
/** seeded spec: outer double ring first, runes second, at least one polygon, 3..8 bands by intensity */
export function randomSpec(rng, I = G.intensity, n = G.sym || [3, 4, 5, 6, 7, 8][Math.floor(rng() * 6)]) {
  const pick = a => a[Math.floor(rng() * a.length)]
  const count = 3 + Math.round(I * 5),
    bands = [{ w: 0.25, kind: "ring", double: true }]
  const menu = ["runes", "ticks", "polygon", "nodes", "chords", "arcs", "spokes", "dots", "foils", "sub", "ring"]
  for (let i = 1; i < count; i++) {
    const kind = i === 1 ? "runes" : pick(menu),
      b = { w: kind === "ring" ? 0.2 : kind === "runes" || kind === "ticks" ? 0.6 : kind === "sub" ? 1.6 : 1, kind }
    if (kind === "polygon") {
      b.sides = pick([n, n, n * 2, 3, 4])
      b.step = b.sides > 4 && rng() < 0.6 ? 2 : 1
      b.inner = rng() < 0.4
    }
    if (kind === "chords") b.step = Math.max(1, Math.round(n / 2 - rng() * 2))
    if (kind === "nodes") {
      b.inner = rng() < 0.5
      b.double = rng() < 0.4
    }
    if (kind === "arcs") b.out = rng() < 0.5
    if (kind === "ticks") b.k = pick([2, 3, 4, 6])
    if (kind === "foils") b.lobes = pick([3, 4, 5, 6])
    if (kind === "ring") b.double = rng() < 0.5
    bands.push(b)
  }
  if (!bands.some(b => b.kind === "polygon"))
    bands.splice(2, 0, { w: 1.2, kind: "polygon", sides: n, step: n > 4 ? 2 : 1, inner: rng() < 0.5 })
  return {
    n,
    rot: -Math.PI / 2,
    core: 0.12 + rng() * 0.1,
    gap: 0.012,
    center: { kind: pick(CORES.slice(0, 6)) },
    bands,
  }
}
export function fma(S, o = {}) {
  const sc = scene(),
    R = S / 2 - 3,
    rng = mulberry32((G.seed * 2654435761 + (o.salt ?? 0) * 97) >>> 0)
  const spec = o.spec ?? randomSpec(rng, o.intensity ?? G.intensity, o.n ?? (G.sym || undefined))
  diagram(sc, R, spec, rng)
  return { sc, box: boxOf(R) }
}

/* ============================================================ 3. sacred geometry ============================================================ */
export function flowerOfLife(sc, R, rings, r) {
  const pts = []
  for (let q = -rings; q <= rings; q++)
    for (let s = -rings; s <= rings; s++) {
      if (Math.abs(q + s) > rings) continue
      pts.push([r * (q + s / 2), (r * s * Math.sqrt(3)) / 2])
    }
  const cid = id("cl")
  sc.def(`<clipPath id="${cid}"><circle r="${f(R)}"/></clipPath>`)
  sc.raw(
    `<g clip-path="url(#${cid})">${pts.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" pathLength="1"/>`).join("")}</g>`,
  )
  sc.path(circle(0, 0, R))
  return pts
}
export function metatron(S) {
  const sc = scene(),
    R = S / 2 - 3,
    r = R / 3,
    pts = [[0, 0]]
  for (let k = 1; k <= 2; k++) for (let i = 0; i < 6; i++) pts.push(polar(r * k, (i * TAU) / 6))
  for (const [x, y] of pts) sc.path(circle(x, y, r * 0.5))
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) sc.path(line(pts[i][0], pts[i][1], pts[j][0], pts[j][1]))
  return { sc, box: boxOf(R) }
}
export function flower(S, rings) {
  const sc = scene(),
    R = S / 2 - 3
  flowerOfLife(sc, R, rings, R / (rings + 0.5))
  return { sc, box: boxOf(R) }
}
export function vesicaLattice(S, n) {
  const sc = scene(),
    R = S / 2 - 3,
    cid = id("cl")
  sc.def(`<clipPath id="${cid}"><circle r="${f(R)}"/></clipPath>`)
  let s = ""
  for (let i = 0; i < n; i++) {
    const [x, y] = polar(R * 0.5, (i * Math.PI) / n)
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R * 0.5)}" pathLength="1"/><circle cx="${f(-x)}" cy="${f(-y)}" r="${f(R * 0.5)}" pathLength="1"/>`
  }
  sc.raw(`<g clip-path="url(#${cid})">${s}</g>`)
  sc.path(circle(0, 0, R))
  return { sc, box: boxOf(R) }
}
/** hypotrochoid: rolling radius r = R*p/(p+q), pen d, closes after q turns */
export function spiro(sc, R, p, q, d) {
  const r = (R * p) / (p + q),
    k = (R - r) / r,
    pts = [],
    scale = R / (R - r + d * r)
  for (let i = 0; i <= 720 * q; i++) {
    const t = (i / 720) * TAU
    pts.push([
      scale * ((R - r) * Math.cos(t) + d * r * Math.cos(k * t)),
      scale * ((R - r) * Math.sin(t) - d * r * Math.sin(k * t)),
    ])
  }
  sc.raw(`<polyline points="${pts.map(p => f(p[0]) + "," + f(p[1])).join(" ")}" pathLength="1"/>`)
}
export function spiroCell(S, p, q, d) {
  const sc = scene(),
    R = S / 2 - 3
  spiro(sc, R, p, q, d)
  sc.path(circle(0, 0, R))
  return { sc, box: boxOf(R) }
}

/* ============================================================ animation layer ============================================================ */
/** number strokes for the stagger and set the per-cell duration. cheap: attributes only, CSS does the rest */
function animate(svgEl) {
  svgEl.style.setProperty("--ms", G.ms + "ms")
  svgEl.style.setProperty("--w", G.weight + "px")
  let i = 0
  for (const e of svgEl.querySelectorAll("path,polyline,circle")) {
    if (e.closest("pattern")) continue
    e.style.setProperty("--i", i++)
  }
  svgEl.style.setProperty("--stagger", `${f(Math.min(6, 600 / i))}ms`)
}
/** bezier / path change: WAAPI on the css `d` property for paths whose command structure matches (same letters, same count); others just swap */
const sig = d => d.replace(/[-\d.\s,]+/g, "")
export function morph(oldSvg, newSvg, ms = G.ms) {
  const a = [...oldSvg.querySelectorAll("path")].filter(e => !e.closest("pattern")),
    b = [...newSvg.querySelectorAll("path")].filter(e => !e.closest("pattern"))
  let n = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d0 = a[i].getAttribute("d"),
      d1 = b[i].getAttribute("d")
    if (d0 === d1 || sig(d0) !== sig(d1)) continue
    try {
      b[i].animate([{ d: `path("${d0}")` }, { d: `path("${d1}")` }], {
        duration: ms,
        easing: "cubic-bezier(.2,.7,.2,1)",
      })
      n++
    } catch {}
  }
  return n
}

// react port: one spec rendered at S px (the notebook built this inline in renderDiagram)
export function diagramCell(S, spec, seed) {
  const sc = scene(),
    R = S / 2 - 3
  diagram(sc, R, spec, mulberry32(seed))
  return { sc, box: boxOf(R) }
}

// the notebook kept these module-local and published them on window.circles
export { Spec, Band, scene, boxOf }
