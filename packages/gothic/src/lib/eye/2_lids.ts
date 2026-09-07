import { mix, type Pt } from "../index.js"
import { bulge, type Shape } from "./0_shape.js"
import { type Au, activate, type Frame, frame } from "./1_muscles.js"

/* The upper lid does the travel: at full closure it lands on the lower lid, which rises 10% of the gap (1..2 mm on a real eye).
   rest = the smile line at 30% of the lower bulge, where the upper lid hangs with zero levator tone. */
export function lidPts(
  sh: Shape,
  W: number,
  H: number,
  au: Au,
  N: number,
  lag: number,
  pop: number,
): { up: Pt[]; lo: Pt[]; fr: Frame } {
  const fr = frame(au)
  const up: Pt[] = []
  const lo: Pt[] = []
  const hh = H / 2
  const w = (W / 2) * fr.wScale
  const upC = { ...sh.up, peak: sh.up.peak + fr.apexShift }
  for (let i = 0; i <= N; i++) {
    const x = -1 + (2 * i) / N
    const a = activate(au, x, lag, pop)
    const base = (-(sh.tilt + fr.canthusLift) * hh * (x + 1)) / 2
    const bLo = sh.lo.h * hh * bulge(x, sh.lo)
    const rest = base + 0.3 * bLo
    const upOpen = rest - (sh.up.h * hh * bulge(x, upC) + 0.3 * bLo) * a.up
    const loOpen = mix(rest, base + bLo, a.lo)
    const g = Math.max(0, loOpen - upOpen) / 1.1
    up.push([x * w, upOpen + a.c * g])
    lo.push([x * w, loOpen - a.c * 0.1 * g])
  }
  return { up, lo, fr }
}
