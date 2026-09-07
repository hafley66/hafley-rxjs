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
  "blackwork",
  "mosaic",
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
    case "blackwork":
      sc.path(
        annulus(r0, r1),
        "",
        `style="fill:url(#${blackwork(sc, b.pattern ?? "lattice", b.cell ?? G.density, (rot * 180) / Math.PI)})" fill-rule="evenodd"`,
      )
      sc.path(circle(0, 0, r1))
      sc.path(circle(0, 0, r0))
      break
    case "mosaic":
      tesserae(sc, r0, r1, b.cell ?? G.density, G.noise, b.dark ?? 0, rng)
      break
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
  const menu = [
    "runes",
    "ticks",
    "polygon",
    "nodes",
    "chords",
    "arcs",
    "spokes",
    "dots",
    "foils",
    "sub",
    "blackwork",
    "mosaic",
    "ring",
  ]
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
    if (kind === "blackwork") b.pattern = pick(Object.keys(BW))
    if (kind === "mosaic") b.dark = rng() * 0.5
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

/* ============================================================ 4. islamic: hankin's polygons in contact ============================================================ */
/** star segments for one polygon: from each edge midpoint, a ray at contact angle theta meets the ray from the next midpoint */
function hankin(pts, theta) {
  const n = pts.length,
    segs = [],
    mids = [],
    dirs = []
  const cx = pts.reduce((s, p) => s + p[0], 0) / n,
    cy = pts.reduce((s, p) => s + p[1], 0) / n
  for (let i = 0; i < n; i++) {
    const a = pts[i],
      b = pts[(i + 1) % n],
      m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      d = [b[0] - a[0], b[1] - a[1]],
      len = Math.hypot(...d)
    mids.push(m)
    const u = [d[0] / len, d[1] / len]
    let nn = [-u[1], u[0]]
    if ((cx - m[0]) * nn[0] + (cy - m[1]) * nn[1] < 0) nn = [-nn[0], -nn[1]]
    dirs.push([u, nn])
  }
  const c = Math.cos(theta),
    s = Math.sin(theta)
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      [ui, ni] = dirs[i],
      [uj, nj] = dirs[j]
    const v1 = [c * ui[0] + s * ni[0], c * ui[1] + s * ni[1]],
      v2 = [-c * uj[0] + s * nj[0], -c * uj[1] + s * nj[1]]
    const det = v1[0] * -v2[1] - v1[1] * -v2[0]
    if (Math.abs(det) < 1e-6) {
      segs.push(line(mids[i][0], mids[i][1], mids[j][0], mids[j][1]))
      continue
    } // collinear rays (square 45, hex 30): the strap runs midpoint to midpoint
    const dx = mids[j][0] - mids[i][0],
      dy = mids[j][1] - mids[i][1],
      t = (dx * -v2[1] - dy * -v2[0]) / det
    const X = [mids[i][0] + v1[0] * t, mids[i][1] + v1[1] * t]
    segs.push(line(mids[i][0], mids[i][1], X[0], X[1]) + line(mids[j][0], mids[j][1], X[0], X[1]))
  }
  return segs.join("")
}
export function islamic(S, tile, thetaDeg, o = {}) {
  const sc = scene(),
    R = S / 2 - 3,
    cell = o.cell ?? Math.max(G.density * 2.4, S / 6),
    th = (thetaDeg * Math.PI) / 180,
    cid = id("cl")
  sc.def(`<clipPath id="${cid}"><circle r="${f(R)}"/></clipPath>`)
  let d = "",
    tiles = ""
  if (tile === "square")
    for (let x = -R - cell; x < R + cell; x += cell)
      for (let y = -R - cell; y < R + cell; y += cell) {
        const p = [
          [x, y],
          [x + cell, y],
          [x + cell, y + cell],
          [x, y + cell],
        ]
        d += hankin(p, th)
        if (o.tiles) tiles += poly(p)
      }
  if (tile === "hex") {
    const rr = cell / 2 / Math.cos(Math.PI / 6),
      w = cell,
      hh = rr * 1.5
    for (let j = -Math.ceil(R / hh) - 1; j <= Math.ceil(R / hh) + 1; j++)
      for (let i = -Math.ceil(R / w) - 1; i <= Math.ceil(R / w) + 1; i++) {
        const cx = i * w + (j % 2 ? w / 2 : 0),
          cy = j * hh,
          p = Array.from({ length: 6 }, (_, k) => polar(rr, Math.PI / 6 + (k * TAU) / 6)).map(q => [
            q[0] + cx,
            q[1] + cy,
          ])
        d += hankin(p, th)
        if (o.tiles) tiles += poly(p)
      }
  }
  if (tile === "octsquare") {
    const s = cell / (1 + Math.SQRT2),
      rr = cell / 2 / Math.cos(Math.PI / 8)
    for (let x = -R - cell; x < R + cell; x += cell)
      for (let y = -R - cell; y < R + cell; y += cell) {
        const oc = Array.from({ length: 8 }, (_, k) => polar(rr, Math.PI / 8 + (k * TAU) / 8)).map(q => [
          q[0] + x,
          q[1] + y,
        ])
        d += hankin(oc, th)
        const sq = [
          [x + cell / 2 - s / 2, y + cell / 2 - s / 2],
          [x + cell / 2 + s / 2, y + cell / 2 - s / 2],
          [x + cell / 2 + s / 2, y + cell / 2 + s / 2],
          [x + cell / 2 - s / 2, y + cell / 2 + s / 2],
        ]
        d += hankin(sq, th)
        if (o.tiles) tiles += poly(oc) + poly(sq)
      }
  }
  sc.raw(
    `<g clip-path="url(#${cid})"><path d="${d}" pathLength="1"/>${tiles ? `<path d="${tiles}" pathLength="1" stroke-opacity=".3"/>` : ""}</g>`,
  )
  sc.path(circle(0, 0, R))
  return { sc, box: boxOf(R) }
}

/* ============================================================ 5. mosaics ============================================================ */
function tesserae(sc, r0, r1, cell, jitter, dark, rng) {
  const rings = Math.max(1, Math.round((r1 - r0) / cell)),
    rh = (r1 - r0) / rings,
    g = cell * 0.12
  for (let j = 0; j < rings; j++) {
    const ri = r0 + j * rh,
      ro = ri + rh,
      rm = (ri + ro) / 2,
      n = Math.max(3, Math.round((TAU * rm) / cell)),
      off = (j % 2) * 0.5
    if (rh - g < 1.2) continue
    for (let i = 0; i < n; i++) {
      const jx = jitter * 0.35 * vnoise(i * 0.9 + j * 7.1, j * 3.3),
        a0 = ((i + off + jx) * TAU) / n + g / rm / 2,
        a1 = ((i + 1 + off + jx) * TAU) / n - g / rm / 2
      const [ax, ay] = polar(ri + g / 2, a0),
        [bx, by] = polar(ri + g / 2, a1),
        [cx, cy] = polar(ro - g / 2, a1),
        [dx, dy] = polar(ro - g / 2, a0)
      sc.path(
        M(ax, ay) + arc(ri + g / 2, bx, by, 1) + L(cx, cy) + arc(ro - g / 2, dx, dy, 0) + "Z",
        rng() < dark ? "dark" : "",
      )
    }
  }
}
export function mosaicRings(S, o = {}) {
  const sc = scene(),
    R = S / 2 - 3,
    rng = mulberry32(G.seed + (o.salt ?? 0))
  tesserae(sc, o.r0 ?? R * 0.1, R, o.cell ?? G.density, o.jitter ?? G.noise, o.dark ?? 0, rng)
  sc.path(circle(0, 0, R))
  return { sc, box: boxOf(R) }
}
/** opus circumactum: rows of overlapping fan arcs */
export function fanMosaic(S, o = {}) {
  const sc = scene(),
    R = S / 2 - 3,
    cell = o.cell ?? G.density * 2.2,
    cid = id("cl")
  sc.def(`<clipPath id="${cid}"><circle r="${f(R)}"/></clipPath>`)
  let d = ""
  for (let y = -R; y < R + cell; y += cell * 0.5) {
    const row = Math.round(y / (cell * 0.5)),
      off = ((row % 2) * cell) / 2
    for (let x = -R - cell; x < R + cell; x += cell)
      for (let k = 1; k <= (o.arcs ?? 4); k++) {
        const r = ((cell / 2) * k) / (o.arcs ?? 4)
        d += M(x + off - r, y) + arc(r, x + off + r, y, 1)
      }
  }
  sc.raw(`<g clip-path="url(#${cid})"><path d="${d}" pathLength="1"/></g>`)
  sc.path(circle(0, 0, R))
  return { sc, box: boxOf(R) }
}

/* ============================================================ 6. blackwork: unit-cell line grammars as patterns ============================================================ */
export const BW = {
  lattice: "M0 .5L.5 0L1 .5L.5 1Z",
  diag: "M0 1L1 0",
  cross: "M0 0L1 1M1 0L0 1",
  grid: "M0 0H1M0 0V1",
  zigzag: "M0 .25L.25 0L.5 .25L.75 0L1 .25M0 .75L.25 .5L.5 .75L.75 .5L1 .75",
  brick: "M0 0H1M0 .5H1M.5 0V.5M0 .5V1M1 .5V1",
  steps: "M0 0H.5V.5H1V1",
  honeycomb: "M.25 0L.5 .125L.75 0M.5 .125V.375M.25 .5L.5 .375L.75 .5M.25 .5V1M.75 .5V1M0 .75L.25 .5M1 .75L.75 .5",
  trellis: "M0 .5L.5 0L1 .5L.5 1ZM.5 .3L.7 .5L.5 .7L.3 .5Z",
  wave: "M0 .5C.25 0 .25 0 .5 .5S.75 1 1 .5",
  scale: "M0 .5A.5 .5 0 0 1 1 .5M.5 1A.5 .5 0 0 1 1 .5M0 .5A.5 .5 0 0 0 .5 1",
  quatre: "M.5 0A.25 .25 0 0 1 .5 .5A.25 .25 0 0 1 .5 1M0 .5A.25 .25 0 0 1 .5 .5A.25 .25 0 0 1 1 .5",
}
function blackwork(sc, name, cell, rot = 0) {
  const pid = id("bw")
  sc.def(
    `<pattern id="${pid}" patternUnits="userSpaceOnUse" width="1" height="1" patternTransform="rotate(${f(rot)}) scale(${f(cell)})"><path d="${BW[name] ?? BW.lattice}" fill="none" stroke="currentColor" stroke-width="${f(G.weight / cell)}"/></pattern>`,
  )
  return pid
}
export function bwCircle(S, name, o = {}) {
  const sc = scene(),
    R = S / 2 - 3
  sc.path(circle(0, 0, R), "", `style="fill:url(#${blackwork(sc, name, o.cell ?? G.density, o.rot ?? 0)})"`)
  sc.path(circle(0, 0, R))
  return { sc, box: boxOf(R) }
}
/** density shading: rings of the same grammar with cell shrinking inward */
export function bwShade(S, name, rings = 4) {
  const sc = scene(),
    R = S / 2 - 3
  for (let j = 0; j < rings; j++) {
    const r1 = (R * (rings - j)) / rings,
      r0 = (R * (rings - j - 1)) / rings,
      cell = G.density * (1 + j * 0.8)
    sc.path(annulus(r0, r1), "", `style="fill:url(#${blackwork(sc, name, cell, j * 15)})" fill-rule="evenodd"`)
    sc.path(circle(0, 0, r1))
  }
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

// the notebook kept these module-local and published them on window.tiles
export { Spec, Band, scene, boxOf }
