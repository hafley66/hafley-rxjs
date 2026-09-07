import { type Rng, clamp } from "../index.js"

/* Rest anatomy in eye units: x in [-1,1] (-1 nasal, +1 temporal), y in half-heights.
   lid(x) = base line from nasal corner (-1,0) to temporal corner (1,-tilt) plus bulge h*(1-|u|^p), apex at peak. */
export type Curve = { h: number; p: number; peak: number }
export type Shape = { ratio: number; up: Curve; lo: Curve; tilt: number; iris: number }
export const SHAPES: Record<string, Shape> = {
  human: {
    ratio: 0.42,
    up: { h: 0.62, p: 1.6, peak: -0.12 },
    lo: { h: 0.4, p: 1.5, peak: 0.08 },
    tilt: 0.1,
    iris: 0.58,
  },
  shoujo: { ratio: 0.5, up: { h: 0.8, p: 1.7, peak: 0.05 }, lo: { h: 0.45, p: 1.5, peak: 0 }, tilt: 0.02, iris: 0.62 },
  shonen: {
    ratio: 0.38,
    up: { h: 0.55, p: 1.15, peak: -0.25 },
    lo: { h: 0.3, p: 1.1, peak: 0.1 },
    tilt: 0.16,
    iris: 0.5,
  },
  tsurime: {
    ratio: 0.42,
    up: { h: 0.6, p: 1.4, peak: -0.15 },
    lo: { h: 0.35, p: 1.3, peak: 0.15 },
    tilt: 0.28,
    iris: 0.55,
  },
  tareme: {
    ratio: 0.45,
    up: { h: 0.62, p: 1.6, peak: 0.1 },
    lo: { h: 0.4, p: 1.4, peak: -0.1 },
    tilt: -0.22,
    iris: 0.58,
  },
  jitome: { ratio: 0.34, up: { h: 0.3, p: 4, peak: 0 }, lo: { h: 0.4, p: 1.4, peak: 0 }, tilt: 0.04, iris: 0.62 },
  cat: { ratio: 0.4, up: { h: 0.6, p: 1, peak: -0.1 }, lo: { h: 0.4, p: 1, peak: 0.1 }, tilt: 0.14, iris: 0.48 },
  sanpaku: { ratio: 0.46, up: { h: 0.55, p: 1.5, peak: 0 }, lo: { h: 0.55, p: 1.3, peak: 0 }, tilt: 0, iris: 0.34 },
  gigantic: { ratio: 0.58, up: { h: 1, p: 2.2, peak: 0 }, lo: { h: 0.75, p: 1.9, peak: 0 }, tilt: 0.02, iris: 0.7 },
}
export function randomShape(rng: Rng): Shape {
  const r = (a: number, b: number) => a + rng() * (b - a)
  return {
    ratio: r(0.32, 0.6),
    up: { h: r(0.3, 1), p: r(1, 3.5), peak: r(-0.3, 0.2) },
    lo: { h: r(0.25, 0.75), p: r(1, 2.2), peak: r(-0.2, 0.2) },
    tilt: r(-0.25, 0.3),
    iris: r(0.34, 0.7),
  }
}
export const bulge = (x: number, c: Curve): number => {
  const u = (x - c.peak) / (x < c.peak ? 1 + c.peak : 1 - c.peak)
  return 1 - Math.abs(clamp(u, -1, 1)) ** c.p
}
