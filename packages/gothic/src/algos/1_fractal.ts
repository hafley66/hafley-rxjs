import type { Algo, AlgoPath } from "../kit/2_algo.js"
import { M, L as Lp, type Pt, TAU, circle, clamp, f, foilRingGeom, mulberry32, pl } from "../lib/index.js"

type Circ = { x: number; y: number; r: number; k: number }
type Ap = { ring: number; depth: number; minPx: number; seed: number }

/* ---- apollonian: Descartes circle theorem, complex form for centres; z = recursion depth ---- */
export const apollonian: Algo<Ap> = {
  name: "apollonian",
  spec: {
    ring: { kind: "range", min: 3, max: 7, step: 1, default: 3 },
    depth: { kind: "range", min: 1, max: 8, step: 1, default: 5 },
    minPx: { kind: "range", min: 1, max: 12, step: 0.5, default: 2.5, static: true },
    seed: { kind: "seed", default: 1 },
  },
  presets: { gasket3: { ring: 3, depth: 5 }, rose5: { ring: 5, depth: 4 }, wheel7: { ring: 7, depth: 3 } },
  run(p, { size }) {
    const R = size / 2 - 1
    const paths: AlgoPath[] = []
    let dropped = 0
    let cnt = 0
    const put = (c: Circ, z: number): boolean => {
      if (c.r * 2 < p.minPx) {
        dropped++
        return false
      }
      paths.push({ d: circle(c.x, c.y, c.r), z })
      cnt++
      return true
    }
    // k4 = k1+k2+k3 + 2 sqrt(k1k2+k2k3+k3k1); centres via k*z as complex numbers; root picked by tangency residual
    const fourth = (a: Circ, b: Circ, c: Circ): Circ => {
      const k4 = a.k + b.k + c.k + 2 * Math.sqrt(Math.max(0, a.k * b.k + b.k * c.k + c.k * a.k))
      const zs: Pt[] = [a, b, c].map(o => [o.k * o.x, o.k * o.y])
      const mul = (u: Pt, v: Pt): Pt => [u[0] * v[0] - u[1] * v[1], u[0] * v[1] + u[1] * v[0]]
      const s = [0, 1, 2].reduce<Pt>(
        (acc, i) => {
          const m = mul(zs[i], zs[(i + 1) % 3])
          return [acc[0] + m[0], acc[1] + m[1]]
        },
        [0, 0],
      )
      const mag = Math.hypot(s[0], s[1])
      const sq: Pt = [Math.sqrt((mag + s[0]) / 2), Math.sign(s[1] || 1) * Math.sqrt(Math.max(0, (mag - s[0]) / 2))]
      const sum: Pt = [zs[0][0] + zs[1][0] + zs[2][0], zs[0][1] + zs[1][1] + zs[2][1]]
      const cand: Circ[] = [
        [sum[0] + 2 * sq[0], sum[1] + 2 * sq[1]],
        [sum[0] - 2 * sq[0], sum[1] - 2 * sq[1]],
      ].map(z => ({ x: z[0] / k4, y: z[1] / k4, r: 1 / k4, k: k4 }))
      const res = (c4: Circ) =>
        [a, b, c].reduce((e, o) => e + Math.abs(Math.hypot(c4.x - o.x, c4.y - o.y) - Math.abs(1 / o.k + 1 / c4.k)), 0)
      return cand.sort((u, v) => res(u) - res(v))[0]
    }
    const rec = (a: Circ, b: Circ, c: Circ, depth: number): void => {
      if (depth > p.depth) return
      const d = fourth(a, b, c)
      if (!put(d, depth / p.depth)) return
      rec(a, b, d, depth + 1)
      rec(b, c, d, depth + 1)
      rec(a, c, d, depth + 1)
    }
    const n = p.ring
    const s = Math.sin(Math.PI / n)
    const r = (R * s) / (1 + s)
    const outer: Circ = { x: 0, y: 0, r: R, k: -1 / R }
    paths.push({ d: circle(0, 0, R), z: 0 })
    const ring: Circ[] = Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (i * TAU) / n
      return { x: (R - r) * Math.cos(a), y: (R - r) * Math.sin(a), r, k: 1 / r }
    })
    for (const c of ring) put(c, 0)
    const rc = R - 2 * r
    const centre: Circ = { x: 0, y: 0, r: rc, k: 1 / rc }
    if (rc > 0) put(centre, 0)
    for (let i = 0; i < n; i++) {
      const a = ring[i]
      const b = ring[(i + 1) % n]
      rec(outer, a, b, 1)
      if (rc > 0) rec(centre, a, b, 1)
    }
    return {
      paths,
      caption: `ring ${n} · depth ${p.depth} · ${cnt} circles`,
      lod: dropped ? [`${dropped} under minPx`] : [],
    }
  },
}

/* ---- foils: every lobe of a foil ring hosts a smaller foil ring; self-similar tracery ---- */
type Fo = { lobes: number; child: number; shrink: number; depth: number; minPx: number; seed: number }
export const foils: Algo<Fo> = {
  name: "foils",
  spec: {
    lobes: { kind: "range", min: 3, max: 8, step: 1, default: 5 },
    child: { kind: "range", min: 2, max: 8, step: 1, default: 3 },
    shrink: { kind: "range", min: 0.2, max: 0.6, step: 0.02, default: 0.38 },
    depth: { kind: "range", min: 1, max: 5, step: 1, default: 3 },
    minPx: { kind: "range", min: 1, max: 12, step: 0.5, default: 3, static: true },
    seed: { kind: "seed", default: 1 },
  },
  presets: {
    trefoil: { lobes: 3, child: 3, shrink: 0.42, depth: 4 },
    rose: { lobes: 6, child: 4, shrink: 0.3, depth: 3 },
    snow: { lobes: 8, child: 3, shrink: 0.26, depth: 3 },
  },
  run(p, { size }) {
    const paths: AlgoPath[] = []
    let dropped = 0
    let cnt = 0
    const rec = (cx: number, cy: number, R: number, n: number, depth: number): void => {
      if ((TAU * R) / n < p.minPx) {
        dropped++
        return
      }
      const { d, C, rho } = foilRingGeom(cx, cy, R, n)
      paths.push({ d, z: depth / p.depth })
      cnt++
      if (depth < p.depth) for (const [x, y] of C) rec(x, y, rho * p.shrink * 2, p.child, depth + 1)
    }
    rec(0, 0, size / 2 - 2, p.lobes, 0)
    return {
      paths,
      caption: `f${p.lobes}→f${p.child} ×${p.shrink} · ${cnt} rings`,
      lod: dropped ? [`${dropped} under minPx`] : [],
    }
  },
}

/* ---- lsys: bracketed L-system turtle; stochastic angle jitter by seed; z = bracket depth ---- */
const RULES = {
  mullion: { axiom: "F", rules: { F: "F[+F][-F]F" } as Record<string, string>, angle: 22, decay: 0.55 },
  tracery: { axiom: "F", rules: { F: "FF+[+F-F-F]-[-F+F+F]" } as Record<string, string>, angle: 25, decay: 0.5 },
  cusp: { axiom: "F--F--F", rules: { F: "F+F--F+F" } as Record<string, string>, angle: 60, decay: 0.333 },
  arrowhead: { axiom: "A", rules: { A: "B-A-B", B: "A+B+A" } as Record<string, string>, angle: 60, decay: 0.5 },
  dragon: { axiom: "FX", rules: { X: "X+YF+", Y: "-FX-Y" } as Record<string, string>, angle: 90, decay: 0.707 },
} as const
type RuleName = keyof typeof RULES
const RULE_NAMES = Object.keys(RULES) as RuleName[]
type Ls = { rule: RuleName; iter: number; angle: number; jitter: number; seed: number; minPx: number }
export const lsys: Algo<Ls> = {
  name: "lsys",
  spec: {
    rule: { kind: "select", options: RULE_NAMES, default: "mullion" },
    iter: { kind: "range", min: 1, max: 7, step: 1, default: 4, roll: [2, 5] },
    angle: { kind: "range", min: 5, max: 120, step: 1, default: 22 },
    jitter: { kind: "range", min: 0, max: 20, step: 1, default: 3 },
    seed: { kind: "seed", default: 1 },
    minPx: { kind: "range", min: 0.5, max: 8, step: 0.5, default: 1.5, static: true },
  },
  presets: Object.fromEntries(
    RULE_NAMES.map(k => [k, { rule: k, angle: RULES[k].angle, iter: k === "dragon" ? 7 : 4 }]),
  ) as Record<string, Partial<Ls>>,
  run(p, { size }) {
    const R = RULES[p.rule]
    const rng = mulberry32(p.seed)
    let s: string = R.axiom
    for (let i = 0; i < p.iter; i++) s = s.replace(/./g, ch => R.rules[ch] ?? ch)
    const step = size * 0.9 * R.decay ** p.iter * (p.rule === "mullion" || p.rule === "tracery" ? 2.2 : 1)
    const raw: { pts: Pt[]; z: number }[] = []
    let x = 0
    let y = 0
    let a = -Math.PI / 2
    let depth = 0
    let cur: Pt[] = [[0, 0]]
    const stack: [number, number, number, number][] = []
    const flush = () => {
      if (cur.length > 1) raw.push({ pts: cur, z: clamp(depth / 5) })
      cur = [[x, y]]
    }
    for (const ch of s) {
      if (ch === "F" || ch === "A" || ch === "B") {
        x += step * Math.cos(a)
        y += step * Math.sin(a)
        cur.push([x, y])
      } else if (ch === "+") a += ((p.angle + (rng() * 2 - 1) * p.jitter) * Math.PI) / 180
      else if (ch === "-") a -= ((p.angle + (rng() * 2 - 1) * p.jitter) * Math.PI) / 180
      else if (ch === "[") {
        flush()
        stack.push([x, y, a, depth])
        depth++
      } else if (ch === "]") {
        flush()
        ;[x, y, a, depth] = stack.pop() as [number, number, number, number]
        cur = [[x, y]]
      }
    }
    flush()
    // fit the whole drawing into the box so the step size never matters
    let x0 = 1e9
    let y0 = 1e9
    let x1 = -1e9
    let y1 = -1e9
    for (const q of raw)
      for (const [px, py] of q.pts) {
        x0 = Math.min(x0, px)
        y0 = Math.min(y0, py)
        x1 = Math.max(x1, px)
        y1 = Math.max(y1, py)
      }
    const sc = (size - 4) / Math.max(x1 - x0, y1 - y0, 1)
    const tx = -(x0 + x1) / 2
    const ty = -(y0 + y1) / 2
    const lod = step * sc < p.minPx ? [`step ${f(step * sc)}px < minPx`] : []
    const paths: AlgoPath[] = lod.length
      ? []
      : raw.map(q => ({ d: pl(q.pts.map(([px, py]): Pt => [(px + tx) * sc, (py + ty) * sc])), z: q.z }))
    return { paths, caption: `${p.rule} ×${p.iter} · ${raw.length} branches · ${s.length} symbols`, lod }
  },
}

/* ---- cusping: Koch-style substitution where every edge grows a pointed-arch bump; polygon seed ---- */
type Cu = { sides: number; depth: number; bump: number; inward: boolean; minPx: number }
export const cusping: Algo<Cu> = {
  name: "cusping",
  spec: {
    sides: { kind: "range", min: 3, max: 8, step: 1, default: 4 },
    depth: { kind: "range", min: 0, max: 5, step: 1, default: 3 },
    bump: { kind: "range", min: 0.1, max: 0.9, step: 0.02, default: 0.5 },
    inward: { kind: "bool", default: false, p: 0.25 },
    minPx: { kind: "range", min: 0.5, max: 8, step: 0.5, default: 1.5, static: true },
  },
  presets: {
    cross: { sides: 4, bump: 0.5, depth: 3 },
    star: { sides: 5, bump: 0.7, depth: 3 },
    snowflake: { sides: 6, bump: 0.58, depth: 4 },
    inward: { sides: 3, bump: 0.5, depth: 4, inward: true },
  },
  run(p, { size }) {
    const R = (size / 2) * 0.55
    const sgn = p.inward ? -1 : 1
    let pts: Pt[] = Array.from({ length: p.sides }, (_, i) => {
      const a = -Math.PI / 2 + (i * TAU) / p.sides
      return [R * Math.cos(a), R * Math.sin(a)]
    })
    const paths: AlgoPath[] = [{ d: pl([...pts, pts[0]]), z: 0 }]
    const lod: string[] = []
    for (let d = 1; d <= p.depth; d++) {
      const next: Pt[] = []
      const n = pts.length
      let seg = 0
      for (let i = 0; i < n; i++) {
        const a = pts[i]
        const b = pts[(i + 1) % n]
        const dx = b[0] - a[0]
        const dy = b[1] - a[1]
        const len = Math.hypot(dx, dy)
        seg = len
        // edge -> a, third point, apex on the outward normal, two-thirds point
        const nx = (dy / len) * sgn
        const ny = (-dx / len) * sgn
        next.push(
          a,
          [a[0] + dx / 3, a[1] + dy / 3],
          [a[0] + dx / 2 + nx * len * p.bump, a[1] + dy / 2 + ny * len * p.bump],
          [a[0] + (dx * 2) / 3, a[1] + (dy * 2) / 3],
        )
      }
      if (seg / 3 < p.minPx) {
        lod.push(`d${p.depth}→${d - 1}`)
        break
      }
      pts = next
      paths.push({ d: pl([...pts, pts[0]]), z: d / p.depth })
    }
    return { paths, caption: `${p.sides}-gon · depth ${p.depth} · bump ${p.bump} · ${pts.length} verts`, lod }
  },
}

/* ---- hilbert: space-filling curve; hilbertIndex(x, y, order) doubles as a landing order for slice ---- */
export function hilbertIndex(x: number, y: number, order: number): number {
  let d = 0
  let px = x
  let py = y
  for (let s = 1 << (order - 1); s > 0; s >>= 1) {
    const rx = (px & s) > 0 ? 1 : 0
    const ry = (py & s) > 0 ? 1 : 0
    d += s * s * ((3 * rx) ^ ry)
    if (ry === 0) {
      if (rx === 1) {
        px = s - 1 - px
        py = s - 1 - py
      }
      ;[px, py] = [py, px]
    }
  }
  return d
}
type Hi = { order: number; round: number; minPx: number }
export const hilbert: Algo<Hi> = {
  name: "hilbert",
  spec: {
    order: { kind: "range", min: 1, max: 7, step: 1, default: 4, roll: [2, 6] },
    round: { kind: "range", min: 0, max: 1, step: 0.05, default: 0.35 },
    minPx: { kind: "range", min: 0.5, max: 8, step: 0.5, default: 2, static: true },
  },
  presets: { o3: { order: 3 }, o5: { order: 5, round: 0.5 }, sharp: { order: 4, round: 0 } },
  run(p, { size }) {
    const n = 1 << p.order
    const cell = (size - 4) / n
    if (cell < p.minPx) return { paths: [], caption: `order ${p.order}`, lod: [`cell ${f(cell)}px < minPx`] }
    const pts: Pt[] = []
    for (let x = 0; x < n; x++)
      for (let y = 0; y < n; y++)
        pts[hilbertIndex(x, y, p.order)] = [(x + 0.5) * cell - size / 2 + 2, (y + 0.5) * cell - size / 2 + 2]
    // rounded corners: cut each corner by `round` of the cell with a quadratic
    let d = M(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1]
      const b = pts[i]
      const c = pts[i + 1]
      const r = p.round * 0.5
      d +=
        Lp(b[0] + (a[0] - b[0]) * r, b[1] + (a[1] - b[1]) * r) +
        `Q${f(b[0])} ${f(b[1])} ${f(b[0] + (c[0] - b[0]) * r)} ${f(b[1] + (c[1] - b[1]) * r)}`
    }
    const last = pts[pts.length - 1]
    d += Lp(last[0], last[1])
    return { paths: [{ d, z: 0 }], caption: `order ${p.order} · ${pts.length} cells · cell ${f(cell)}px`, lod: [] }
  },
}

export const FRACTALS = [apollonian, foils, lsys, cusping, hilbert] as const
