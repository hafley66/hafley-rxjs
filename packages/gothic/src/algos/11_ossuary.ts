import { type AnySpec, type ValuesOf } from "@hafley66/report-shell"
import type { Algo, AlgoCtx, AlgoOut } from "../kit/2_algo.js"
import { MOTION } from "../kit/3_motion.js"
import { clamp, f } from "../lib/1_geom.js"
import { ink, plate } from "../lib/2b_plate.js"

export const SPEC = {
  bays: { kind: "range", hint: "overlapping vaults receding toward the apse", min: 3, max: 7, step: 1, default: 5 },
  breath: { kind: "range", hint: "separation of the toothed crown at full inhalation", min: 0, max: 1, step: 0.02, default: 0.85 },
  delay: { kind: "range", hint: "delay between one vault opening and the next", min: 0, max: 0.2, step: 0.01, default: 0.09 },
  lean: { kind: "range", hint: "lateral viewpoint shifts the overlapping silhouettes", min: -1, max: 1, step: 0.02, default: 0.08 },
  ...MOTION,
  // scaffold:inputs
} as const satisfies AnySpec
export type Params = ValuesOf<typeof SPEC>

export function respiration(time: number): number {
  const t = ((time % 1) + 1) % 1
  if (t < 0.44) return (1 - Math.cos(Math.PI * t / 0.44)) / 2
  if (t < 0.53) return 1
  if (t < 0.78) return (1 + Math.cos(Math.PI * (t - 0.53) / 0.25)) / 2
  return 0
}

export function rib(open: number): string {
  const gap = open * 66
  const lift = open * 24
  return `M-407 391L${f(-403 - open * 12)} 25C-415 -133 -238 -286 ${f(-gap - 10)} ${f(-385 + lift)}
    L${f(-gap + 12)} ${f(-368 + lift)}L${f(-gap - 5)} ${f(-351 + lift)}
    L${f(-gap + 16)} ${f(-334 + lift)}L${f(-gap - 2)} ${f(-317 + lift)}
    L${f(-gap + 12)} ${f(-301 + lift)}L${f(-gap - 14)} ${f(-282 + lift)}
    C-230 -192 -342 -107 -341 28L-350 388Z`
}

export function generate(p: Params, ctx: AlgoCtx): AlgoOut {
  const id = `ossuary-${ctx.size}`
  const bone = `url(#${id}-bone)`
  let body = `<defs><radialGradient id="${id}-light"><stop stop-color="#fff7d6" stop-opacity=".3"/><stop offset="1" stop-color="#e6e2c7" stop-opacity="0"/></radialGradient></defs>`
  body += ink("M-250 500L-8 40H8L250 500Z", "#191f24")
  body += `<ellipse cx="0" cy="10" rx="130" ry="235" fill="url(#${id}-light)"/>`
  body += ink("M-14 84V-77Q-14 -108 0 -139Q14 -108 14 -77V84Z", "#e9e7d3", "#899995", 2)
  body += ink("M0 -129V85M-13 -46H13M-13 18H13", "none", "#555e5c", 1.5)
  // Floor, catwalk edges and joint lines converge at the same distant point.
  for (const x of [-700, -420, -200, 200, 420, 700]) body += ink(`M${x} 500L${f(x * 0.018)} 67`, "none", "#343f40", 1)
  for (let i = 1; i < 13; i++) {
    const y = 69 + i * i * 3.5
    body += ink(`M${f(-(y - 60) * 1.5)} ${f(y)}H${f((y - 60) * 1.5)}`, "none", "#293539", 0.9)
  }
  body += ink("M-95 500L-6 68H6L95 500L72 500L4 82H-4L-72 500Z", "#687471", "#b1b2a0", 0.6)
  // Back-to-front filled members provide the occlusion; each bay has its own breath phase.
  for (let i = p.bays - 1; i >= 0; i--) {
    const scale = 1.27 * 0.66 ** i
    const x = p.lean * 145 * (1 - scale)
    const y = 66 * (1 - scale)
    const open = respiration(p.time - i * p.delay) * p.breath
    let bay = ""
    for (const side of [-1, 1]) {
      let half = ink(rib(open), "#060d12", "#060d12", 10, 'transform="translate(9 13)"')
      half += ink(rib(open), bone, "#c3bd9f", 1.2)
      half += ink(`M-380 382L${f(-379 - open * 10)} 25C-390 -115 -218 -259 ${f(-open * 66 - 12)} ${f(-361 + open * 24)}`, "none", "#e0d6b7", 2.4)
      half += ink(`M-363 382L-358 27C-367 -101 -202 -241 ${f(-open * 66 - 18)} ${f(-310 + open * 24)}`, "none", "#515951", 3)
      for (let j = 0; j < 5; j++) {
        const yy = 85 + j * 55
        half += ink(`M-404 ${yy}L-350 ${yy - 4}V${yy + 8}L-404 ${yy + 12}Z`, "#657067", "#bbb69b", 0.6)
      }
      half += ink("M-439 390L-327 386V406L-450 414Z", bone, "#a8ac95", 1)
      // Lancet recess beside the pier; its dark center stays legible against the rib face.
      half += ink("M-468 347V75Q-468 2 -439 -51Q-410 2 -410 75V347Z", "#0a1319", "#56645e", 2)
      half += ink("M-455 343V85Q-455 29 -439 -8Q-423 29 -423 85V343M-439 -8V346", "none", "#899480", 1.2)
      half += ink("M-449 -50L-439 -86L-429 -50L-439 -57Z", bone, "#a6ad92", 0.6)
      bay += `<g transform="scale(${side} 1)">${half}</g>`
    }
    body += `<g data-bay="${i}" data-open="${f(open)}" transform="translate(${f(x)} ${f(y)}) scale(${scale})" opacity="${f(clamp(1 - i * 0.1, 0.3, 1))}">${bay}</g>`
  }
  body += `<path d="M-500 -500H500V500H-500Z" style="fill:none;stroke:#050a10;stroke-width:24"/>`
  return { paths: [], raw: [plate(ctx.size, id, body)], caption: "Ribcage Cathedral", lod: [] }
}

export const ALGO: Algo<Params> = {
  name: "ossuary", spec: SPEC,
  presets: {
    "inhalation": { bays: 5, breath: 0.85, delay: 0.09, lean: 0.08, time: 0.44, run: false },
    "procession": { bays: 7, breath: 0.65, delay: 0.13, lean: -0.28, run: true },
    "still stone": { bays: 4, breath: 0, delay: 0, lean: 0, time: 0, run: false },
  },
  run: generate,
}
