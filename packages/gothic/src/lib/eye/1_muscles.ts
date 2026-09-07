import { clamp, mix } from "../index.js"

/* FACS action units 0..1 -> lid activations. AU5 levator raises the upper lid; AU45 is the blink closure drive;
   AU7 tightens both lids; AU6 lifts the lower lid + lateral canthus; AU2 frontalis lifts; AU4 drops the medial lid; AU5L shows sclera below. */
export const AU: Record<string, string> = {
  AU5: "levator",
  AU45: "blink",
  AU7: "tighten",
  AU6: "squint",
  AU2: "brow raise",
  AU4: "brow lower",
  AU5L: "lower retract",
}
/* Scheduler-only fields: AU45n nasal closure (trails AU45 while closing), AU45b Bell's drive (trails while opening),
   AU63/AU64 up/down gaze. AU45 < 0 is the settle above rest at the end of opening. */
export type Au = {
  AU5: number
  AU7: number
  AU6: number
  AU2: number
  AU4: number
  AU5L: number
  AU45?: number
  AU45n?: number
  AU45b?: number
  AU63?: number
  AU64?: number
} & Record<string, number | undefined>
export const EXPR: Record<string, Au> = {
  neutral: { AU5: 0.78, AU7: 0, AU6: 0, AU2: 0, AU4: 0, AU5L: 0 },
  alert: { AU5: 0.92, AU7: 0, AU6: 0, AU2: 0.35, AU4: 0, AU5L: 0.1 },
  surprise: { AU5: 1, AU7: 0, AU6: 0, AU2: 1, AU4: 0, AU5L: 0.7 },
  squint: { AU5: 0.7, AU7: 0.45, AU6: 0.85, AU2: 0, AU4: 0.2, AU5L: 0 },
  smile: { AU5: 0.75, AU7: 0.1, AU6: 0.6, AU2: 0.1, AU4: 0, AU5L: 0 },
  sleepy: { AU5: 0.22, AU7: 0.05, AU6: 0, AU2: 0, AU4: 0, AU5L: 0 },
  angry: { AU5: 0.82, AU7: 0.5, AU6: 0.2, AU2: 0, AU4: 0.9, AU5L: 0.1 },
  fear: { AU5: 1, AU7: 0.3, AU6: 0, AU2: 0.8, AU4: 0.4, AU5L: 0.5 },
  glare: { AU5: 0.6, AU7: 0.7, AU6: 0.3, AU2: 0, AU4: 0.6, AU5L: 0 },
}
export type Activation = { aUp: number; aLo: number; c: number; up: number; lo: number }
/* up/lo = open-lid tone (fraction of the rest bulge), c = closure at x, aUp = up after closure and settle.
   lag scales the nasal delay the scheduler put in AU45n; pop is the settle gain, capped at 3% of the aperture. */
export function activate(au: Au, x: number, lag: number, pop: number): Activation {
  const cT = au.AU45 ?? 0
  const cN = mix(cT, au.AU45n ?? cT, clamp(lag))
  // lid margin tilt: closure reaches the temporal side first, the nasal side lagMs later; a straight line between
  const c = clamp(mix(cT, cN, (1 - x) / 2))
  const over = Math.max(0, -cT) * Math.min(pop, 0.03)
  const medial = (1 - x) / 2
  const up63 = au.AU63 ?? 0
  const dn64 = au.AU64 ?? 0
  // lid-globe coupling: upgaze raises the upper lid, downgaze lowers both lids with the globe
  const lev =
    0.35 +
    0.8 * au.AU5 +
    0.15 * au.AU2 -
    0.3 * au.AU4 * medial -
    0.15 * au.AU6 -
    0.25 * au.AU7 +
    0.12 * up63 -
    0.14 * dn64
  const up = (clamp(lev, 0, 1.3) / 1.3) * (1 + over)
  const lo = clamp(1 - 0.55 * au.AU6 - 0.2 * au.AU7 + 0.45 * au.AU5L + 0.12 * dn64, 0, 1.4)
  return { aUp: up * (1 - c), aLo: lo, c, up, lo }
}
// global deformations: width, canthus lift, apex nasal drift, Bell's roll (globe rolls up under a closing lid)
export function frame(au: Au) {
  const sq = au.AU6
  const bl = Math.max(0, au.AU45 ?? 0)
  return {
    wScale: 1 - 0.06 * sq - 0.03 * au.AU7,
    canthusLift: 0.06 * sq + 0.03 * au.AU2,
    apexShift: -0.04 * bl - 0.03 * au.AU7,
    bell: -0.35 * Math.max(0, au.AU45b ?? bl),
    browY: -0.35 * au.AU2 + 0.18 * au.AU4,
    browPinch: 0.25 * au.AU4,
  }
}
export type Frame = ReturnType<typeof frame>
