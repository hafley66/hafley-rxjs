import type { Field } from "@hafley66/report-shell"
import { hash, mulberry32, type Rng } from "./0_rng.js"
import { gauss, expo1 } from "./4_dist.js"

export const DISTRIBUTIONS = ["normal", "uniform", "triangular", "arcsine", "exponential"] as const
export type Distribution = typeof DISTRIBUTIONS[number]
export type VariationPolicy = "none" | "global" | "cascade"
export type Variation = {
  scope: "input" | "stroke"; mode: "harmonic" | "drift" | "hold"
  distribution: Distribution; secondary: Distribution; mix: number; depth: number
  min: number; max: number; period: number; harmonics: number; phase: number; seed: number
}
export type StrokeMotionFrame = { time: number; fields: Record<string, Variation>; times?: Record<string, number> }
export const STROKE_PROPERTIES = new Set(["weight", "finalWeight", "ailen", "aiOpacity", "aiFade", "stretch", "os"])

// Target distributions are bounded to [0, 1]. Normal is clipped at three standard deviations.
export function distributionSample(kind: Distribution, rng: Rng): number {
  switch (kind) {
    case "normal": return Math.max(0, Math.min(1, 0.5 + gauss(rng) / 6))
    case "triangular": return (rng() + rng()) / 2
    case "arcsine": return (1 - Math.cos(Math.PI * rng())) / 2
    case "exponential": return Math.min(1, expo1(rng) / 4)
    default: return rng()
  }
}

export function defaultVariation(field: Field, base: unknown): Variation {
  const numeric = field.kind === "range" || field.kind === "number" || field.kind === "seed"
  const lo = numeric && field.kind !== "seed" ? field.min ?? 0 : 0
  const hi = numeric ? field.kind === "seed" ? 1000000 : field.max ?? 1 : 1
  const middle = typeof base === "number" ? base : 0.5
  return {
    scope: "input", mode: "harmonic", distribution: "normal", secondary: "arcsine", mix: 0.25, depth: 0.35,
    min: Math.max(lo, middle - (hi - lo) / 4), max: Math.min(hi, middle + (hi - lo) / 4),
    period: 4000, harmonics: 3, phase: 1, seed: 7,
  }
}

export function resolveVariation(field: Field, base: unknown, track: { enabled: boolean; variationPolicy?: VariationPolicy; variation?: Partial<Variation> }, global: Partial<Variation> = {}, section: Partial<Variation> = {}): Variation | undefined {
  const policy = track.variationPolicy ?? (track.variation ? "cascade" : "none")
  if (!track.enabled || policy === "none") return undefined
  return { ...defaultVariation(field, base), ...global, ...(policy === "cascade" ? { ...section, ...track.variation } : {}) }
}

// A random-access periodic signal: seeking, frame rate and observer order cannot consume its RNG.
// Each identity draws its own harmonic, phase and amplitude. A second oscillator varies the mixture.
export function sampleVariation(v: Variation, ms: number, identity: string | number = 0): number {
  const key = typeof identity === "string" ? hash(identity) : identity
  const rng = mulberry32(v.seed ^ key)
  const count = Math.max(1, Math.round(v.harmonics))
  const harmonic = 1 + Math.floor(rng() * count), phase = rng() * v.phase, envelopePhase = rng()
  const u = ((ms / Math.max(50, v.period)) % 1 + 1) % 1
  const envelope = (1 - Math.cos(Math.PI * 2 * (u + envelopePhase))) / 2
  const mix = Math.max(0, Math.min(1, v.mix + (envelope - 0.5) * v.depth))
  const knots = Math.max(2, harmonic * 2)
  const target = (index: number) => {
    const r = mulberry32(v.seed ^ key ^ Math.imul(index + 1, 0x9e3779b1))
    const blend = v.mode === "harmonic" ? mix : Math.max(0, Math.min(1, v.mix - Math.cos(Math.PI * 2 * (index / knots + envelopePhase)) * v.depth / 2))
    return distributionSample(v.distribution, r) * (1 - blend) + distributionSample(v.secondary, r) * blend
  }
  const cycles = v.mode === "harmonic" ? harmonic : knots
  const position = ((u * cycles + phase) % cycles + cycles) % cycles
  const index = Math.floor(position), fraction = position - index
  let value: number
  if (v.mode === "harmonic") {
    const amplitude = (0.25 + 0.75 * target(0)) * (1 - v.depth * (1 - envelope) * 0.75)
    value = 0.5 + Math.sin(Math.PI * 2 * position) * amplitude / 2
  } else if (v.mode === "hold") value = target(index)
  else {
    const t = fraction * fraction * (3 - 2 * fraction)
    value = target(index) * (1 - t) + target((index + 1) % knots) * t
  }
  return v.min + (v.max - v.min) * Math.max(0, Math.min(1, value))
}

export function variedField(field: Field, v: Variation, ms: number, identity: string | number): string | number | boolean {
  const value = sampleVariation(v, ms, identity)
  if (field.kind === "bool") return value >= 0.5
  if (field.kind === "select" || field.kind === "text") {
    const pool = field.pool ?? (field.kind === "select" ? field.options : [field.default])
    return pool[Math.min(pool.length - 1, Math.max(0, Math.floor(value * pool.length)))] ?? field.default
  }
  const lo = field.kind === "seed" ? 0 : field.min ?? -Number.MAX_VALUE
  const hi = field.kind === "seed" ? 2147483647 : field.max ?? Number.MAX_VALUE
  const step = field.kind === "seed" ? 1 : field.step ?? 1, origin = field.kind === "seed" ? 0 : field.min ?? 0
  return Math.max(lo, Math.min(hi, Number((origin + Math.round((value - origin) / step) * step).toFixed(8))))
}

export function rollDistribution(v: Variation, rng: Rng): Variation {
  return { ...v, distribution: DISTRIBUTIONS[Math.floor(rng() * DISTRIBUTIONS.length)],
    secondary: DISTRIBUTIONS[Math.floor(rng() * DISTRIBUTIONS.length)], mix: Math.round(rng() * 100) / 100,
    harmonics: 1 + Math.floor(rng() * 6), depth: Math.round(rng() * 75) / 100 }
}
