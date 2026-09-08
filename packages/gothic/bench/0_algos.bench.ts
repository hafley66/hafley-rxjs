// bench every generator at notebook sizes; the gun reports whole-run CPU and peak RSS
import { afterAll, bench, describe } from "vitest"
import { defaultsOf } from "@hafley66/report-shell"
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
import { algoCtx, type Algo } from "../src/kit/2_algo.js"
import { sealSvg, eye } from "../src/lib/index.js"
import { border, plan } from "../src/lib/7_border.js"
import { slicePaths } from "../src/lib/6a_slicePaths.js"
import { variedSlicePose } from "../src/lib/7c_sliceVariation.js"
import { SLICE_DEFAULTS } from "../src/kit/slice/0_spec.js"

const SIZES = [96, 720]

const ALGOS: [string, Algo<any>][] = [
  ["seal", sealAlgo],
  ["apollonian", apollonian],
  ["foils", foils],
  ["lsys", lsys],
  ["cusping", cusping],
  ["hilbert", hilbert],
  ["fma2", fma2],
  ["guilloche", guilloche],
  ["architecture", architecture],
  ["fanvault", fanvault],
  ["buttresses", buttresses],
  ["spires", spires],
  ["wheel", wheel],
  ["cloister", cloister],
  ["astrolabe", astrolabe],
  ["ossuary", ossuary],
  ["lithic", lithic],
  ["envelope", envelope],
  ["braid", braid],
  ["conformal", conformal],
  ["cells", cells],
  ["resonance", resonance],
]

// the gun: whole-run CPU + peak RSS sampled at 50ms
const cpu0 = process.cpuUsage()
let peakRss = 0
const gun = setInterval(() => {
  peakRss = Math.max(peakRss, process.memoryUsage().rss)
}, 50)
const say = (line: string) => process.stdout.write(`${line}\n`)

for (const [name, algo] of ALGOS) {
  describe(`algo ${name}`, () => {
    const p = defaultsOf(algo.spec as never) as Record<string, unknown>
    for (const size of SIZES) {
      bench(`${size}px`, () => algo.run({ ...p }, algoCtx(p, size)), { time: 600, warmupIterations: 3 })
    }
  })
}

describe("icons page grids", () => {
  const NAMES = "github rxjs hn docs mail calendar grapht boop gothic tanstack vite playwright".split(" ")
  bench("sealSvg 14 names x 6 sizes + 96px captions", () => {
    for (const n of NAMES) {
      const sd = (NAMES.indexOf(n) * 2654435761) >>> 0
      for (const s of [16, 20, 24, 32, 48, 96]) sealSvg(s, sd, 2)
      sealSvg(96, sd, 2)
    }
  }, { time: 1000, warmupIterations: 1 })
  bench("eye grid 7x4", () => {
    for (const [W, H] of [[16, 8], [24, 12], [32, 14], [48, 22], [64, 28], [96, 44], [160, 70]])
      for (const o of [{ lobes: 3 }, { lobes: 5, double: true }, { lobes: 6, lash: 0, iris: 0.3 }, { lobes: 4, lash: 4, lashLen: 0.45 }])
        eye(W, H, o, 2)
  }, { time: 1000, warmupIterations: 1 })
})

describe("slice compile", () => {
  const p = defaultsOf(fma2.spec as never) as Record<string, unknown>
  const out = fma2.run(p, algoCtx(p, 720))
  const paths = out.paths.map(x => x.d)
  const cut = SLICE_DEFAULTS.cut
  bench(`slicePaths fma2 ${paths.length} paths cut=${cut}`, () => {
    slicePaths(paths, { seed: 1, cut })
  }, { time: 1500, warmupIterations: 1 })
  bench(`slicePaths fma2 cut=12 (hog)`, () => {
    slicePaths(paths, { seed: 1, cut: 12 })
  }, { time: 1500, warmupIterations: 1 })
  const tl = slicePaths(paths, { seed: 1, cut })
  say(`gun: fma2 cut=${cut} -> ${tl.strokes.length} strokes`)
  bench(`variedSlicePose ${tl.strokes.length} strokes x1 frame`, () => {
    for (const s of tl.strokes) variedSlicePose(s, 400, SLICE_DEFAULTS)
  }, { time: 1500, warmupIterations: 2 })
})

describe("border", () => {
  bench("border 960x540 all rails", () => {
    for (const rail of ["plain", "cusp", "ogee", "crenel", "dagger"])
      border(960, 540, plan(960, 540, 7, { seed: 7, rail, corner: "trefoil", cell: 48, depth: 10 }))
  }, { time: 800, warmupIterations: 2 })
})

afterAll(() => {
  clearInterval(gun)
  const c = process.cpuUsage(cpu0)
  say(`gun: total cpu ${Math.round((c.user + c.system) / 1e6)}s peak RSS ${Math.round(peakRss / 1e6)} MB`)
})
