/* ============================================================
   LIB BACKBONE. Sections 1-7 are the future package boundary:
   packages/gothic/src/{rng,path,motifs,plan,compose,emit,mount}.js
   Everything above section 8 is pure except mount.
   ============================================================ */

// ---------- 1. rng ----------
/** @typedef {() => number} Rng  returns [0,1) */
/** @param {number} seed @returns {Rng} */
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
/** @param {string} s @returns {number} fnv1a */
export function hash(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)]
const range = (rng, lo, hi) => lo + rng() * (hi - lo)

// ---------- 2. path builder ----------
// Local coordinate contract for motifs: origin = corner of the inset frame,
// +x runs along the top edge, +y runs down the left edge. Mirroring to the
// other three corners is compose()'s job, never the motif's.
const f = n => Math.round(n * 100) / 100
export function P() {
  const d = []
  const api = {
    M: (x, y) => (d.push(`M${f(x)} ${f(y)}`), api),
    L: (x, y) => (d.push(`L${f(x)} ${f(y)}`), api),
    Q: (cx, cy, x, y) => (d.push(`Q${f(cx)} ${f(cy)} ${f(x)} ${f(y)}`), api),
    C: (a, b, c, e, x, y) => (d.push(`C${f(a)} ${f(b)} ${f(c)} ${f(e)} ${f(x)} ${f(y)}`), api),
    A: (r, x, y, sweep = 1, large = 0) => (d.push(`A${f(r)} ${f(r)} 0 ${large} ${sweep} ${f(x)} ${f(y)}`), api),
    Z: () => (d.push("Z"), api),
    toString: () => d.join(""),
  }
  return api
}
/** Catmull-Rom -> cubic bezier. pts: [[x,y],...] */
export function smooth(pts, tension = 1) {
  const p = P().M(pts[0][0], pts[0][1])
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i],
      p1 = pts[i],
      p2 = pts[i + 1],
      p3 = pts[i + 2] ?? p2
    const k = tension / 6
    p.C(
      p1[0] + (p2[0] - p0[0]) * k,
      p1[1] + (p2[1] - p0[1]) * k,
      p2[0] - (p3[0] - p1[0]) * k,
      p2[1] - (p3[1] - p1[1]) * k,
      p2[0],
      p2[1],
    )
  }
  return p
}
/** log spiral points. center, r0 start radius, turns, decay per turn, a0 start angle */
export function spiralPts(cx, cy, r0, turns, decay, a0, steps = 10) {
  const out = []
  const n = Math.ceil(turns * steps)
  for (let i = 0; i <= n; i++) {
    const t = i / steps // turns elapsed
    const r = r0 * Math.pow(decay, t)
    const a = a0 + t * Math.PI * 2
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return out
}
export const diamond = (x, y, s, ry = 1.6) =>
  P()
    .M(x, y - s * ry)
    .L(x + s, y)
    .L(x, y + s * ry)
    .L(x - s, y)
    .Z()

// ---------- 3. motifs ----------
/**
 * @typedef {{ d: string, role: 'rail'|'corner'|'finial'|'inner', k?: number, markerEnd?: 'dot'|'lozenge' }} Stroke
 *   k: stroke weight multiplier, default 1. markerEnd: SVG <marker> terminal from emitSVG's <defs>
 * @typedef {{ rng: Rng, c: number, density: number, weight: number }} MotifCtx
 *   c: corner budget in px. motif may draw inside [0,c]x[0,c] and a little past.
 * @typedef {(ctx: MotifCtx) => Stroke[]} CornerMotif   // local coords, see section 2
 * @typedef {(ctx: MotifCtx & { len: number }) => Stroke[]} FinialMotif  // centered at 0,0 on a horizontal rail, +y is inward
 * @typedef {(ctx: MotifCtx & { len: number, gap: number }) => Stroke[]} RailMotif // from (0,0) to (len,0), hole of `gap` at center when gap>0
 */

/** @type {Record<string, CornerMotif>} */
export const corners = {
  // KH2-style: rail turns inward with a hard step, then a stud
  bracket({ rng, c, density }) {
    const s = c * 0.28,
      step = c * range(rng, 0.18, 0.3)
    const out = []
    out.push({ role: "corner", d: P().M(c, 0).L(step, 0).L(step, step).L(0, step).L(0, c).toString() })
    out.push({ role: "corner", d: diamond(step + s * 0.9, step + s * 0.9, s * 0.35, 1.5).toString(), k: 0.9 })
    if (density >= 1)
      out.push({
        role: "inner",
        d: P()
          .M(c * 0.9, step * 1.9)
          .L(step * 1.9, step * 1.9)
          .L(step * 1.9, c * 0.9)
          .toString(),
      })
    if (density >= 2)
      out.push({
        role: "inner",
        d: P()
          .M(c * 1.35, 0)
          .L(c * 1.15, 0)
          .M(0, c * 1.35)
          .L(0, c * 1.15)
          .toString(),
      })
    if (density >= 3) out.push({ role: "inner", d: diamond(c * 1.12, step * 0.5, s * 0.22).toString() })
    return out
  },
  // pointed cusp: the corner itself is notched inward, gothic arch cross-section
  cusp({ rng, c, density }) {
    const n = c * range(rng, 0.3, 0.45)
    const out = []
    out.push({
      role: "corner",
      d: P()
        .M(c, 0)
        .L(n * 1.2, 0)
        .Q(n * 0.55, 0, n, n)
        .Q(0, n * 0.55, 0, n * 1.2)
        .L(0, c)
        .toString(),
    })
    out.push({ role: "corner", d: diamond(n * 1.55, n * 1.55, c * 0.085, 1.7).toString() })
    if (density >= 1)
      out.push({
        role: "inner",
        d: P()
          .M(n * 1.2, n * 0.35)
          .L(n * 2.1, n * 0.35)
          .M(n * 0.35, n * 1.2)
          .L(n * 0.35, n * 2.1)
          .toString(),
      })
    if (density >= 2)
      out.push({
        role: "inner",
        d: P()
          .M(c * 1.1, 0)
          .Q(c * 0.9, c * 0.25, c * 0.8, c * 0.5)
          .toString(),
      })
    if (density >= 3)
      out.push({
        role: "inner",
        d: P()
          .M(0, c * 1.1)
          .Q(c * 0.25, c * 0.9, c * 0.5, c * 0.8)
          .toString(),
      })
    return out
  },
  // filigree curl: quarter arc at the corner, stem into a log spiral, leaves by density
  curl({ rng, c, density }) {
    const q = c * 0.35
    const out = []
    out.push({ role: "corner", d: P().M(c, 0).L(q, 0).A(q, 0, q, 1).L(0, c).toString() })
    const cx = c * range(rng, 0.62, 0.78),
      cy = c * range(rng, 0.62, 0.78)
    const r0 = c * range(rng, 0.34, 0.44)
    const pts = spiralPts(cx, cy, r0, range(rng, 1.0, 1.45), 0.38, Math.PI * 1.25, 8)
    out.push({
      role: "corner",
      d: P()
        .M(q * 0.3, q * 0.3)
        .L(pts[0][0], pts[0][1])
        .toString(),
      k: 0.8,
    })
    out.push({ role: "corner", d: smooth(pts).toString(), k: 0.8 })
    for (let i = 0; i < density; i++) {
      const p = pts[Math.min(pts.length - 1, 2 + i * 3)]
      const ang = Math.atan2(p[1] - cy, p[0] - cx) + Math.PI / 2
      const l = r0 * 0.55
      out.push({
        role: "inner",
        d: P()
          .M(p[0], p[1])
          .Q(
            p[0] + Math.cos(ang) * l * 0.7,
            p[1] + Math.sin(ang) * l * 0.7 - l * 0.35,
            p[0] + Math.cos(ang) * l,
            p[1] + Math.sin(ang) * l,
          )
          .toString(),
        markerEnd: "dot",
      })
    }
    return out
  },
}

/** @type {Record<string, FinialMotif>} */
export const finials = {
  none: () => [],
  diamond({ c }) {
    return [{ role: "finial", d: diamond(0, 0, c * 0.12, 1.8).toString() }]
  },
  triplet({ c, rng }) {
    const s = c * 0.1,
      g = c * range(rng, 0.38, 0.5)
    return [
      { role: "finial", d: diamond(0, 0, s * 1.15, 1.8).toString() },
      { role: "finial", d: diamond(-g, 0, s * 0.7, 1.8).toString() + diamond(g, 0, s * 0.7, 1.8).toString(), k: 0.8 },
    ]
  },
  trefoil({ c }) {
    const r = c * 0.11
    return [
      {
        role: "finial",
        d: P()
          .M(-r * 1.6, 0)
          .A(r, -r * 0.5, -r * 0.9)
          .A(r, r * 0.5, -r * 0.9)
          .A(r, r * 1.6, 0)
          .toString(),
      },
    ]
  },
}

/** @type {Record<string, RailMotif>} */
export const rails = {
  single({ len, gap }) {
    if (gap <= 0) return [{ role: "rail", d: P().M(0, 0).L(len, 0).toString() }]
    const m = len / 2
    return [
      {
        role: "rail",
        d: P()
          .M(0, 0)
          .L(m - gap, 0)
          .M(m + gap, 0)
          .L(len, 0)
          .toString(),
      },
    ]
  },
  double({ len, gap, c }) {
    const base = rails.single({ len, gap, c })
    const o = Math.max(2.5, c * 0.12),
      inset = c * 0.2
    base.push({
      role: "inner",
      d: P()
        .M(inset, o)
        .L(len - inset, o)
        .toString(),
    })
    return base
  },
}

/** @typedef {{ corner: keyof typeof corners, finial: keyof typeof finials, rail: keyof typeof rails }} Preset */
/** @type {Record<string, Preset>} */
export const presets = {
  kingdom: { corner: "bracket", finial: "diamond", rail: "single" },
  cathedral: { corner: "cusp", finial: "trefoil", rail: "double" },
  filigree: { corner: "curl", finial: "triplet", rail: "single" },
  mixed: { corner: "auto", finial: "auto", rail: "auto" },
}

// ---------- 4. plan ----------
/**
 * @typedef {{ seed?: number, preset?: keyof typeof presets, density?: number, weight?: number, pad?: number }} Opts
 * @typedef {{ w:number, h:number, pad:number, c:number, weight:number, density:number, rng:Rng,
 *             corner:CornerMotif, finial:FinialMotif, rail:RailMotif, finialX:boolean, finialY:boolean }} Plan
 *   c        corner budget = clamp(min(w,h) * .16, 8, 34)
 *   finialX  top/bottom edges long enough (>= 9c) to host a midpoint finial
 */
export function plan(w, h, opts = {}) {
  const rng = mulberry32(opts.seed ?? 1)
  const m = Math.min(w, h)
  const c = Math.max(8, Math.min(34, m * 0.16))
  const pad = opts.pad ?? Math.max(3, c * 0.18)
  const preset = presets[opts.preset ?? "kingdom"]
  const res = (tbl, key) =>
    key === "auto"
      ? tbl[
          pick(
            rng,
            Object.keys(tbl).filter(k => k !== "none"),
          )
        ]
      : tbl[key]
  const density = Math.max(0, Math.min(3, opts.density ?? 1))
  return {
    w,
    h,
    pad,
    c,
    rng,
    density,
    weight: (opts.weight ?? 1) * Math.max(0.6, Math.min(1.4, c / 20)),
    corner: res(corners, preset.corner),
    finial: res(finials, preset.finial),
    rail: res(rails, preset.rail),
    finialX: w - 2 * pad >= 9 * c,
    finialY: h - 2 * pad >= 9 * c,
  }
}

// ---------- 5. compose ----------
/** @typedef {{ d:string, role:Stroke['role'], k:number, markerEnd?:string, transform:string, delay:number }} Placed */
const xf = (sx, sy, tx, ty) => `matrix(${sx} 0 0 ${sy} ${f(tx)} ${f(ty)})`
/** @param {Plan} p @returns {Placed[]} */
export function compose(p) {
  const { w, h, pad, c, rng, density, weight } = p
  const iw = w - 2 * pad,
    ih = h - 2 * pad
  const out = []
  const put = (strokes, transform, delay) => {
    for (const s of strokes) out.push({ d: s.d, role: s.role, k: s.k ?? 1, markerEnd: s.markerEnd, transform, delay })
  }

  // corners: one motif sample, mirrored 4x, so all corners agree within the element
  const cornerStrokes = p.corner({ rng, c, density, weight })
  put(cornerStrokes, xf(1, 1, pad, pad), 0)
  put(cornerStrokes, xf(-1, 1, pad + iw, pad), 60)
  put(cornerStrokes, xf(1, -1, pad, pad + ih), 60)
  put(cornerStrokes, xf(-1, -1, pad + iw, pad + ih), 120)

  // rails: from corner budget to corner budget, gap at midpoint when a finial lives there
  const gapX = p.finialX ? c * 0.5 : 0,
    gapY = p.finialY ? c * 0.5 : 0
  const rx = p.rail({ rng, c, density, weight, len: iw - 2 * c, gap: gapX })
  const ry = p.rail({ rng, c, density, weight, len: ih - 2 * c, gap: gapY })
  put(rx, `translate(${f(pad + c)} ${f(pad)})`, 30)
  put(rx, `translate(${f(pad + c)} ${f(pad + ih)}) scale(1 -1)`, 30)
  put(ry, `translate(${f(pad)} ${f(pad + c)}) rotate(90) scale(1 -1)`, 30)
  put(ry, `translate(${f(pad + iw)} ${f(pad + c)}) rotate(90)`, 30)

  // finials
  if (p.finialX) {
    const fs = p.finial({ rng, c, density, weight, len: iw })
    put(fs, `translate(${f(pad + iw / 2)} ${f(pad)})`, 200)
    put(fs, `translate(${f(pad + iw / 2)} ${f(pad + ih)}) scale(1 -1)`, 200)
  }
  if (p.finialY) {
    const fs = p.finial({ rng, c, density, weight, len: ih })
    put(fs, `translate(${f(pad)} ${f(pad + ih / 2)}) rotate(90) scale(1 -1)`, 200)
    put(fs, `translate(${f(pad + iw)} ${f(pad + ih / 2)}) rotate(90)`, 200)
  }
  return out
}

// ---------- 6. emit ----------
const NS = "http://www.w3.org/2000/svg"
/** @param {Placed[]} placed @param {Plan} p @returns {SVGSVGElement} */
export function emitSVG(placed, p) {
  const svg = document.createElementNS(NS, "svg")
  svg.setAttribute("class", "gothic-frame")
  svg.setAttribute("viewBox", `0 0 ${f(p.w)} ${f(p.h)}`)
  svg.setAttribute("preserveAspectRatio", "none")
  svg.setAttribute("aria-hidden", "true")
  svg.innerHTML = `<defs>
    <marker id="g-dot" viewBox="-2 -2 4 4" markerWidth="4" markerHeight="4" orient="auto" markerUnits="strokeWidth"><circle r="1.1" fill="currentColor"/></marker>
    <marker id="g-lozenge" viewBox="-3 -3 6 6" markerWidth="6" markerHeight="6" orient="auto" markerUnits="strokeWidth"><path d="M-2.6 0L0 -1.4L2.6 0L0 1.4Z" fill="currentColor"/></marker>
  </defs>`
  for (const s of placed) {
    const path = document.createElementNS(NS, "path")
    path.setAttribute("d", s.d)
    path.setAttribute("transform", s.transform)
    path.setAttribute("pathLength", "1")
    path.dataset.role = s.role
    path.style.setProperty("--k", String(f(p.weight * s.k)))
    path.style.setProperty("--delay", `${s.delay}ms`)
    if (s.markerEnd) path.setAttribute("marker-end", `url(#g-${s.markerEnd})`)
    svg.appendChild(path)
  }
  return svg
}
/** same placed[] as a data-URI string, for background-image / border-image consumers */
export function emitDataURI(placed, p, ink = "currentColor") {
  const body = placed
    .map(
      s =>
        `<path d="${s.d}" transform="${s.transform}" fill="none" stroke="${ink}" stroke-width="${f(p.weight * s.k)}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("")
  const svg = `<svg xmlns="${NS}" viewBox="0 0 ${f(p.w)} ${f(p.h)}">${body}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

// ---------- 7. mount ----------
/**
 * @typedef {{ el: Element, opts: Opts, svg: SVGSVGElement|null, bg: string|null, w: number, h: number, seed: number }} Mount
 * lifetime: one per host element, lives in `mounts` WeakMap until destroy().
 * one shared ResizeObserver for all mounts; per-element state is in the Mount.
 * regenerate only when quantized w/h or seed change. events touch CSS vars only.
 */
const Q = 4
const quant = n => Math.round(n / Q) * Q
/** @type {WeakMap<Element, Mount>} */
const mounts = new WeakMap()
let counter = 0
// created on first attach, so the module imports outside a document
let ro = null
const observer = () =>
  (ro ??= new ResizeObserver(entries => {
    for (const e of entries) {
      const m = mounts.get(e.target)
      if (!m) continue
      const box = e.target.getBoundingClientRect()
      render(m, quant(box.width), quant(box.height))
    }
  }))
const VOID = /^(input|img|textarea|select|hr|video|canvas)$/i
function render(m, w, h) {
  if (w === m.w && h === m.h && (m.svg || m.bg)) return
  m.w = w
  m.h = h
  const p = plan(w, h, { ...m.opts, seed: m.seed })
  const placed = compose(p)
  m.el.style.setProperty("--gothic-c", `${f(p.c + p.pad)}px`) // hosts may pad by this
  if (VOID.test(m.el.tagName)) {
    // no children allowed: fall back to a background-image data URI, static (no draw-in, glow via CSS filter on host)
    m.bg = emitDataURI(placed, p, getComputedStyle(m.el).getPropertyValue("--gothic-ink").trim() || "currentColor")
    m.el.style.backgroundImage = m.bg
    m.el.style.backgroundSize = "100% 100%"
    m.el.style.backgroundRepeat = "no-repeat"
    m.svg = null
  } else {
    const svg = emitSVG(placed, p)
    m.svg?.remove()
    m.el.appendChild(svg)
    m.svg = svg
  }
  m.el.dispatchEvent(new CustomEvent("gothic:render", { detail: { w, h, c: p.c, paths: placed.length } }))
}
/** @param {Element} el @param {Opts} opts */
export function attach(el, opts = {}) {
  let m = mounts.get(el)
  if (m) {
    m.opts = { ...m.opts, ...opts }
    if ("seed" in opts) m.seed = opts.seed
    m.w = m.h = -1
    render(m, m.el.getBoundingClientRect().width | 0, m.el.getBoundingClientRect().height | 0)
    return m
  }
  el.classList.add("gothic")
  const seed = opts.seed ?? hash((el.id || el.textContent.trim().slice(0, 64)) + ":" + counter++)
  m = { el, opts, svg: null, bg: null, w: -1, h: -1, seed }
  mounts.set(el, m)
  observer().observe(el)
  const b = el.getBoundingClientRect()
  render(m, quant(b.width), quant(b.height))
  return m
}
export function detach(el) {
  const m = mounts.get(el)
  if (!m) return
  observer().unobserve(el)
  m.svg?.remove()
  if (m.bg) el.style.backgroundImage = ""
  mounts.delete(el)
}
export function reseed(el, seed = (Math.random() * 2 ** 32) >>> 0) {
  attach(el, { seed })
}
