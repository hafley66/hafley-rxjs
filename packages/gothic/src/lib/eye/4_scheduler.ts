import { clamp, ease, expo, mix, mulberry32, pick } from "../index.js"
import { type Au, EXPR } from "./1_muscles.js"

/* Timing table (ms unless noted). Ranges in the comments are the seeded jitter applied per event. */
export type Timing = {
  close: number // full-amplitude closing, jittered 0.8..1.2x (80..120)
  open: number // full-amplitude opening, jittered 0.75..1.25x (150..250)
  settle: number // sub-3% settle above rest after opening
  lagMs: number // temporal -> nasal closure delay across the lid margin
  bellLag: number // globe trails the lid by this on reopening
  ibiMean: number // interblink onset-to-onset mean (right-skewed: floor + exponential)
  ibiFloor: number
  doubleP: number // fraction of blinks followed by a second one
  doubleGap: number // gap before the second blink (0.4..1x)
  drowsyP: number // fraction of blinks that become a slow half-close when AU5 tone is low
  coupleP: number // fraction of blinks that ride a gaze shift
  saccade: number // saccade duration, jittered 0.67..1.33x (30..60)
  glanceMean: number // free glance interval mean
  wake: number // levator wake-up ramp, jittered 0.8..1.2x (920..1380)
}
export const TIMING: Timing = {
  close: 100,
  open: 200,
  settle: 120,
  lagMs: 15,
  bellLag: 40,
  ibiMean: 4000,
  ibiFloor: 1500,
  doubleP: 0.15,
  doubleGap: 150,
  drowsyP: 0.06,
  coupleP: 0.3,
  saccade: 45,
  glanceMean: 1700,
  wake: 1150,
}
// per-AU expression ease: [in ms, out ms, onset delay]; brows move slower than lids, no two AUs share a clock
const AU_IO: Record<string, [number, number, number]> = {
  AU5: [420, 700, 0],
  AU7: [360, 620, 40],
  AU6: [520, 820, 90],
  AU5L: [460, 740, 60],
  AU4: [760, 1150, 140],
  AU2: [880, 1300, 200],
}
const T_IN = 1080
const T_OUT = 1500
const S = (u: number) => u * u * (3 - 2 * u)
// closing: bell-shaped velocity peaking near 35% of the phase (orbicularis burst, then passive landing)
const closeP = (u: number) => S(clamp(u) ** 0.8)
// opening: short acceleration, peak velocity near 10%, then a long deceleration into rest
const openP = (u: number) => S(clamp(u) ** 0.6)
const bump = (u: number, c: number, w: number) => Math.exp(-(((u - c) / w) ** 2))

type Blink = { t0: number; amp: number; close: number; open: number; kind: string; slow: boolean }
type Glance = { t: number; x: number; y: number; dur: number }
type Expr = { t0: number; t1: number; hold: number; name: string }
export type Pose = { au: Au; what: string; gaze: { x: number; y: number }; dil: number; tt: number }
export type Scheduler = { T: number; timing: Timing; wakeT: number; at(ms: number, base: Au): Pose }

export function scheduler(seed: number, tempo: number, auto: boolean, opts: Partial<Timing> = {}): Scheduler {
  const tm: Timing = { ...TIMING, ...opts }
  const rng = mulberry32(seed)
  const jit = (v: number, k: number) => v * (1 - k + 2 * k * rng())
  const wakeT = jit(tm.wake, 0.2)
  const blinks: Blink[] = []
  const glances: Glance[] = [
    { t: 0, x: 0.3 * (rng() - 0.5), y: 0.2 + 0.15 * rng(), dur: 1 },
    { t: wakeT * (0.67 + 0.2 * rng()), x: 0, y: 0, dur: jit(tm.saccade, 0.33) },
  ]
  const exprs: Expr[] = []
  const target = (): [number, number] => [(rng() * 2 - 1) * 0.8, (rng() * 2 - 1) * 0.35]
  const CYCLE = 120000
  let t = wakeT + 400
  while (t < CYCLE) {
    // interblink: floor + exponential tail (right-skewed, mean ibiMean at rest)
    t += tm.ibiFloor + expo(rng, Math.max(1, tm.ibiMean - tm.ibiFloor))
    const drowsy = rng() < tm.drowsyP
    const amp = drowsy ? 0.55 : 1
    const close = drowsy ? 600 + rng() * 300 : jit(tm.close, 0.2)
    const open = drowsy ? 500 + rng() * 300 : jit(tm.open, 0.25)
    blinks.push({ t0: t, amp, close, open, kind: drowsy ? "drowsy" : "blink", slow: drowsy })
    if (rng() < tm.coupleP) {
      const [x, y] = target()
      glances.push({ t: t + 10, x, y, dur: jit(tm.saccade, 0.33) })
    }
    t += close + open
    if (!drowsy && rng() < tm.doubleP) {
      // double: a smaller second blink; main sequence makes it slower per unit distance
      const a2 = 0.6 + rng() * 0.3
      const gap = tm.doubleGap * (0.4 + 0.6 * rng())
      const c2 = jit(tm.close, 0.2) * Math.sqrt(a2)
      const o2 = jit(tm.open, 0.25) * Math.sqrt(a2)
      blinks.push({ t0: t + gap, amp: a2, close: c2, open: o2, kind: "double", slow: false })
      t += gap + c2 + o2
    }
  }
  let tg = wakeT
  while (tg < CYCLE) {
    tg += 800 + expo(rng, Math.max(1, tm.glanceMean - 800))
    const [x, y] = target()
    glances.push({ t: tg, x, y, dur: jit(tm.saccade, 0.33) })
  }
  glances.sort((a, b) => a.t - b.t)
  for (let i = glances.length - 1; i > 1; i--) if (glances[i].t - glances[i - 1].t < 250) glances.splice(i, 1)
  let te = wakeT + 2500
  while (te < CYCLE) {
    const name = pick(
      rng,
      Object.keys(EXPR).filter(n => n !== "neutral"),
    )
    const hold = 1200 + expo(rng, 1500)
    exprs.push({ t0: te, t1: te + T_IN + hold + T_OUT, hold, name })
    te += T_IN + hold + T_OUT + 4000 + expo(rng, 5000)
  }
  const last = blinks[blinks.length - 1]
  const T = last.t0 + last.close + last.open + tm.settle + 500

  const exprAt = (tt: number, base: Au): { au: Au; name: string } => {
    const au: Au = { ...base }
    if (!auto) return { au, name: "neutral" }
    for (const e of exprs) {
      if (tt < e.t0 || tt >= e.t1) continue
      for (const key in AU_IO) {
        const [ti, to, d] = AU_IO[key]
        const w =
          tt < e.t0 + T_IN
            ? ease.io(clamp((tt - e.t0 - d) / ti))
            : tt < e.t0 + T_IN + e.hold
              ? 1
              : 1 - ease.io(clamp((tt - e.t0 - T_IN - e.hold - d) / to))
        au[key] = mix(base[key] ?? 0, EXPR[e.name][key] ?? 0, w)
      }
      return { au, name: e.name }
    }
    return { au, name: "neutral" }
  }
  // closure drive at tt; a drowsy event becomes a plain blink unless AU5 tone was low at its onset
  const drive = (tt: number, base: Au): { c: number; what: string } => {
    for (const b of blinks) {
      const u = tt - b.t0
      if (u < 0) break
      const sleepy = b.slow && exprAt(b.t0, base).au.AU5 < 0.5
      const amp = b.slow && !sleepy ? 1 : b.amp
      const close = b.slow && !sleepy ? tm.close : b.close
      const open = b.slow && !sleepy ? tm.open : b.open
      if (u < close) return { c: amp * closeP(u / close), what: b.kind }
      if (u < close + open) return { c: amp * (1 - openP((u - close) / open)), what: "reopen" }
      if (u < close + open + tm.settle && !sleepy)
        return { c: -amp * Math.sin((Math.PI * (u - close - open)) / tm.settle), what: "reopen" }
    }
    return { c: 0, what: "open" }
  }
  // wake: S-ramp of levator tone with two sags the lid catches up from
  const wakeTone = (ms: number) => {
    const u = clamp(ms / wakeT)
    if (u >= 1) return 1
    return clamp(S(u) * (1 - 0.1 * bump(u, 0.45, 0.07) - 0.07 * bump(u, 0.72, 0.06)))
  }
  const gazeAt = (tt: number) => {
    let gi = 0
    while (gi + 1 < glances.length && glances[gi + 1].t <= tt) gi++
    const g0 = glances[gi]
    const gp = glances[gi - 1] ?? g0
    // saccade: symmetric bell velocity over 30..60 ms, then hold with slow micro-drift
    const k = S(clamp((tt - g0.t) / g0.dur))
    return {
      x: mix(gp.x, g0.x, k) + 0.015 * (Math.sin(tt / 430) + 0.6 * Math.sin(tt / 1130 + 2)),
      y: mix(gp.y, g0.y, k) + 0.012 * (Math.sin(tt / 610 + 1) + 0.6 * Math.sin(tt / 970)),
    }
  }
  return {
    T,
    timing: tm,
    wakeT,
    at(ms, base) {
      const ma = ms * tempo
      const tt = ma % T
      const w = wakeTone(ma)
      const ex = exprAt(tt, base)
      const b = drive(tt, base)
      const cT = w < 1 ? Math.max(b.c, 1 - w) : b.c
      const cN = cT > 0 ? Math.min(Math.max(drive(tt - tm.lagMs, base).c, 1 - wakeTone(ma - tm.lagMs)), cT) : cT
      const cB = Math.max(cT, drive(tt - tm.bellLag, base).c, 1 - wakeTone(ma - tm.bellLag), 0)
      const gaze = gazeAt(tt)
      const au: Au = {
        ...ex.au,
        AU5: ex.au.AU5 * w,
        AU45: cT,
        AU45n: cN,
        AU45b: cB,
        AU63: Math.max(0, -gaze.y),
        AU64: Math.max(0, gaze.y),
      }
      const what = w < 1 ? "wake" : b.what === "open" ? ex.name : b.what
      // pupil: wide at wake, constricts over the ramp; slow hippus after
      const dil = mix(1.32, 1, S(clamp(ma / wakeT))) * (0.96 + 0.06 * Math.sin(tt / 1900) + 0.03 * Math.sin(tt / 610))
      return { au, what, gaze, dil, tt }
    },
  }
}

/* A full-amplitude blink layered over the schedule by the caller; u = ms since the trigger. null once it is over.
   Same close/open profiles and the same nasal and Bell's lags as a scheduled blink. */
export function blinkAt(tm: Timing, u: number): { AU45: number; AU45n: number; AU45b: number } | null {
  if (u < 0 || u >= tm.close + tm.open) return null
  const at = (x: number) => (x < 0 ? 0 : x < tm.close ? closeP(x / tm.close) : 1 - openP((x - tm.close) / tm.open))
  const c = at(u)
  return { AU45: c, AU45n: Math.min(c, at(u - tm.lagMs)), AU45b: Math.max(c, at(u - tm.bellLag)) }
}
