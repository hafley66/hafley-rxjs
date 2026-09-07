/* ============================================================
   NOTEBOOK PART 2: whole-building generators. px coords, 1 unit = 1 px.
   every generator: (S, opts) -> { sc, box:[x,y,w,h] }.  arches are placed via
   sc.archT(spec, transform, a): unit-coord arch scaled by a px, so LOD sees a.
   ============================================================ */
import {
  build,
  cusped,
  foilRing,
  global as archGlobal,
  headOgee,
  headTwoCentred,
  insideHead,
  mulberry32,
  sampleHeadN,
  twoCentred,
  vnoise,
} from "./2_arches.js"

const G = () => archGlobal
const f = n => Math.round(n * 100) / 100
const M = (x, y) => `M${f(x)} ${f(y)}`,
  L = (x, y) => `L${f(x)} ${f(y)}`
const arc = (r, x, y, sw = 1, lg = 0) => `A${f(r)} ${f(r)} 0 ${lg} ${sw} ${f(x)} ${f(y)}`
const circle = (cx, cy, r) => M(cx - r, cy) + arc(r, cx + r, cy, 1, 1) + arc(r, cx - r, cy, 1, 1)
const line = (x0, y0, x1, y1) => M(x0, y0) + L(x1, y1)

function scene() {
  const parts = []
  const sc = {
    parts,
    path: (d, cls) => parts.push(`<path d="${d}"${cls ? ` class="${cls}"` : ""}/>`),
    archT: (spec, transform, a) => {
      const b = build({ ...G(), ...spec }, a, 1)
      parts.push(`<g transform="${transform}">${b.d.map(d => `<path d="${d}"/>`).join("")}</g>`)
      return b
    },
    svg: ([x0, y0, w, h]) =>
      `<svg viewBox="${f(x0)} ${f(y0)} ${f(w)} ${f(h)}" width="${f(w)}" height="${f(h)}">${parts.join("")}</svg>`,
  }
  return sc
}
const riseOf = (spec, a) => build({ ...G(), ...spec, legs: 0 }, a, 1).rise
/** arch whose apex touches yTop and whose legs reach yBottom */
function archAt(sc, spec, cx, yTop, a, yBottom) {
  const ys = yTop + riseOf(spec, a) * a
  const legs = Math.max(0, (yBottom - ys) / a)
  return sc.archT({ ...spec, legs }, `translate(${f(cx)} ${f(ys)}) scale(${f(a)})`, a)
}

// ---------- 3. rose ----------
export function rose(S, o = {}) {
  const g = G(),
    sc = scene(),
    R = S / 2
  const spokes0 = o.spokes ?? 8,
    rings = o.rings ?? 3,
    kMax = o.k ?? 1
  const r0 = R * (o.eye ?? 0.2)
  sc.path(circle(0, 0, R))
  sc.path(circle(0, 0, r0))
  const eyeLobes = Math.min(spokes0, 8)
  if ((2 * Math.PI * r0) / eyeLobes >= g.minLobe) sc.path(foilRing(0, 0, r0 * 0.82, eyeLobes, g.lambda))
  let n = spokes0
  for (let j = 0; j < rings; j++) {
    const rin = r0 + ((R - r0) * j) / rings,
      rout = r0 + ((R - r0) * (j + 1)) / rings
    if (j > 0 && (2 * Math.PI * rout) / (n * 2) >= g.minSub) n *= 2
    if (j < rings - 1) sc.path(circle(0, 0, rout))
    const dth = (2 * Math.PI) / n
    const nz = g.noise ? vnoise(j * 2.3 + 1, 7) : 0,
      ringFoils = g.noise && vnoise(j * 3.1, 13) > 0.3 - g.noise * 0.7 ? 3 : (o.foils ?? 0)
    for (let i = 0; i < n; i++) {
      const th = i * dth + (o.twist ?? 0) * j + nz * g.noise * dth * 0.5
      sc.path(line(rin * Math.cos(th), rin * Math.sin(th), rout * Math.cos(th), rout * Math.sin(th)))
      const thm = th + dth / 2,
        a = rout * Math.sin(dth / 2) * 0.9,
        depth = rout - rin
      const kk = Math.max(0, Math.min(kMax, (((0.88 * depth) / a) ** 2 - 1) / 2))
      const rise = a * Math.sqrt(1 + 2 * kk),
        rs = rout - rise
      if (2 * a >= g.minSub)
        sc.archT(
          { k: kk, foils: ringFoils, depth: o.depth ?? 0, legs: Math.max(0, (rs - rin) / a) },
          `rotate(${f((thm * 180) / Math.PI + 90)}) translate(0 ${f(-rs)}) scale(${f(a)})`,
          a,
        )
    }
  }
  return { sc, box: [-R - 2, -R - 2, 2 * R + 4, 2 * R + 4] }
}

// ---------- 4. perpendicular panel tracery ----------
export function panelTracery(S, o = {}) {
  const g = G(),
    sc = scene()
  const W = S,
    a = W / 2,
    k = o.k ?? 0.35,
    cols = o.cols ?? 4,
    rows = o.rows ?? 2,
    body = o.body ?? S * 0.9,
    foils = o.foils ?? 3
  const { r, rise } = twoCentred(a, k)
  const headY = x => {
    const cx = x <= 0 ? k * a : -k * a
    return -Math.sqrt(Math.max(0, r * r - (x - cx) ** 2))
  }
  sc.path(M(-a, 0) + arc(r, 0, -rise) + arc(r, a, 0) + L(a, body) + L(-a, body) + "Z")
  const pw = W / cols,
    ha = pw / 2
  // body: transoms, panel heads under each transom, mullions
  for (let j = 0; j < rows; j++) {
    const yTop = (body * j) / rows,
      yBot = (body * (j + 1)) / rows
    if (j > 0) sc.path(line(-a, yTop, a, yTop))
    for (let i = 0; i < cols; i++)
      if (pw >= g.minSub)
        archAt(sc, { k: 0.5, foils, depth: 0 }, -a + pw * (i + 0.5), yTop + ha * 0.12, ha * 0.86, yBot)
  }
  for (let i = 1; i < cols; i++) {
    const x = -a + pw * i
    sc.path(line(x, headY(x), x, body))
  }
  // head: level 0 panels at the springing line, then halves (supermullions) per level
  let w = pw,
    yBase = 0
  for (let level = 0; level < (o.levels ?? 3) && w >= g.minSub; level++) {
    const n = Math.round(W / w),
      hw = w / 2,
      rr = hw * 0.86 * Math.sqrt(1 + 2 * 0.5)
    for (let i = 0; i < n; i++) {
      const cx = -a + w * (i + 0.5)
      if (yBase - rr >= headY(cx) - 1e-6 && yBase - rr >= headY(cx - hw * 0.86) && yBase - rr >= headY(cx + hw * 0.86))
        sc.archT(
          { k: 0.5, foils, depth: 0, legs: 0 },
          `translate(${f(cx)} ${f(yBase)}) scale(${f(hw * 0.86)})`,
          hw * 0.86,
        )
    }
    if (level > 0)
      for (let i = 1; i < n; i += 2) {
        const x = -a + w * i
        if (headY(x) < yBase) sc.path(line(x, headY(x), x, yBase))
      }
    yBase -= rr
    w /= 2
  }
  return { sc, box: [-a - 2, -rise - 2, W + 4, rise + body + 4] }
}

// ---------- 5. flamboyant ----------
export function vesica(S, o = {}) {
  const sc = scene(),
    g = G()
  const rec = (cx, cy, R, depth) => {
    const h = (R * Math.sqrt(3)) / 2
    sc.path(M(cx, cy - h) + arc(R, cx, cy + h, 1) + arc(R, cx, cy - h, 1))
    if ((R * 0.3 * 2 * Math.PI) / 3 >= g.minLobe) sc.path(foilRing(cx, cy, R * 0.3, o.foils ?? 3, g.lambda))
    if (depth > 0 && R * 0.38 >= g.minSub / 2) {
      rec(cx, cy - h * 0.58, R * 0.38, depth - 1)
      rec(cx, cy + h * 0.58, R * 0.38, depth - 1)
    }
  }
  rec(0, 0, S / 2, o.depth ?? 1)
  return { sc, box: [-S / 2 - 2, -S / 2 - 2, S + 4, S + 4] }
}
export function soufflet(S, o = {}) {
  const sc = scene(),
    a = S / 4
  const head = headOgee(1, o.k ?? 0.8, o.ogee ?? 0.45)
  for (let i = 0; i < 4; i++) sc.parts.push(`<g transform="rotate(${i * 90}) scale(${f(a)})"><path d="${head.d}"/></g>`)
  if (a >= G().minSub) sc.path(foilRing(0, 0, a * 0.35, 4, G().lambda))
  const e = a * head.rise + 2
  return { sc, box: [-e, -e, 2 * e, 2 * e] }
}
export function mouchette(S, o = {}) {
  const sc = scene(),
    a = S / 3
  const head = headOgee(1, o.k ?? 1.2, o.ogee ?? 0.5)
  sc.parts.push(
    `<g transform="translate(0 ${f(S * 0.45)}) skewX(${o.skew ?? -28}) scale(${f(a)})"><path d="${head.d}"/><path d="${M(-1, 0) + L(1, 0)}"/></g>`,
  )
  return { sc, box: [-S / 2 - 2, -S / 2 - 2, S + 4, S + 4] }
}

// ---------- 6. pinnacle ----------
function crocket(sc, x, y, side, s) {
  const ox = side * s
  sc.path(
    M(x, y) +
      `C${f(x + ox)} ${f(y)} ${f(x + ox * 1.1)} ${f(y - s * 0.9)} ${f(x + ox * 0.5)} ${f(y - s * 0.9)}` +
      `C${f(x + ox * 0.25)} ${f(y - s * 0.9)} ${f(x + ox * 0.3)} ${f(y - s * 0.5)} ${f(x + ox * 0.55)} ${f(y - s * 0.55)}`,
  )
}
function finial(sc, x, y, s) {
  sc.path(line(x, y, x, y - s * 1.2))
  if (s >= G().minLobe * 0.5) sc.path(foilRing(x, y - s * 1.65, s * 0.45, 3, 1.3))
}
function spireAt(sc, cx, yBase, w, h, o = {}) {
  const g = G(),
    top = yBase - h
  sc.path(M(cx - w / 2, yBase) + L(cx, top) + L(cx + w / 2, yBase))
  const len = Math.hypot(w / 2, h),
    step = o.crocket ?? h * 0.12,
    n = Math.floor(len / step)
  if (step * 0.6 >= g.minLobe)
    for (const side of [-1, 1])
      for (let i = 1; i < n; i++) {
        const t = i / n
        crocket(sc, cx + side * (w / 2) * (1 - t), yBase - h * t, side, step * 0.5)
      }
  finial(sc, cx, top, h * 0.07)
}
export function pinnacleAt(sc, cx, yBase, H, depth, o = {}) {
  const g = G(),
    w = H * 0.26,
    hs = H * 0.48,
    sb = yBase - hs
  sc.path(line(cx - w / 2, yBase, cx - w / 2, sb))
  sc.path(line(cx + w / 2, yBase, cx + w / 2, sb))
  if (w * 0.7 >= g.minSub) archAt(sc, { k: 1.2, foils: 3, depth: 0 }, cx, sb + hs * 0.12, w * 0.32, yBase)
  sc.path(M(cx - w / 2, sb) + L(cx, sb - w * 0.5) + L(cx + w / 2, sb)) // gablet
  spireAt(sc, cx, sb, w, hs + w * 0.1 + H * 0.04, o)
  if (depth > 0 && H * 0.45 * 0.26 >= g.minLobe)
    for (const side of [-1, 1]) pinnacleAt(sc, cx + side * w * 0.68, yBase, H * 0.45, depth - 1, o)
}
export function pinnacle(S, o = {}) {
  const sc = scene()
  pinnacleAt(sc, 0, 0, S, o.depth ?? 2, o)
  return { sc, box: [-S * 0.4, -S - 4, S * 0.8, S + 8] }
}

// ---------- 7. vault plans ----------
export function vault(S, o = {}) {
  const sc = scene(),
    g = G(),
    w = S,
    h = S * (o.aspect ?? 0.8),
    C = [w / 2, h / 2]
  const corners = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ]
  sc.path(M(0, 0) + L(w, 0) + L(w, h) + L(0, h) + "Z")
  const t = o.type ?? "quadripartite"
  const diag = () => {
    sc.path(line(0, 0, w, h))
    sc.path(line(w, 0, 0, h))
  }
  const ridge = () => {
    sc.path(line(w / 2, 0, w / 2, h))
    sc.path(line(0, h / 2, w, h / 2))
  }
  const ridgePts = [
    [w / 2, h * 0.25],
    [w * 0.75, h / 2],
    [w / 2, h * 0.75],
    [w * 0.25, h / 2],
  ]
  const tierceron = () => {
    ridge()
    for (const [cx, cy] of corners) {
      sc.path(line(cx, cy, w / 2, cy < h / 2 ? h * 0.25 : h * 0.75))
      sc.path(line(cx, cy, cx < w / 2 ? w * 0.25 : w * 0.75, h / 2))
    }
  }
  if (t === "quadripartite") diag()
  if (t === "sexpartite") {
    diag()
    sc.path(line(0, h / 2, w, h / 2))
  }
  if (t === "tierceron") {
    diag()
    tierceron()
  }
  if (t === "lierne") {
    diag()
    tierceron()
    const D = corners.map(([x, y]) => [C[0] + (x - C[0]) * 0.5, C[1] + (y - C[1]) * 0.5])
    const star = [ridgePts[0], D[1], ridgePts[1], D[2], ridgePts[2], D[3], ridgePts[3], D[0]]
    sc.path(star.map((p, i) => (i ? L : M)(p[0], p[1])).join("") + "Z")
    if (S * 0.08 >= g.minLobe) sc.path(foilRing(C[0], C[1], S * 0.06, 4, g.lambda))
  }
  if (t === "fan") {
    const Rf = Math.min(w, h) / 2,
      rings = o.rings ?? 3
    for (const [cx, cy] of corners) {
      const sx = cx ? -1 : 1,
        sy = cy ? -1 : 1
      let n = o.ribs ?? 3
      for (let j = 1; j <= rings; j++) {
        const rin = (Rf * (j - 1)) / rings,
          rout = (Rf * j) / rings
        if (j > 1 && ((Math.PI / 2) * rout) / (n * 2) >= g.minSub * 0.5) n *= 2
        sc.path(M(cx + sx * rout, cy) + arc(rout, cx, cy + sy * rout, sx * sy > 0 ? 1 : 0))
        for (let i = 0; i <= n; i++) {
          const th = ((i / n) * Math.PI) / 2
          sc.path(
            line(
              cx + sx * rin * Math.cos(th),
              cy + sy * rin * Math.sin(th),
              cx + sx * rout * Math.cos(th),
              cy + sy * rout * Math.sin(th),
            ),
          )
        }
      }
    }
    if (S * 0.12 >= g.minLobe) sc.path(foilRing(C[0], C[1], Math.min(w, h) * 0.12, 4, g.lambda))
  }
  return { sc, box: [-2, -2, w + 4, h + 4] }
}

// ---------- 8. flying buttress ----------
export function flyingButtress(S, o = {}) {
  const sc = scene(),
    g = G(),
    H = S,
    wallX = S * 0.78,
    pw = S * 0.14
  sc.path(line(wallX, 0, wallX, -H))
  sc.path(line(wallX + S * 0.04, -H * 0.45, wallX + S * 0.04, -H)) // wall + clerestory line
  // stepped pier
  const tiers = o.tiers ?? 2,
    pierTop = -H * 0.62
  sc.path(M(0, 0) + L(0, pierTop) + L(pw * 0.7, pierTop) + L(pw * 0.7, -H * 0.38) + L(pw, -H * 0.35) + L(pw, 0) + "Z")
  for (let i = 0; i < tiers; i++) {
    const y0 = pierTop + H * 0.22 * i + H * 0.04,
      y1 = -H * (0.82 - 0.2 * i),
      x0 = i ? pw : pw * 0.7,
      rail = S * 0.045
    const q = (x0 + wallX) * 0.55
    sc.path(M(x0, y0) + `Q${f(q)} ${f(y0)} ${f(wallX)} ${f(y1)}`)
    sc.path(M(x0, y0 - rail) + `Q${f(q)} ${f(y0 - rail)} ${f(wallX)} ${f(y1 - rail)}`)
    // arcade between the rails
    const n = Math.floor((wallX - x0) / (rail * 1.4))
    if (rail >= g.minSub * 0.5)
      for (let j = 0; j < n; j++) {
        const t = (j + 0.5) / n,
          x = x0 + (wallX - x0) * t
        const yb = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * y0 + t * t * y1 // bezier y at t
        archAt(sc, { k: 0.8, foils: 3, depth: 0 }, x, yb - rail * 0.92, rail * 0.38, yb)
      }
  }
  pinnacleAt(sc, pw * 0.35, pierTop, H * 0.34, 1)
  return { sc, box: [-2, -H - H * 0.1, wallX + S * 0.06 + 4, H + H * 0.1 + 4] }
}

// ---------- 9. bands ----------
export function band(S, type, o = {}) {
  const sc = scene(),
    g = G(),
    w = S,
    h = S * 0.18
  sc.path(line(0, h, w, h))
  if (type === "crenellation") {
    const p = h * 0.9
    let d = M(0, h)
    for (let x = 0; x < w; x += p)
      d +=
        L(x, 0) + L(Math.min(w, x + p / 2), 0) + L(Math.min(w, x + p / 2), h * 0.45) + L(Math.min(w, x + p), h * 0.45)
    sc.path(d)
  }
  if (type === "arcade") {
    const n = Math.max(1, Math.floor(w / (h * 0.7))),
      pw = w / n
    for (let i = 0; i < n; i++)
      if (pw >= g.minSub * 0.4) archAt(sc, { k: 1, foils: 3, depth: 0 }, pw * (i + 0.5), h * 0.06, pw * 0.42, h)
    sc.path(line(0, 0, w, 0))
  }
  if (type === "diaper") {
    const R = h * 0.26,
      p = R * 2.3
    for (let x = R * 1.2; x < w - R; x += p) {
      if ((2 * Math.PI * R) / 4 >= g.minLobe) {
        sc.path(foilRing(x, R * 1.15, R, 4, g.lambda))
        sc.path(foilRing(x + p / 2, h - R * 1.15, R, 4, g.lambda))
      } else {
        sc.path(circle(x, R * 1.15, R))
        sc.path(circle(x + p / 2, h - R * 1.15, R))
      }
    }
  }
  if (type === "dogtooth") {
    const p = h * 0.8
    let d = M(0, h * 0.5),
      d2 = M(0, h * 0.5)
    for (let x = 0; x < w; x += p) {
      d += L(x + p / 2, 0) + L(Math.min(w, x + p), h * 0.5)
      d2 += L(x + p / 2, h) + L(Math.min(w, x + p), h * 0.5)
    }
    sc.path(d)
    sc.path(d2)
  }
  if (type === "billet") {
    const p = h * 0.55
    let d = ""
    for (let row = 0; row < 3; row++)
      for (let x = ((row % 2) * p) / 2; x < w; x += p)
        d += M(x, h * (0.2 + row * 0.3)) + L(Math.min(w, x + p * 0.55), h * (0.2 + row * 0.3))
    sc.path(d)
  }
  return { sc, box: [-2, -2, w + 4, h + 4] }
}

// ---------- 10. facade ----------
/**
 * recursive layout: facade -> [tower, nave, tower] -> tiers -> cells with a role.
 * role by cell aspect and size; each role renders with a generator above.
 */
export function facade(S, o = {}) {
  const sc = scene(),
    g = G(),
    W = S,
    H = S * 1.05,
    tw = W * 0.27,
    nave = W - 2 * tw,
    spireH = H * 0.48
  const tiers = [H * 0.3, H * 0.38, H * 0.32]
  const yTier = i => -tiers.slice(0, i).reduce((p, c) => p + c, 0)
  // masses
  for (const x of [0, tw, tw + nave, W]) sc.path(line(x, 0, x, -H))
  sc.path(line(0, -H, tw, -H))
  sc.path(line(tw + nave, -H, W, -H))
  for (let i = 1; i <= 2; i++) sc.path(line(0, yTier(i), W, yTier(i))) // string courses
  // buttresses at tower edges with set-offs
  for (const x of [tw * 0.1, W - tw * 0.1]) {
    sc.path(line(x, 0, x, -H * 0.92))
    for (let i = 1; i <= 2; i++)
      sc.path(line(x, yTier(i) + tw * 0.04, x < W / 2 ? x - tw * 0.1 : x + tw * 0.1, yTier(i) + tw * 0.1))
  }
  const cell = (x, y, w, h) => ({ x, y, w, h, cx: x + w / 2 })
  const lancets = (c, n, spec, inset = 0.12) => {
    const pw = c.w / n
    for (let i = 0; i < n; i++)
      if (pw >= g.minSub * 0.4)
        archAt(sc, spec, c.x + pw * (i + 0.5), c.y - c.h + c.h * inset, pw * 0.38, c.y - c.h * inset)
  }
  const naveCells = [
    cell(tw, 0, nave, tiers[0]),
    cell(tw, yTier(1), nave, tiers[1]),
    cell(tw, yTier(2), nave, tiers[2]),
  ]
  const towerCells = [0, tw + nave].map(x => tiers.map((h, i) => cell(x, yTier(i), tw, h)))
  // nave tier 1: portal (tracery tympanum) + flanking blind arches
  {
    const c = naveCells[0]
    archAt(sc, { k: 1, depth: 1 }, c.cx, c.y - c.h * 0.92, nave * 0.26, c.y)
    for (const s of [-1, 1])
      if (nave * 0.1 >= g.minSub)
        archAt(sc, { k: 1, foils: 3, depth: 0 }, c.cx + s * nave * 0.36, c.y - c.h * 0.6, nave * 0.07, c.y)
  }
  // nave tier 2: rose
  {
    const c = naveCells[1],
      R = Math.min(nave * 0.42, c.h * 0.44)
    const r = rose(2 * R, { spokes: 8, rings: R >= g.minSub * 2 ? 2 : 1, foils: 3 })
    sc.parts.push(`<g transform="translate(${f(c.cx)} ${f(c.y - c.h / 2)})">${r.sc.parts.join("")}</g>`)
  }
  // nave tier 3: blind arcade + gable with trefoil
  {
    const c = naveCells[2]
    lancets(cell(c.x, c.y - c.h * 0.1, c.w, c.h * 0.55), 5, { k: 1, foils: 3, depth: 0 }, 0.1)
    const gy = c.y - c.h * 0.7,
      apex = -H - nave * 0.32
    sc.path(line(tw, gy, tw + nave, gy))
    sc.path(M(tw, -H) + L(W / 2, apex) + L(W - tw, -H))
    if (nave * 0.08 >= g.minLobe) sc.path(foilRing(W / 2, -H - nave * 0.1, nave * 0.07, 3, g.lambda))
    finial(sc, W / 2, apex, nave * 0.05)
  }
  for (const [t, tc] of towerCells.entries()) {
    const x0 = t ? tw + nave : 0,
      cx = x0 + tw / 2
    archAt(sc, { k: 1.2, foils: 3, depth: 0 }, cx, tc[0].y - tc[0].h * 0.85, tw * 0.22, 0) // tier 1 portal
    lancets(tc[1], 2, { k: 1.8, depth: 1 }, 0.12) // tier 2 paired lancets
    lancets(tc[2], 2, { k: 1.4, foils: 3, depth: 0 }, 0.1) // tier 3 belfry
    spireAt(sc, cx, -H, tw * 0.78, spireH, { crocket: spireH * 0.09 })
    if (tw * 0.18 * 0.26 >= g.minLobe) for (const s of [-1, 1]) pinnacleAt(sc, cx + s * tw * 0.42, -H, tw * 0.38, 0)
  }
  return { sc, box: [-tw * 0.1 - 2, -H - spireH - 6, W + tw * 0.2 + 4, H + spireH + 10] }
}

// ---------- 3. lobes ----------
export function ring(S, n, shape) {
  const sc = scene()
  sc.path(foilRing(0, 0, S / 2 - 2, n, G().lambda, shape))
  return { sc, box: [-S / 2 - 2, -S / 2 - 2, S + 4, S + 4] }
}
export function head(S, foils, shape, k = 1) {
  const sc = scene(),
    a = S / 2,
    { P, N, apex } = sampleHeadN(a, k, foils)
  const d = cusped(P, N, G().lambda, false, a, shape, insideHead(a, k), apex)
  sc.path(d ?? headTwoCentred(a, k).d, d ? "" : "aux")
  sc.path(line(-a, 0, -a, a * 0.3))
  sc.path(line(a, 0, a, a * 0.3))
  const rise = twoCentred(a, k).rise
  return { sc, box: [-a - 2, -rise - 2, S + 4, rise + a * 0.3 + 4] }
}

// ---------- 4. anatomy (px, S = height) ----------
const leaf = (x, y, ang, len, w = 0.45) => {
  // closed bezier leaf from (x,y) heading ang
  const c = Math.cos(ang),
    sn = Math.sin(ang),
    nx = -sn,
    ny = c,
    ex = x + c * len,
    ey = y + sn * len
  return (
    M(x, y) +
    `C${f(x + c * len * 0.3 + nx * len * w)} ${f(y + sn * len * 0.3 + ny * len * w)} ${f(ex - c * len * 0.2 + nx * len * w * 0.5)} ${f(ey - sn * len * 0.2 + ny * len * w * 0.5)} ${f(ex)} ${f(ey)}` +
    `C${f(ex - c * len * 0.2 - nx * len * w * 0.5)} ${f(ey - sn * len * 0.2 - ny * len * w * 0.5)} ${f(x + c * len * 0.3 - nx * len * w)} ${f(y + sn * len * 0.3 - ny * len * w)} ${f(x)} ${f(y)}Z`
  )
}
const bud = (x, y, ang, len) => {
  const c = Math.cos(ang),
    sn = Math.sin(ang),
    r = len * 0.28,
    cx = x + c * (len - r),
    cy = y + sn * (len - r)
  return line(x, y, cx - c * r, cy - sn * r) + circle(cx, cy, r)
}
export function capital(S, o = {}) {
  const sc = scene(),
    g = G(),
    w = S * 0.34,
    W = S * 0.92,
    ab = S * 0.16
  for (const sd of [-1, 1])
    sc.path(
      M((sd * w) / 2, S) +
        `C${f((sd * w) / 2)} ${f(S * 0.55)} ${f((sd * W) / 2)} ${f(S * 0.5)} ${f((sd * W) / 2)} ${f(ab)}`,
    )
  sc.path(M(-W / 2, ab) + L(-W / 2, 0) + L(W / 2, 0) + L(W / 2, ab))
  sc.path(line(-w / 2, S, w / 2, S))
  sc.path(line((-W / 2) * 0.85, S * 0.5, (W / 2) * 0.85, S * 0.5))
  if (o.crockets && S * 0.12 >= g.minLobe)
    for (const sd of [-1, 1]) {
      crocket(sc, sd * W * 0.42, ab + S * 0.06, sd, S * 0.16)
      crocket(sc, sd * W * 0.2, S * 0.5, sd, S * 0.12)
    }
  if (o.leaves && S * 0.1 >= g.minLobe)
    for (let i = -2; i <= 2; i++) sc.path(leaf(i * W * 0.18, S * 0.95, -Math.PI / 2 - i * 0.12, S * 0.42, 0.3))
  return { sc, box: [-W / 2 - 2, -2, W + 4, S + 4] }
}
export function base(S) {
  const sc = scene(),
    w = S * 0.5,
    W = S * 0.9
  sc.path(M(-W / 2, S) + L(-W / 2, S * 0.8) + L(W / 2, S * 0.8) + L(W / 2, S) + "Z") // plinth
  for (const sd of [-1, 1])
    sc.path(
      M(((sd * W) / 2) * 0.95, S * 0.8) +
        arc(S * 0.18, sd * W * 0.34, S * 0.55, sd > 0 ? 0 : 1) +
        `C${f(sd * W * 0.34)} ${f(S * 0.45)} ${f((sd * w) / 2)} ${f(S * 0.42)} ${f((sd * w) / 2)} ${f(S * 0.3)}` +
        arc(S * 0.1, (sd * w) / 2, S * 0.12, sd > 0 ? 0 : 1) +
        L((sd * w) / 2, 0),
    )
  sc.path(line(-w / 2, S * 0.12, w / 2, S * 0.12))
  sc.path(line(-W * 0.34, S * 0.55, W * 0.34, S * 0.55))
  return { sc, box: [-W / 2 - 2, -2, W + 4, S + 4] }
}
export function corbel(S, o = {}) {
  const sc = scene(),
    g = G()
  sc.path(line(0, -S * 0.1, 0, S * 1.1))
  sc.path(
    M(0, 0) +
      L(S * 0.55, 0) +
      L(S * 0.55, S * 0.14) +
      `C${f(S * 0.55)} ${f(S * 0.5)} ${f(S * 0.15)} ${f(S * 0.45)} 0 ${f(S * 0.95)}`,
  )
  if (S * 0.1 >= g.minLobe) sc.path(leaf(S * 0.05, S * 0.8, -Math.PI / 2 + 0.55, S * 0.42, 0.35))
  if (o.head && S * 0.2 >= g.minSub * 0.5) sc.path(foilRing(S * 0.27, S * 0.3, S * 0.11, 3, g.lambda))
  return { sc, box: [-2, -S * 0.1 - 2, S * 0.6 + 4, S * 1.2 + 4] }
}
export function boss(S, o = {}) {
  const sc = scene(),
    g = G(),
    R = S / 2 - 2,
    n = o.n ?? 4
  sc.path(circle(0, 0, R))
  if ((2 * Math.PI * R * 0.7) / n >= g.minLobe) sc.path(foilRing(0, 0, R * 0.72, n, g.lambda))
  sc.path(circle(0, 0, R * 0.18))
  if (R * 0.5 >= g.minLobe)
    for (let i = 0; i < n; i++) sc.path(leaf(0, 0, (i / n) * Math.PI * 2 - Math.PI / 2 + Math.PI / n, R * 0.68, 0.32))
  return { sc, box: [-R - 2, -R - 2, 2 * R + 4, 2 * R + 4] }
}
export function hoodMould(S, o = {}) {
  const sc = scene(),
    g = G(),
    a = S * 0.4,
    k = o.k ?? 1,
    d = S * 0.06,
    { r, rise } = twoCentred(a, k),
    r2 = r + d,
    rise2 = Math.sqrt(r2 * r2 - (k * a) ** 2)
  archAt(sc, { k, foils: o.foils ?? 0, depth: 0 }, 0, -rise, a, a * 0.5)
  sc.path(M(-a - d, 0) + arc(r2, 0, -rise2) + arc(r2, a + d, 0)) // hood: same centres, r + d
  for (const sd of [-1, 1]) {
    const x = sd * (a + d / 2)
    if (d >= g.minLobe * 0.6) sc.path(foilRing(x, d * 0.1, d * 0.8, 4, g.lambda))
    else sc.path(M(x - d, -d) + L(x + d, -d) + L(x + d, d) + L(x - d, d) + "Z")
  } // label stops
  return { sc, box: [-a - 2 * d - 2, -rise2 - 2, 2 * a + 4 * d + 4, rise2 + a * 0.5 + 4] }
}
export function finialOf(S, type) {
  const sc = scene(),
    g = G(),
    s = S * 0.28
  sc.path(line(0, S * 0.55, 0, S * 0.05))
  if (type === "fleur") {
    sc.path(leaf(0, S * 0.3, -Math.PI / 2, S * 0.38, 0.4))
    for (const sd of [-1, 1])
      sc.path(
        M(0, S * 0.3) +
          `C${f(sd * s * 0.9)} ${f(S * 0.28)} ${f(sd * s * 1.2)} ${f(S * 0.05)} ${f(sd * s * 0.6)} ${f(S * 0.0)}` +
          `C${f(sd * s * 0.9)} ${f(S * 0.2)} ${f(sd * s * 0.4)} ${f(S * 0.35)} 0 ${f(S * 0.36)}`,
      )
    sc.path(line(-s * 0.5, S * 0.38, s * 0.5, S * 0.38))
  }
  if (type === "cross") {
    sc.path(line(-s, S * 0.22, s, S * 0.22))
    for (const [x, y] of [
      [0, S * 0.05],
      [-s, S * 0.22],
      [s, S * 0.22],
      [0, S * 0.4],
    ])
      if (s * 0.3 >= g.minLobe * 0.5) sc.path(foilRing(x, y, s * 0.22, 3, g.lambda))
  }
  if (type === "pommel") {
    sc.path(circle(0, S * 0.22, s * 0.55))
    sc.path(circle(0, S * 0.22, s * 0.25))
  }
  if (type === "bud") {
    sc.path(bud(0, S * 0.55, -Math.PI / 2, S * 0.5))
    for (const sd of [-1, 1]) sc.path(leaf(0, S * 0.45, -Math.PI / 2 + sd * 0.9, S * 0.3, 0.4))
  }
  return { sc, box: [-s * 1.4, -2, s * 2.8, S * 0.6 + 4] }
}
export function crocketsOf(S, type) {
  const sc = scene(),
    g = G(),
    n = 4,
    step = S / n
  sc.path(line(0, S, S * 0.55, 0))
  for (let i = 1; i < n; i++) {
    const t = i / n,
      x = S * 0.55 * t,
      y = S * (1 - t),
      ang = Math.atan2(-1, 0.55) - 0.9
    if (type === "curl") crocket(sc, x, y, -1, step * 0.5)
    if (type === "leaf") sc.path(leaf(x, y, ang, step * 0.7, 0.45))
    if (type === "bud") sc.path(bud(x, y, ang, step * 0.6))
    if (type === "ballflower" && step * 0.18 >= g.minLobe * 0.4) {
      const cx = x - step * 0.22,
        cy = y - step * 0.1,
        r = step * 0.2
      sc.path(circle(cx, cy, r))
      sc.path(circle(cx, cy, r * 0.45))
      for (let j = 0; j < 3; j++) {
        const a0 = j * 2.094 - 1.57
        sc.path(
          M(cx + r * Math.cos(a0), cy + r * Math.sin(a0)) +
            `Q${f(cx + r * 0.9 * Math.cos(a0 + 1.05))} ${f(cy + r * 0.9 * Math.sin(a0 + 1.05))} ${f(cx + r * Math.cos(a0 + 2.094))} ${f(cy + r * Math.sin(a0 + 2.094))}`,
        )
      }
    }
  }
  return { sc, box: [-step * 0.8, -2, S * 0.55 + step * 0.8, S + 4] }
}
export function fleuron(S, o = {}) {
  const sc = scene(),
    n = o.n ?? 4,
    R = S / 2 - 2
  for (let i = 0; i < n; i++) sc.path(leaf(0, 0, (i / n) * Math.PI * 2 - Math.PI / 2, R, 0.5))
  sc.path(circle(0, 0, R * 0.12))
  return { sc, box: [-R - 2, -R - 2, 2 * R + 4, 2 * R + 4] }
}

// ---------- 14. grammar: seeded S-curve tracery ----------
/**
 * axiom: two trunks from the left springer region. rules (seeded): fork | curl | foil-stop.
 * conventions: bilateral symmetry via <use scale(-1 1)>, tangent-continuous S-curves, shrink .62 per generation,
 * every branch ends in a foil, everything clipped to the arch head via <clipPath>.
 */
export function grammar(S, o = {}) {
  const sc = scene(),
    g = G(),
    a = S / 2,
    k = o.k ?? 1.2,
    rng = mulberry32((g.seed * 2654435761 + (o.salt ?? 0) * 97) >>> 0)
  const { r, rise } = twoCentred(a, k),
    id = "c" + Math.random().toString(36).slice(2, 7)
  const headD = M(-a, 0) + arc(r, 0, -rise) + arc(r, a, 0) + "Z"
  sc.parts.push(`<clipPath id="${id}"><path d="${headD}"/></clipPath>`)
  sc.path(M(-a, a * 0.35) + L(-a, 0) + arc(r, 0, -rise) + arc(r, a, 0) + L(a, a * 0.35))
  const br = [],
    shrink = o.shrink ?? 0.62,
    spread = ((o.angle ?? 42) * Math.PI) / 180
  const foil = (x, y, R) => {
    if ((2 * Math.PI * R) / 3 >= g.minLobe) br.push(foilRing(x, y, R, rng() < 0.6 ? 3 : 4, g.lambda))
    else br.push(circle(x, y, R * 0.8))
  }
  const branch = (x, y, ang, len, depth) => {
    const bend = (o.bend ?? 0.8) * (rng() < 0.5 ? 1 : -1),
      c = Math.cos(ang),
      sn = Math.sin(ang),
      nx = -sn,
      ny = c
    const ex = x + c * len,
      ey = y + sn * len
    br.push(
      M(x, y) +
        `C${f(x + c * len * 0.35 + nx * bend * len * 0.3)} ${f(y + sn * len * 0.35 + ny * bend * len * 0.3)} ${f(ex - c * len * 0.35 - nx * bend * len * 0.3)} ${f(ey - sn * len * 0.35 - ny * bend * len * 0.3)} ${f(ex)} ${f(ey)}`,
    )
    if (depth <= 0 || len * shrink < g.minSub * 0.35) return foil(ex + c * len * 0.25, ey + sn * len * 0.25, len * 0.25)
    const rule = rng()
    if (rule < 0.5) {
      branch(ex, ey, ang - spread, len * shrink, depth - 1)
      branch(ex, ey, ang + spread, len * shrink, depth - 1)
    } else if (rule < 0.8) branch(ex, ey, ang + bend * spread * 0.7, len * shrink, depth - 1)
    else {
      foil(ex + nx * bend * len * 0.3, ey + ny * bend * len * 0.3, len * 0.22)
      branch(ex, ey, ang - bend * spread, len * shrink * 0.85, depth - 1)
    }
  }
  branch(-a * 0.97, 0, -Math.PI / 2 + 0.3, a * 0.55, o.depth ?? 3)
  branch(-a * 0.45, 0, -Math.PI / 2 - 0.15, a * 0.5, (o.depth ?? 3) - 1)
  sc.parts.push(
    `<g clip-path="url(#${id})" fill="none" stroke="currentColor"><g id="${id}g">${br.map(d => `<path d="${d}" vector-effect="non-scaling-stroke"/>`).join("")}</g><use href="#${id}g" transform="scale(-1 1)"/></g>`,
  )
  return { sc, box: [-a - 2, -rise - 2, S + 4, rise + a * 0.35 + 4] }
}

// ---------- 14b. grammar2: copy of grammar + asymmetry + intensity ----------
/**
 * asym 0..1: the right side replays the left side's random draws blended with fresh ones: v = (1-asym)*left + asym*fresh.
 *            0 = exact mirror, 1 = independent right side. same seed, so it stays stable under the slider.
 * intensity 0..1: depth +0..2, trunks 2..4, fork rate .5..8, spread +0..10deg, bend x1..1.6, shrink .62..74,
 *            tendril curls along branches, stroke width by generation, foils sometimes 5-lobed.
 */
export function grammar2(S, o = {}) {
  const sc = scene(),
    g = G(),
    a = S / 2,
    k = o.k ?? 1.2,
    asym = o.asym ?? g.asym,
    I = o.intensity ?? g.intensity
  const seed = (g.seed * 2654435761 + (o.salt ?? 0) * 97) >>> 0
  const { r, rise } = twoCentred(a, k),
    id = "c" + Math.random().toString(36).slice(2, 7)
  const headD = M(-a, 0) + arc(r, 0, -rise) + arc(r, a, 0) + "Z"
  sc.parts.push(`<clipPath id="${id}"><path d="${headD}"/></clipPath>`)
  sc.path(M(-a, a * 0.35) + L(-a, 0) + arc(r, 0, -rise) + arc(r, a, 0) + L(a, a * 0.35))
  const shrink = (o.shrink ?? 0.62) + I * 0.12,
    spread = (((o.angle ?? 42) + I * 10) * Math.PI) / 180,
    forkP = 0.5 + I * 0.3,
    bendK = (o.bend ?? 0.8) * (1 + I * 0.6)
  const depth0 = (o.depth ?? 3) + Math.round(I * 2),
    trunks = 2 + Math.round(I * 2)
  const gen = rng => {
    const br = []
    const push = (d, gn) => br.push(`<path d="${d}" stroke-width="${f(g.weight * (1 + gn * 0.35 * I))}"/>`)
    const foil = (x, y, R, gn) => {
      const n = rng() < 0.6 ? 3 : rng() < 0.5 + I * 0.4 ? 4 : 5
      if ((2 * Math.PI * R) / n >= g.minLobe) push(foilRing(x, y, R, n, g.lambda), 0)
      else push(circle(x, y, R * 0.8), 0)
    }
    const tendril = (x, y, ang, len) => {
      const c = Math.cos(ang),
        sn = Math.sin(ang),
        nx = -sn,
        ny = c
      push(
        M(x, y) +
          `Q${f(x + c * len * 0.6 + nx * len * 0.5)} ${f(y + sn * len * 0.6 + ny * len * 0.5)} ${f(x + nx * len * 0.9)} ${f(y + ny * len * 0.9)}` +
          `Q${f(x - c * len * 0.3 + nx * len * 0.9)} ${f(y - sn * len * 0.3 + ny * len * 0.9)} ${f(x - c * len * 0.2 + nx * len * 0.55)} ${f(y - sn * len * 0.2 + ny * len * 0.55)}`,
        0,
      )
    }
    const branch = (x, y, ang, len, depth, gn) => {
      const bend = bendK * (rng() < 0.5 ? 1 : -1),
        c = Math.cos(ang),
        sn = Math.sin(ang),
        nx = -sn,
        ny = c
      const ex = x + c * len,
        ey = y + sn * len
      push(
        M(x, y) +
          `C${f(x + c * len * 0.35 + nx * bend * len * 0.3)} ${f(y + sn * len * 0.35 + ny * bend * len * 0.3)} ${f(ex - c * len * 0.35 - nx * bend * len * 0.3)} ${f(ey - sn * len * 0.35 - ny * bend * len * 0.3)} ${f(ex)} ${f(ey)}`,
        depth,
      )
      if (I > 0 && rng() < I * 0.6 && len * 0.3 >= g.minLobe)
        tendril(
          x + c * len * 0.5 + nx * bend * len * 0.22,
          y + sn * len * 0.5 + ny * bend * len * 0.22,
          ang,
          len * 0.3 * (bend > 0 ? 1 : -1),
        )
      if (depth <= 0 || len * shrink < g.minSub * 0.35)
        return foil(ex + c * len * 0.25, ey + sn * len * 0.25, len * 0.25, gn)
      const rule = rng()
      if (rule < forkP) {
        branch(ex, ey, ang - spread, len * shrink, depth - 1, gn + 1)
        branch(ex, ey, ang + spread, len * shrink, depth - 1, gn + 1)
      } else if (rule < forkP + 0.3) branch(ex, ey, ang + bend * spread * 0.7, len * shrink, depth - 1, gn + 1)
      else {
        foil(ex + nx * bend * len * 0.3, ey + ny * bend * len * 0.3, len * 0.22, gn)
        branch(ex, ey, ang - bend * spread, len * shrink * 0.85, depth - 1, gn + 1)
      }
    }
    const starts = [
      [-a * 0.97, 0, -Math.PI / 2 + 0.3, a * 0.55, depth0],
      [-a * 0.45, 0, -Math.PI / 2 - 0.15, a * 0.5, depth0 - 1],
      [-a * 0.99, a * 0.3, -Math.PI / 2 + 0.5, a * 0.4, depth0 - 1],
      [-a * 0.2, 0, -Math.PI / 2 - 0.5, a * 0.35, depth0 - 2],
    ]
    for (let i = 0; i < trunks; i++) {
      const [x, y, ang, len, d] = starts[i]
      branch(x, y, ang + (rng() - 0.5) * I * 0.5, len * (1 + (rng() - 0.5) * I * 0.4), d, 0)
    }
    return br
  }
  const rec = [],
    rL = mulberry32(seed),
    rngL = () => {
      const v = rL()
      rec.push(v)
      return v
    }
  const left = gen(rngL)
  let i = 0
  const rR = mulberry32((seed ^ 0x9e3779b9) >>> 0),
    rngR = () => {
      const v = rR(),
        b = rec[i++]
      return b === undefined ? v : b * (1 - asym) + v * asym
    }
  const right = asym > 0 ? gen(rngR) : null
  sc.parts.push(
    `<g clip-path="url(#${id})" fill="none" stroke="currentColor" vector-effect="non-scaling-stroke"><g id="${id}g">${left.join("")}</g>` +
      (right ? `<g transform="scale(-1 1)">${right.join("")}</g>` : `<use href="#${id}g" transform="scale(-1 1)"/>`) +
      `</g>`,
  )
  return { sc, box: [-a - 2, -rise - 2, S + 4, rise + a * 0.35 + 4] }
}
