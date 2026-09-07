import { sealAlgo } from "../algos/0_seal.js"
import { type AnySpec, type ValuesOf, algoSection, page, section, stagger } from "../kit/index.js"
import { M, TAU, arc, circle, f, foilRing, hash, line, scene, sceneMarkup, sealCaption, sealSvg } from "../lib/index.js"
import { LINKS, hrefFor } from "./0_nav.js"
import "./icons.css"

/* ============ 1. gothic eye: vesica lids, exact fits ============
   lid arc: chord W, sagitta H/2 -> r = (W^2/4 + H^2/4) / H. iris radius <= H/2 (tangent to both lids at the axis). */
type EyeOpts = { iris?: number; lobes?: number; double?: boolean; lash?: number; lashLen?: number }
export function eye(W: number, H: number, o: EyeOpts = {}, minPx = 2) {
  const sc = scene(minPx)
  const r = ((W * W) / 4 + (H * H) / 4) / H
  const iris = Math.min(H / 2, W * (o.iris ?? 0.24))
  const lobes = o.lobes ?? 5
  sc.path(M(-W / 2, 0) + arc(r, W / 2, 0, 1) + arc(r, -W / 2, 0, 1))
  if (o.double && H * 0.12 >= minPx) {
    const r2 = ((W * 0.86) ** 2 / 4 + (H * 0.72) ** 2 / 4) / (H * 0.72)
    sc.path(M(-W * 0.43, 0) + arc(r2, W * 0.43, 0, 1) + arc(r2, -W * 0.43, 0, 1))
  }
  if ((TAU * iris) / lobes >= minPx * 1.5) sc.path(foilRing(0, 0, iris, lobes))
  else sc.path(circle(0, 0, iris))
  if (iris * 0.45 >= 0.6) sc.path(circle(0, 0, iris * 0.45), "dark")
  // lashes: ticks along the upper lid, normal to the arc, count fits the arc length
  const cy = r - H / 2
  const k = Math.max(0, Math.round(W / (o.lash ?? 6)))
  if (k && o.lash !== 0 && W / k >= minPx * 1.5) {
    const a0 = Math.asin(W / 2 / r)
    for (let i = 1; i < k; i++) {
      const a = -Math.PI / 2 - a0 + (2 * a0 * i) / k
      const len = H * (o.lashLen ?? 0.3) * (1 - 0.6 * Math.abs((2 * i) / k - 1))
      sc.path(line(r * Math.cos(a), cy + r * Math.sin(a), (r + len) * Math.cos(a), cy + (r + len) * Math.sin(a)))
    }
  }
  const pad = H * (o.lashLen ?? 0.3) + 1
  return {
    sc,
    svg: `<svg viewBox="${f(-W / 2 - 1)} ${f(-H / 2 - pad)} ${f(W + 2)} ${f(H + 2 * pad)}" width="${W + 2}" height="${f(H + 2 * pad)}">${sceneMarkup(sc)}</svg>`,
  }
}

/* ============ 2. page ============ */
const SPEC = {
  seed: { kind: "seed", default: 1 },
  minPx: { kind: "range", min: 1, max: 6, step: 0.5, default: 2 },
  names: {
    kind: "text",
    default: "github rxjs hn docs mail calendar grapht boop gothic tanstack vite playwright",
    size: 60,
    shuffle: false,
  },
  weight: { kind: "range", min: 0.5, max: 2.5, step: 0.1, default: 1, static: true },
  anim: { kind: "bool", default: true, label: "draw-in", static: true },
} as const satisfies AnySpec
type V = ValuesOf<typeof SPEC>
const SIZES = [16, 20, 24, 32, 48, 96]
let statsEl: HTMLElement
function render(v: V, host: HTMLElement) {
  document.documentElement.style.setProperty("--w", String(v.weight))
  const names = v.names.trim().split(/\s+/)
  const sd = (name: string) => (hash(name) ^ Math.imul(v.seed, 2654435761)) >>> 0
  host.innerHTML = `<section><h2>favorites bar (16px, favicon set to the first)</h2><div class="fav"></div></section>
<section><h2>fma seals by name × size: caption = symmetry n, band list, LOD downgrades</h2><table class="seals"></table></section>
<section><h2>gothic eyes: vesica lids by exact sagitta, iris = foil ring fit to lid height, lashes = ticks</h2><div class="row eyes"></div></section>`
  const $ = (s: string) => host.querySelector(s) as HTMLElement
  $(".fav").innerHTML = names.map(n => `<a href="#">${sealSvg(16, sd(n), v.minPx).svg}${n}</a>`).join("")
  $(".seals").innerHTML =
    `<tr><th>name</th>${SIZES.map(s => `<th>${s}</th>`).join("")}<th>caption</th></tr>` +
    names
      .map(n => {
        const big = sealSvg(96, sd(n), v.minPx)
        return `<tr><td>${n}</td>${SIZES.map(s => `<td>${sealSvg(s, sd(n), v.minPx).svg}</td>`).join("")}<td>${sealCaption(big)}</td></tr>`
      })
      .join("")
  const eyes: string[] = []
  const variants: EyeOpts[] = [
    { lobes: 3 },
    { lobes: 5, double: true },
    { lobes: 6, lash: 0, iris: 0.3 },
    { lobes: 4, lash: 4, lashLen: 0.45 },
  ]
  for (const [W, H] of [
    [16, 8],
    [24, 12],
    [32, 14],
    [48, 22],
    [64, 28],
    [96, 44],
    [160, 70],
  ])
    for (const o of variants)
      eyes.push(
        `<div class="cell">${eye(W, H, o, v.minPx).svg}<span>${W}×${H} f${o.lobes}${o.double ? " dbl" : ""}${o.lash === 0 ? " bare" : ""}</span></div>`,
      )
  $(".eyes").innerHTML = eyes.join("")
  const n = stagger(host)
  const ico = $(".fav svg")
  if (ico) {
    let link = document.querySelector<HTMLLinkElement>("link[rel=icon]")
    if (!link) {
      link = document.createElement("link")
      link.rel = "icon"
      document.head.append(link)
    }
    link.href = `data:image/svg+xml,${encodeURIComponent(
      ico.outerHTML
        .replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" style="color:#e2c77a" ')
        .replace(/stroke-width="[^"]*"/g, "")
        .replace("<svg", '<svg stroke="#e2c77a" fill="none" stroke-width="1.2"'),
    )}`
  }
  statsEl.textContent = `${names.length} names · ${n} paths`
}

page({ id: "icons", title: "gothic: fma favicons + eyes", links: LINKS, href: hrefFor })
section({
  id: "icons",
  title: "icons",
  spec: SPEC,
  render(v, host, ctx) {
    if (ctx.first) {
      ctx.extra.innerHTML = `<span class="stats"></span>`
      statsEl = ctx.extra.querySelector(".stats") as HTMLElement
    }
    host.classList.toggle("kit-draw", v.anim)
    if (!ctx.first && [...ctx.changed].every(k => k === "anim")) return
    render(v, host)
  },
})
algoSection(
  sealAlgo,
  [16, 24, 32, 48, 64, 96, 160],
  "seal as Algo: sizes row with LOD captions, data-z depth from band index",
)
Object.assign(window, { sealSvg, eye, foilRing })
