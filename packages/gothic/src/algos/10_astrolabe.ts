import { type AnySpec, type ValuesOf } from "@hafley66/report-shell"
import type { Algo, AlgoCtx, AlgoOut } from "../kit/2_algo.js"
import { MOTION } from "../kit/3_motion.js"
import { f, pl, polar, TAU, type Pt } from "../lib/1_geom.js"
import { ink, plate, roundel } from "../lib/2b_plate.js"

export const SPEC = {
  slits: { kind: "range", hint: "radial openings on the fixed mask", min: 36, max: 96, step: 2, default: 72 },
  lobes: { kind: "range", hint: "slit-count difference; controls the number of broad interference lobes", min: 2, max: 8, step: 1, default: 3 },
  curl: { kind: "range", hint: "curvature mismatch bends the interference lobes into a spiral", min: -1, max: 1, step: 0.02, default: 0.48 },
  aperture: { kind: "range", hint: "open fraction of each slit; narrow openings deepen the shadow pattern", min: 0.25, max: 0.7, step: 0.01, default: 0.48 },
  ...MOTION,
  // scaffold:inputs
} as const satisfies AnySpec
export type Params = ValuesOf<typeof SPEC>

export function slitMask(count: number, curl: number, aperture: number): string {
  let d = ""
  for (let i = 0; i < count; i++) {
    const points: Pt[] = []
    for (const edge of [0, 1]) {
      for (let j = 0; j <= 32; j++) {
        const r = 90 + (edge ? 32 - j : j) * 9.5
        const a = ((i + edge * (1 - aperture)) / count) * TAU + curl * Math.log(r / 394)
        points.push(polar(r, a))
      }
    }
    d += `${pl(points)}Z`
  }
  return d
}

export function generate(p: Params, ctx: AlgoCtx): AlgoOut {
  const id = `astrolabe-${ctx.size}`
  const gold = `url(#${id}-gold)`
  const rotor = p.slits - p.lobes
  const turn = p.time * 360 / rotor
  let body = roundel(455, "#050c10", "#5c6359", 1)
  for (let i = 0; i < 24; i++) {
    body += `<g transform="rotate(${i * 15})">${ink("M-21 -432Q-24 -461 0 -486Q24 -461 21 -432L0 -445Z", "#18272a", gold, 1.5)}${ink("M0 -446V-474M-12 -453L0 -467L12 -453", "none", "#9c956d", 0.8)}</g>`
  }
  body += roundel(436, "#222c29", gold, 3) + roundel(425, "#0a1519", "#797453", 1)
  for (let i = 0; i < 120; i++) {
    const major = i % 10 === 0
    body += `<g transform="rotate(${i * 3})">${ink(`M0 -${major ? 411 : 419}V-425`, "none", major ? "#ded1a0" : "#807c5f", major ? 1.8 : 0.8)}${major ? `<text y="-402" text-anchor="middle" style="fill:#c0b589;font:9px Georgia;letter-spacing:1px">${["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"][i / 10]}</text>` : ""}</g>`
  }
  body += roundel(396, gold, "#efdfa9", 1)
  body += ink(slitMask(p.slits, 0.1, p.aperture), "#0b1518", "none", 0, 'opacity=".86" data-layer="stator"')
  body += `<g transform="rotate(${f(turn)})" data-layer="rotor">${ink(slitMask(rotor, 0.1 + p.curl * 0.18, p.aperture), "#081115", "none", 0, 'opacity=".92"')}</g>`
  body += roundel(397, "none", "#d7c691", 2) + roundel(389, "none", "#93855d", 0.8)
  body += roundel(94, "#101e23", gold, 5) + roundel(84, "#091317", "#ad9d70", 1)
  for (let i = 0; i < 12; i++) {
    body += `<g transform="rotate(${i * 30})">${ink("M0 -77Q18 -53 0 -20Q-18 -53 0 -77Z", "#243633", gold, 0.9)}</g>`
  }
  body += roundel(29, "#0a1218", gold, 2)
  body += ink("M0 -20L4 -4L20 0L4 4L0 20L-4 4L-20 0L-4 -4Z", "#e5d2a0")
  for (const a of [45, 135, 225, 315]) {
    body += `<g transform="rotate(${a}) translate(0 -430)">${roundel(3, "#d8c491", "#0a1316", 1)}${ink("M-2 0H2", "none", "#3a4138", 1)}</g>`
  }
  return { paths: [], raw: [plate(ctx.size, id, body)], caption: "Astrolabe Monstrance", lod: [] }
}

export const ALGO: Algo<Params> = {
  name: "astrolabe", spec: SPEC,
  presets: {
    "vespers": { slits: 72, lobes: 3, curl: 0.48, aperture: 0.48 },
    "eclipse": { slits: 60, lobes: 2, curl: 0, aperture: 0.35 },
    "seraph": { slits: 84, lobes: 6, curl: -0.8, aperture: 0.58 },
  },
  run: generate,
}
