// static prerender: every Algo, preset and size to standalone .svg files (inline CSS, no JS)
// run: pnpm render:static   ->  out/static/<name>[.<preset>].<size>.svg + gallery.html
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { defaultsOf } from "@hafley66/report-shell"
import { describe, expect, it } from "vitest"
import { sealAlgo } from "../src/algos/0_seal.js"
import { apollonian, cusping, foils, hilbert, lsys } from "../src/algos/1_fractal.js"
import { fma2 } from "../src/algos/2_fma.js"
import { ALGO as guilloche } from "../src/algos/3_guilloche.js"
import { ALGO as architecture } from "../src/algos/4_architecture.js"
import { ALGO as fanvault } from "../src/algos/5_fanvault.js"
import { ALGO as buttresses } from "../src/algos/6_buttresses.js"
import { ALGO as spires } from "../src/algos/7_spires.js"
import { ALGO as wheel } from "../src/algos/8_wheel.js"
import { ALGO as cloister } from "../src/algos/9_cloister.js"
import { ALGO as astrolabe } from "../src/algos/10_astrolabe.js"
import { ALGO as ossuary } from "../src/algos/11_ossuary.js"
import { ALGO as lithic } from "../src/algos/12_lithic.js"
import { ALGO as envelope } from "../src/algos/13_envelope.js"
import { ALGO as braid } from "../src/algos/14_braid.js"
import { ALGO as conformal } from "../src/algos/15_conformal.js"
import { ALGO as cells } from "../src/algos/16_cells.js"
import { ALGO as resonance } from "../src/algos/17_resonance.js"
import { algoCtx, type Algo, type AlgoOut } from "../src/kit/2_algo.js"
import { eye, sealSvg } from "../src/lib/index.js"
import { border, corners, plan, rails } from "../src/lib/7_border.js"

const OUT = resolve(import.meta.dirname, "../out/static")
const SIZES = [128, 384, 720]
const ALGOS: Record<string, Algo<any>> = {
  seal: sealAlgo, apollonian, foils, lsys, cusping, hilbert, fma2, guilloche,
  architecture, fanvault, buttresses, spires, wheel, cloister,
  astrolabe, ossuary, lithic, envelope, braid, conformal, cells, resonance,
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

const STYLE = `:root{color:#d9dbe3}
path,polyline,circle{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:var(--w,1)}
.dark{fill:currentColor;stroke:none}
text{fill:currentColor;font-family:serif}
[data-z]{--z:0;stroke-opacity:calc(1 - .8*var(--z)*var(--kit-zdepth,0));stroke-width:calc(var(--w,1)*(1 - .6*var(--z)*var(--kit-zdepth,0)))}`

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")

export function staticSvg(out: AlgoOut, size: number): string {
  const half = size / 2
  const paths = out.paths
    .map(p => `<path d="${p.d}"${p.cls ? ` class="${p.cls}"` : ""}${p.z === undefined ? "" : ` data-z="${p.z}" style="--z:${p.z}"`}/>`)
    .join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-half} ${-half} ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(out.caption)}">
<style>${STYLE}</style>
<title>${esc(out.caption)}</title>
${paths}${out.raw?.length ? `<g>${out.raw.join("")}</g>` : ""}
</svg>
`
}

function borderSvg(rail: string, corner: string): string {
  const w = 960, h = 540
  const p = plan(w, h, 7, { seed: 7, rail, corner, cell: 24, depth: 12 })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<style>:root{color:oklch(84% 0.1 85)}path{fill:none;stroke:currentColor;stroke-width:1.2}</style>
<path d="${border(w, h, p)}"/>
</svg>
`
}

// the lib's svg strings carry no xmlns or style; standalone files need both
const FRAGMENT_STYLE = `<style>:root{color:oklch(84% .1 85)}path,circle,polyline{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round}</style>`
function standalone(svg: string): string {
  return svg.replace(/^<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"').replace(/^(<svg[^>]*>)/, `$1${FRAGMENT_STYLE}`)
}

describe.skipIf(!process.env.RENDER_STATIC)("static prerender", () => {
  it("writes every algo, preset and size to out/static", () => {
    mkdirSync(OUT, { recursive: true })
    const files: string[] = []
    let n = 0
    for (const [name, algo] of Object.entries(ALGOS)) {
      for (const [label, patch] of Object.entries({ "": {}, ...algo.presets })) {
        const values = { ...defaultsOf(algo.spec as never), ...patch } as Record<string, unknown>
        for (const size of SIZES) {
          const file = `${name}${label ? `.${slug(label)}` : ""}.${size}.svg`
          const svg = staticSvg(algo.run({ ...values }, algoCtx(values, size)), size)
          if (svg.length > 2e6) continue // skip pathological sizes; the gallery stays loadable
          writeFileSync(resolve(OUT, file), svg)
          files.push(file)
          n++
        }
      }
    }
    for (const rail of Object.keys(rails)) {
      for (const corner of Object.keys(corners)) {
        const file = `border.${slug(rail)}-${slug(corner)}.svg`
        writeFileSync(resolve(OUT, file), borderSvg(rail, corner))
        files.push(file)
        n++
      }
    }
    const names = "github rxjs hn docs mail calendar grapht boop gothic tanstack vite playwright".split(" ")
    names.forEach((word, i) => {
      for (const s of [16, 32, 96]) {
        const file = `seal.${slug(word)}.${s}.svg`
        writeFileSync(resolve(OUT, file), standalone(sealSvg(s, (i * 2654435761) >>> 0, 2).svg))
        files.push(file)
        n++
      }
    })
    const variants = [{ lobes: 3 }, { lobes: 5, double: true }, { lobes: 6, lash: 0, iris: 0.3 }, { lobes: 4, lash: 4, lashLen: 0.45 }]
    variants.forEach((o, i) => {
      const file = `eye.${i}.svg`
      writeFileSync(resolve(OUT, file), standalone(eye(160, 70, o, 2).svg))
      files.push(file)
      n++
    })
    writeFileSync(resolve(OUT, "gallery.html"), `<!doctype html><meta charset="utf-8"><title>gothic static</title>
<style>body{background:#0f1117;color:#d9dbe3;font:13px system-ui;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;padding:16px}figure{margin:0}img{max-width:100%;height:auto}figcaption{color:#8b8f9c;font-size:10px}</style>
${files.map(f => `<figure><img src="${f}" alt="${f}" loading="lazy"><figcaption>${f}</figcaption></figure>`).join("\n")}
`)
    expect(n).toBeGreaterThan(200)
    expect(files.every(f => f.endsWith(".svg"))).toBe(true)
  })
})
