/* ============================================================
   ARCH GRAMMAR. unit coords: half-span a = 1, springing line y = 0, up is -y.
   every builder returns { d: string[], aux: string[], rise: number, lod: string[] }
   px is passed in so builders can drop detail below pixel thresholds.
   ============================================================ */
const f = n => Math.round(n * 1000) / 1000
const arc = (r, x, y, sweep = 1, large = 0) => `A${f(r)} ${f(r)} 0 ${large} ${sweep} ${f(x)} ${f(y)}`
const M = (x, y) => `M${f(x)} ${f(y)}`
const L = (x, y) => `L${f(x)} ${f(y)}`

/**
 * @typedef {{ k:number, foils:number, ogee:number, tudor:null|{h:number, phi:number, m:number},
 *             depth:number, legs:number, lambda:number, minLobe:number, minSub:number, weight:number, guides:boolean }} Spec
 *   k      two-centred family scalar. center offset / half-span. 0 semicircle, (0,1) drop, 1 equilateral, >1 lancet
 *   foils  lobes on the head. 0 none, 3 trefoil, 5 cinquefoil, ...
 *   ogee   0 none, (0,1] reversed-curve radius as a fraction of r
 *   tudor  four-centred: h haunch radius / a, phi haunch angle rad, m big radius / a
 *   depth  bar-tracery subdivision depth
 *   lambda lobe radius / (half the tangent-point spacing). 1 = circles just touch, bigger = chubbier lobes, deeper cusps
 */
export const DEFAULT = {
  k: 1,
  foils: 0,
  ogee: 0,
  tudor: null,
  depth: 0,
  legs: 0.6,
  lambda: 1.3,
  minLobe: 7,
  minSub: 22,
  weight: 1,
  guides: false,
  lobe: "round",
  seed: 7,
  noise: 0,
  asym: 0,
  intensity: 0,
}

// ---------- seeded randomness ----------
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
/** value noise in [-1,1], seeded by global.seed unless given */
export function vnoise(x, y = 0, seed = global.seed) {
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
export const fbm = (x, y, oct = 3, seed) => {
  let v = 0,
    a = 0.5,
    fr = 1,
    n = 0
  for (let i = 0; i < oct; i++) {
    v += a * vnoise(x * fr, y * fr, seed)
    n += a
    a *= 0.5
    fr *= 2
  }
  return v / n
}

/** two-centred: centers at (±k a, 0), r = a(1+k), rise = a sqrt(1+2k) */
export function twoCentred(a, k) {
  const r = a * (1 + k),
    rise = a * Math.sqrt(1 + 2 * k)
  const delta = Math.atan2(-rise, -k * a) + Math.PI // angular sweep of one side, clockwise from pi
  return { r, rise, cL: [k * a, 0], cR: [-k * a, 0], delta }
}
/** n+1 points along the two-centred head, left springer -> apex -> right springer */
export function sampleHead(a, k, n) {
  const { r, cL, delta } = twoCentred(a, k)
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      tt = t <= 0.5 ? t : 1 - t
    const th = Math.PI + delta * 2 * tt
    const x = cL[0] + r * Math.cos(th),
      y = cL[1] + r * Math.sin(th)
    pts.push(t <= 0.5 ? [x, y] : [-x, y])
  }
  return pts
}
/** largest x in [lo,hi] with ok(x), assuming ok(lo). the projection / binary scan used for every fit below */
export const bisect = (lo, hi, ok, it = 32) => {
  for (let i = 0; i < it; i++) {
    const m = (lo + hi) / 2
    ok(m) ? (lo = m) : (hi = m)
  }
  return lo
}
/** point-in-region for a two-centred head plus its legs (|x| <= a below the springing) */
export const insideHead = (a, k) => {
  const { r } = twoCentred(a, k),
    eps = a * 2e-3
  return (x, y) => Math.abs(x) <= a + eps && (y >= 0 || Math.hypot(x - (x <= 0 ? k * a : -k * a), y) <= r + eps)
}
/** n tangent points on the head with inward unit normals, springer -> apex -> springer */
export function sampleHeadN(a, k, n) {
  const { r, cL, cR, delta } = twoCentred(a, k)
  const P = [],
    N = []
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1),
      tt = t <= 0.5 ? t : 1 - t
    const th = Math.PI + delta * 2 * tt
    let x = cL[0] + r * Math.cos(th),
      y = cL[1] + r * Math.sin(th),
      c = cL
    if (t > 0.5) {
      x = -x
      c = cR
    }
    P.push([x, y])
    N.push(Math.abs(t - 0.5) < 1e-9 ? null : [(c[0] - x) / r, (c[1] - y) / r]) // null = apex lobe: inscribed, tangent to both arcs
  }
  return { P, N, apex: { r, cx: k * a } }
}
/**
 * cusped outline from tangent points P with inward normals N.
 * lobe i = circle of radius rho centred rho inward of P[i], so it is tangent to the guide curve at P[i].
 * rho = lambda * rhoMin, rhoMin = smallest radius where every adjacent pair of lobe circles still meets (bisection).
 * rhoMax caps rho so no centre crosses the axis (arch: a) or the ring centre (ring: R).
 * cusp(i,i+1) = the outward intersection of discs i and i+1 (union boundary), the re-entrant point. open outlines start/end at P[0]/P[n-1].
 */
export function cusped(P, N, lambda, closed, rhoMax, shape = global?.lobe ?? "round", inside = null, apex = null) {
  const n = P.length,
    m = closed ? n : n - 1
  // apex lobe (N[i] null): centre on the axis at distance r - rho from both arc centres, so the disc is tangent to both arcs
  const centers = rho =>
    P.map((p, i) =>
      N[i]
        ? [p[0] + N[i][0] * rho, p[1] + N[i][1] * rho]
        : [0, -Math.sqrt(Math.max(0, (apex.r - rho) ** 2 - apex.cx ** 2))],
    )
  // g(rho) = worst gap between adjacent lobe circles; decreasing in rho. rhoMin = root.
  const g = rho => {
    const C = centers(rho)
    let w = -Infinity
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % n
      w = Math.max(w, Math.hypot(C[j][0] - C[i][0], C[j][1] - C[i][1]) - 2 * rho)
    }
    return w
  }
  let lo = 0,
    hi = rhoMax
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    g(mid) > 0 ? (lo = mid) : (hi = mid)
  }
  const rhoMin = hi
  // collision rule: every lobe disc must lie inside the region. bisect the largest radius that does.
  const discsInside = rho => {
    const C = centers(rho)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < 16; j++) {
        const t = (j / 16) * Math.PI * 2
        if (!inside(C[i][0] + rho * Math.cos(t), C[i][1] + rho * Math.sin(t))) return false
      }
    return true
  }
  const rhoFit = inside ? bisect(0, rhoMax, discsInside) : rhoMax
  if (rhoFit < rhoMin * 0.999) return null // cannot both meet and fit: caller falls back
  const rho = Math.min(rhoMin * lambda, rhoFit, rhoMax * 0.97)
  const C = centers(rho)
  P = P.map((p, i) => (N[i] ? p : [C[i][0], C[i][1] - rho])) // apex lobe's via point = top of its disc
  const cen = C.reduce((acc, c) => [acc[0] + c[0] / n, acc[1] + c[1] / n], [0, 0])
  const cusp = (i, j) => {
    const [x0, y0] = C[i],
      [x1, y1] = C[j],
      d = Math.hypot(x1 - x0, y1 - y0)
    const h = Math.sqrt(Math.max(0, rho * rho - (d / 2) ** 2))
    const mx = (x0 + x1) / 2,
      my = (y0 + y1) / 2,
      ux = (x1 - x0) / d,
      uy = (y1 - y0) / d
    const p1 = [mx - uy * h, my + ux * h],
      p2 = [mx + uy * h, my - ux * h]
    return Math.hypot(p1[0] - cen[0], p1[1] - cen[1]) > Math.hypot(p2[0] - cen[0], p2[1] - cen[1]) ? p1 : p2 // outward one: union boundary of the lobe discs
  }
  const ang = (c, p) => Math.atan2(p[1] - c[1], p[0] - c[0])
  const mod = x => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  const seg = (i, from, to, via) => {
    const as = ang(C[i], from),
      ae = ang(C[i], to)
    let sweep = 1,
      span = mod(ae - as)
    if (via && mod(ang(C[i], via) - as) > span) {
      sweep = 0
      span = 2 * Math.PI - span
    }
    if (via && (shape === "pointed" || shape === "dagger")) {
      // tip = tangent point (stays on the guide); flatter arcs than the disc, so inside it
      const r = rho * (shape === "dagger" ? 2.4 : 1.35)
      return arc(r, via[0], via[1], sweep, 0) + arc(r, to[0], to[1], sweep, 0)
    }
    let d = arc(rho, to[0], to[1], sweep, span > Math.PI ? 1 : 0)
    if (via && shape === "eyelet") {
      const e = [C[i][0] + (via[0] - C[i][0]) * 0.5, C[i][1] + (via[1] - C[i][1]) * 0.5],
        er = rho * 0.2
      d += M(e[0] - er, e[1]) + arc(er, e[0] + er, e[1], 1, 1) + arc(er, e[0] - er, e[1], 1, 1) + M(to[0], to[1])
    }
    return d
  }
  const cusps = []
  for (let i = 0; i < m; i++) cusps.push(cusp(i, (i + 1) % n))
  let d
  if (closed) {
    d = M(cusps[n - 1][0], cusps[n - 1][1])
    for (let i = 0; i < n; i++) d += seg(i, cusps[(i + n - 1) % n], cusps[i], P[i])
    d += "Z"
  } else {
    d = M(P[0][0], P[0][1])
    for (let i = 0; i < n; i++) {
      const from = i === 0 ? P[0] : cusps[i - 1],
        to = i === n - 1 ? P[n - 1] : cusps[i]
      d += seg(i, from, to, i === 0 || i === n - 1 ? null : P[i])
    }
  }
  return d
}
/** foiled ring: n lobes tangent inside a circle of radius R */
export function foilRing(cx, cy, R, n, lambda, shape) {
  const P = [],
    N = []
  for (let i = 0; i < n; i++) {
    const t = -Math.PI / 2 + (i / n) * Math.PI * 2
    P.push([cx + R * Math.cos(t), cy + R * Math.sin(t)])
    N.push([-Math.cos(t), -Math.sin(t)])
  }
  return cusped(P, N, lambda, true, R, shape)
}

/** plain two-centred outline */
function headTwoCentred(a, k) {
  const { r, rise } = twoCentred(a, k)
  return { d: M(-a, 0) + arc(r, 0, -rise) + arc(r, a, 0), rise }
}
/** ogee: convex lower arc then reversed arc meeting at a pointed apex with vertical tangent. og = rho2 / r */
function headOgee(a, k, og) {
  const { r, cL } = twoCentred(a, k)
  const rho = r * og
  const c = -(rho + k * a) / (r + rho) // cos(theta) at the inflection, from C2.x = -rho
  const th = Math.PI * 2 - Math.acos(c)
  const px = cL[0] + r * Math.cos(th),
    py = r * Math.sin(th)
  const apexY = (r + rho) * Math.sin(th)
  const d = M(-a, 0) + arc(r, px, py, 1) + arc(rho, 0, apexY, 0) + arc(rho, -px, py, 0) + arc(r, a, 0, 1)
  return { d, rise: -apexY }
}
/** four-centred (Tudor): small haunch arcs r1 = a h, big arcs r2 = a m, tangent-continuous */
function headTudor(a, { h, phi, m }) {
  const r1 = a * h,
    r2 = a * m
  const c1 = [-a + r1, 0]
  const th = Math.PI + phi
  const p1 = [c1[0] + r1 * Math.cos(th), r1 * Math.sin(th)]
  const c2 = [p1[0] + (c1[0] - p1[0]) * (r2 / r1), p1[1] + (c1[1] - p1[1]) * (r2 / r1)]
  const apexY = c2[1] - Math.sqrt(Math.max(0, r2 * r2 - c2[0] * c2[0]))
  const d = M(-a, 0) + arc(r1, p1[0], p1[1]) + arc(r2, 0, apexY) + arc(r2, -p1[0], p1[1]) + arc(r1, a, 0)
  return { d, rise: -apexY }
}
/** largest circle on the axis tangent to the outer arch and both sub-arches (bisection on rho) */
function spandrelCircle(a, k) {
  const { r } = twoCentred(a, k)
  const a2 = a / 2,
    r2 = a2 * (1 + k),
    cx2 = a2 + k * a2 // sub-arch inner arc center distance from axis
  const g = rho => {
    const yc = Math.sqrt(Math.max(0, (r - rho) ** 2 - (k * a) ** 2))
    return Math.hypot(cx2, yc) - r2 - rho
  }
  let lo = 0,
    hi = a
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    g(mid) > 0 ? (lo = mid) : (hi = mid)
  }
  const rho = lo,
    yc = Math.sqrt(Math.max(0, (r - rho) ** 2 - (k * a) ** 2))
  return { cx: 0, cy: -yc, rho }
}

/**
 * build one arch at half-span a (unit) rendered at `px` pixels per unit.
 * @param {Spec} s @param {number} px @param {number} a @param {number} ox x offset of the arch axis
 */
export function build(s, px, a = 1, ox = 0, depth = s.depth, out = { d: [], aux: [], rise: 0, lod: [] }) {
  const T = (d, dx) =>
    d
      .replace(/([ML])(-?[\d.]+) /g, (_, c, x) => `${c}${f(+x + dx)} `)
      .replace(
        /A([\d.]+) ([\d.]+) 0 (\d) (\d) (-?[\d.]+) /g,
        (_, r1, r2, lg, sw, x) => `A${r1} ${r2} 0 ${lg} ${sw} ${f(+x + dx)} `,
      )
  let head
  const wantFoils = s.foils >= 3 && depth === 0 // cusps only on leaf arches
  const lobePx = wantFoils ? (2 * a * px) / s.foils : Infinity
  if (s.tudor) head = headTudor(a, s.tudor)
  else if (s.ogee > 0) head = headOgee(a, s.k, s.ogee)
  else if (wantFoils && lobePx >= s.minLobe) {
    const { P, N, apex } = sampleHeadN(a, s.k, s.foils),
      d = cusped(P, N, s.lambda, false, a, undefined, insideHead(a, s.k), apex)
    if (d) head = { d, rise: twoCentred(a, s.k).rise }
    else {
      head = headTwoCentred(a, s.k)
      out.lod.push(`f${s.foils}→fit`)
    }
  } else head = headTwoCentred(a, s.k)
  if (wantFoils && lobePx < s.minLobe) out.lod.push(`f${s.foils}→0`)
  if (wantFoils && s.guides && !s.tudor && !s.ogee) out.aux.push(T(headTwoCentred(a, s.k).d, ox))
  out.d.push(T(head.d, ox))
  out.rise = Math.max(out.rise, head.rise)
  if (s.legs > 0 && depth === s.depth) {
    out.d.push(T(M(-a, 0) + L(-a, a * s.legs), ox), T(M(a, 0) + L(a, a * s.legs), ox))
  }
  // bar tracery: two sub-arches + foiled spandrel circle, recursive
  if (depth > 0 && !s.tudor && !s.ogee) {
    const subPx = a * px // sub-arch span in px
    if (subPx < s.minSub) {
      out.lod.push(`d${depth}→${s.depth - depth}`)
      return out
    }
    const mk = dx => {
      const sub = { ...s, legs: 0 }
      if (s.noise > 0) {
        // seeded jitter per node: (x, depth) -> k, foils
        sub.k = Math.max(0, s.k + vnoise((ox + dx) * 3 + 11, depth * 2.7) * s.noise * 1.5)
        const nf = vnoise((ox + dx) * 4 + 5, depth * 3.1 + 17)
        sub.foils = nf > 0.4 - s.noise * 0.8 ? (nf > 0.5 ? 5 : 3) : s.foils
      }
      return sub
    }
    build(mk(-a / 2), px, a / 2, ox - a / 2, depth - 1, out)
    build(mk(a / 2), px, a / 2, ox + a / 2, depth - 1, out)
    const { cy, rho } = spandrelCircle(a, s.k)
    if (rho * px >= s.minLobe * 1.2) {
      const n = rho * px >= s.minLobe * 3 ? 4 : 0
      out.d.push(
        n
          ? T(foilRing(0, cy, rho, n, s.lambda), ox)
          : T(M(-rho, cy) + arc(rho, rho, cy, 1, 1) + arc(rho, -rho, cy, 1, 1), ox),
      )
      if (s.guides) out.aux.push(T(M(-rho, cy) + arc(rho, rho, cy, 1, 1) + arc(rho, -rho, cy, 1, 1), ox))
    }
    // mullion between the sub-arches
    out.d.push(T(M(0, 0) + L(0, a * s.legs), ox))
  }
  return out
}

/** svg element for one spec at a given span in px */
export function cell(s, spanPx) {
  const px = spanPx / 2
  const b = build(s, px)
  const m = 0.08,
    top = -(b.rise + m),
    bottom = Math.max(s.legs, 0) + m
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("viewBox", `${f(-1 - m)} ${f(top)} ${f(2 + 2 * m)} ${f(bottom - top)}`)
  svg.setAttribute("width", f(spanPx * (1 + m)))
  svg.setAttribute("height", f(px * (bottom - top)))
  svg.innerHTML =
    b.aux.map(d => `<path class="aux" d="${d}" style="stroke-width:${s.weight * 0.6}px"/>`).join("") +
    b.d.map(d => `<path d="${d}" style="stroke-width:${s.weight}px"/>`).join("")
  return { svg, lod: b.lod }
}

/* ============================================================
   catalogue + explorer
   ============================================================ */
export const families = {
  semicircular: { k: 0 },
  drop: { k: 0.45 },
  equilateral: { k: 1 },
  lancet: { k: 2 },
  "lancet 3.5": { k: 3.5 },
  ogee: { k: 1, ogee: 0.45 },
  "ogee tall": { k: 1.6, ogee: 0.3 },
  tudor: { tudor: { h: 0.28, phi: 1.0, m: 2.6 } },
  "tudor flat": { tudor: { h: 0.2, phi: 1.15, m: 4 } },
  trefoil: { k: 1, foils: 3 },
  cinquefoil: { k: 1, foils: 5 },
  sevenfoil: { k: 0.6, foils: 7 },
  "tracery 1": { k: 1, depth: 1 },
  "tracery 2": { k: 1, depth: 2 },
  "tracery 3 lancet": { k: 1.6, depth: 3 },
  "tracery 2 foiled": { k: 1, depth: 2, foils: 3 },
}
export const SIZES = [320, 160, 96, 64, 40, 24, 16]
export const axes = { k: [0, 2.5], foils: [0, 9], ogee: [0, 1], depth: [0, 3], legs: [0, 1.5], lambda: [1, 1.6] }
export const global = { ...DEFAULT }

// the notebook published these on window.arches; the module exports them for 3_buildings.js
export { headTwoCentred, headOgee, headTudor, spandrelCircle }
