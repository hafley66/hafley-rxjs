import { blue, green, pink, red, violet, white } from "@thi.ng/colored-noise"
import { type IRandom, Smush32, exponential, normal } from "@thi.ng/random"
import type { Rng } from "./0_rng.js"

// thi.ng-backed distributions behind the notebooks' Rng = () => number convention
export const rand = (seed: number): IRandom => new Smush32(seed >>> 0)
// wrap a plain Rng as an IRandom so thi.ng distributions can consume mulberry32 streams (seed compatibility of saved states)
export function fromRng(rng: Rng): IRandom {
  const r = new Smush32(1)
  r.float = (max = 1) => rng() * max
  r.int = () => Math.floor(rng() * 4294967296)
  return r
}
export const gauss = (rng: Rng): number => normal(fromRng(rng), 0, 1)()
export const expo1 = (rng: Rng): number => exponential(fromRng(rng), 1)()
// Marsaglia-Tsang gamma; thi.ng/random has no gamma
export function gammaV(rng: Rng, k: number): number {
  if (k < 1) return gammaV(rng, k + 1) * rng() ** (1 / k)
  const d = k - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x: number
    let v: number
    do {
      x = gauss(rng)
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = rng()
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}
export const NOISE = { white, pink, red, green, blue, violet } as const
export type NoiseKind = keyof typeof NOISE
// n samples of a coloured noise stream; bins = number of internal accumulators, scale = amplitude
export function colored(kind: NoiseKind, n: number, rng: Rng, bins = 8, scale = 1): number[] {
  const g = NOISE[kind]({ bins, scale, rnd: fromRng(rng) })
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(g.next().value ?? 0)
  return out
}
