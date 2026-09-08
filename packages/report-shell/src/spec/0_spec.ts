import * as z from "zod"

export type Rng = () => number
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export const freshSeed = (): number => Math.floor(Math.random() * 2 ** 31)

// hint = the first tooltip line; describe() appends the derived facts
type Common = { label?: string; hint?: string; group?: string; static?: boolean; shuffle?: boolean }
// roll narrows the shuffle window inside min..max; p is the true-probability for bools; pool weights select options by repetition
export type RangeField = Common & {
  kind: "range"
  min: number
  max: number
  step?: number
  default: number
  roll?: readonly [number, number]
}
export type NumberField = Common & {
  kind: "number"
  min?: number
  max?: number
  step?: number
  default: number
  roll?: readonly [number, number]
}
export type SeedField = Common & { kind: "seed"; default: number }
export type SelectField<O extends string = string> = Common & {
  kind: "select"
  options: readonly O[]
  default: NoInfer<O>
  pool?: readonly O[]
}
export type BoolField = Common & { kind: "bool"; default: boolean; p?: number }
export type TextField = Common & { kind: "text"; default: string; size?: number; pool?: readonly string[] }
export type Field = RangeField | NumberField | SeedField | SelectField | BoolField | TextField

export type FieldOf<V> = [V] extends [boolean]
  ? BoolField
  : [V] extends [number]
    ? RangeField | NumberField | SeedField
    : [V] extends [string]
      ? SelectField<V & string> | TextField
      : never
export type Spec<P extends object = Record<string, unknown>> = { [K in keyof P]: FieldOf<P[K]> }
export type AnySpec = Record<string, Field>

export type FieldValue<F extends Field> = F extends { kind: "bool" }
  ? boolean
  : F extends { kind: "select"; options: readonly (infer O)[] }
    ? O
    : F extends { kind: "text" }
      ? string
      : number
export type ValuesOf<S extends AnySpec> = { [K in keyof S]: FieldValue<S[K]> }
export type Presets<V> = Record<string, Partial<V>>

export const isStatic = (fd: Field): boolean => fd.static === true || fd.shuffle === false
export const defaultsOf = <S extends AnySpec>(spec: S): ValuesOf<S> =>
  Object.fromEntries(Object.entries(spec).map(([k, fd]) => [k, fd.default])) as ValuesOf<S>

const boolSchema = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform(v => v === true || v === "true" || v === "1")

export function fieldSchema(fd: Field): z.ZodType {
  switch (fd.kind) {
    case "bool":
      return boolSchema
    case "select":
      return z.enum(fd.options as unknown as [string, ...string[]])
    case "text":
      return z.string()
    default:
      return z.coerce.number().refine(Number.isFinite)
  }
}

export const schemaOf = <S extends AnySpec>(spec: S): z.ZodObject =>
  z.object(Object.fromEntries(Object.entries(spec).map(([k, fd]) => [k, fieldSchema(fd)])))

// per-key safeParse: an unknown or invalid key falls back to the field default
export function parseValues<S extends AnySpec>(spec: S, raw: Record<string, unknown>): ValuesOf<S> {
  const out: Record<string, unknown> = {}
  for (const [k, fd] of Object.entries(spec)) {
    const r = k in raw && raw[k] !== undefined ? fieldSchema(fd).safeParse(raw[k]) : null
    out[k] = r?.success ? r.data : fd.default
  }
  return out as ValuesOf<S>
}

const decimals = (step: number): number => {
  const s = String(step)
  const i = s.indexOf(".")
  return i < 0 ? 0 : s.length - i - 1
}
export function snap(lo: number, hi: number, step: number, u: number): number {
  const v = lo + Math.round((u * (hi - lo)) / step) * step
  return Number(Math.min(hi, Math.max(lo, v)).toFixed(decimals(step)))
}

export function rollField(fd: Field, rng: Rng): unknown {
  switch (fd.kind) {
    case "seed":
      return Math.floor(rng() * 1e6)
    case "range":
    case "number": {
      const lo = fd.roll?.[0] ?? fd.min
      const hi = fd.roll?.[1] ?? fd.max
      if (lo === undefined || hi === undefined) return fd.default
      return snap(lo, hi, fd.step ?? 1, rng())
    }
    case "select": {
      const pool = fd.pool ?? fd.options
      return pool[Math.floor(rng() * pool.length)]
    }
    case "bool":
      return rng() < (fd.p ?? 0.5)
    case "text":
      return fd.pool?.length ? fd.pool[Math.floor(rng() * fd.pool.length)] : fd.default
  }
}

// every shuffleable field rolls from the one rng in spec order; static and pinned fields keep their current value
export function shuffle<S extends AnySpec>(
  spec: S,
  values: ValuesOf<S>,
  rng: Rng,
  pinned: ReadonlySet<string> = new Set(),
): ValuesOf<S> {
  const out: Record<string, unknown> = { ...values }
  for (const [k, fd] of Object.entries(spec)) if (!isStatic(fd) && !pinned.has(k)) out[k] = rollField(fd, rng)
  return out as ValuesOf<S>
}
export const PIN_SPEC = { pin: { kind: "text", default: "" } } as const satisfies AnySpec
export type PinValues = ValuesOf<typeof PIN_SPEC>
export const pinSet = (v: PinValues): Set<string> => new Set(v.pin ? v.pin.split(",") : [])
export const pinText = (s: ReadonlySet<string>): string => [...s].sort().join(",")

export const fmt = (v: unknown): string => (typeof v === "number" ? String(Number(v.toFixed(3))) : String(v))
export const readout = <S extends AnySpec>(spec: S, values: ValuesOf<S>): string => {
  const diff = Object.keys(spec).filter(k => values[k] !== spec[k].default)
  return diff.length ? diff.map(k => `${k}=${fmt(values[k])}`).join(" ") : "defaults"
}

// tooltip text for a bar control: the hint, then key, kind and window, default, and what shuffle does to it
export function describe(key: string, fd: Field): string {
  const facts: string[] = []
  if (fd.kind === "range" || fd.kind === "number") {
    const win = fd.min !== undefined && fd.max !== undefined ? ` ${fd.min}..${fd.max}` : ""
    facts.push(`${fd.kind}${win}${fd.step !== undefined ? ` step ${fd.step}` : ""}`)
  } else if (fd.kind === "select") facts.push(`one of ${fd.options.join(" | ")}`)
  else facts.push(fd.kind)
  facts.push(`default ${fmt(fd.default)}`)
  if (isStatic(fd)) facts.push("static: shuffle keeps it, no pin")
  else if (fd.kind === "seed") facts.push("shuffle: fresh seed")
  else if (fd.kind === "text") facts.push(fd.pool?.length ? `shuffle draws from ${fd.pool.length} text choices` : "shuffle: resets to default")
  else if ((fd.kind === "range" || fd.kind === "number") && fd.roll)
    facts.push(`shuffle rolls ${fd.roll[0]}..${fd.roll[1]}`)
  else if (fd.kind === "bool") facts.push(`shuffle: true with p ${fd.p ?? 0.5}`)
  else if (fd.kind === "select" && fd.pool) facts.push(`shuffle draws from ${[...new Set(fd.pool)].join(" | ")}`)
  else facts.push("shuffle rolls the whole window")
  return [fd.hint, `${key}: ${facts.join(" · ")}`].filter(Boolean).join("\n")
}
