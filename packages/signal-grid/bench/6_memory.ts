// @comment-ok: what this file separates and why the separation is the whole measurement, with no
// runtime home outside the number it prints
//
// `bench/scroll.mjs` reports one heap number per cell and it rises with the row count, which does
// not say whose bytes they are. This splits the retained set: the consumer's row objects on one
// side, the kernel's own structures on the other, by running the same grid over a fat row and a
// slim one and subtracting.
//
// Forced collection on each side of every stage, and every result is parked on `globalThis` so V8
// cannot drop what the next stage is supposed to be measuring against.
import { Signal } from "@hafley66/signals"
import { grid, type ColumnDef, type GridState, type Viewport } from "../src/index.js"
import { axisOfEntries, flattenAxis } from "../src/1_axis.js"

const N = Number(process.argv[2] ?? 1_000_000)
const gc = (globalThis as { gc?: () => void }).gc
if (gc === undefined) throw new Error("run with --expose-gc")

const used = (): number => {
  gc(); gc()
  return process.memoryUsage().heapUsed
}

const step = (name: string, build: () => unknown): void => {
  const before = used()
  const held = build()
  const after = used()
  const bytes = after - before
  console.log(`${name.padEnd(34)} ${(bytes / 1024 ** 2).toFixed(1).padStart(8)} MB  ${(bytes / N).toFixed(0).padStart(5)} B/row`)
  void (held as { length?: number })?.length
  ;(globalThis as Record<string, unknown>)["_hold_" + name] = held
}

const hash = (n: number): number => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

interface Fat { id: string; at: number; name: string; size: number; pct: number; spark: number[] }
interface Slim { id: string; at: number; size: number }

const fatAt = (at: number): Fat => ({
  id: `r${at}`, at, name: `row ${at}`, size: Math.round(hash(at) * 1e5), pct: hash(at * 7),
  spark: Array.from({ length: 16 }, (_v, i) => hash(at * 97 + i)),
})
const slimAt = (at: number): Slim => ({ id: `r${at}`, at, size: Math.round(hash(at) * 1e5) })

const proxyOf = <T>(at: (i: number) => T): readonly T[] =>
  new Proxy([] as T[], {
    get: (t, k) => (k === "length" ? N : typeof k === "string" && /^\d+$/.test(k) ? (Number(k) < N ? at(Number(k)) : undefined) : Reflect.get(t, k)),
    has: (t, k) => (typeof k === "string" && /^\d+$/.test(k) ? Number(k) < N : Reflect.has(t, k)),
  })

const COLS = <T,>(): readonly ColumnDef<T>[] => [
  { id: "id", header: "Id", width: 120 },
  { id: "size", header: "Size", width: 120 },
]

const mount = <T extends { id: string }>(rows: readonly T[]) =>
  grid<T>({
    id: "mem", rows, columns: COLS<T>(), rowId: (row) => row.id,
    state: Signal<Partial<GridState>>({ virtualize: { vertical: true, horizontal: false } }),
    viewport: Signal<Viewport>({ top: 0, left: 0, width: 1600, height: 900 }),
    overscan: 4,
  })

console.log(`rows ${N.toLocaleString()}\n`)
step("1 slim rows, array only", () => Array.from({ length: N }, (_v, i) => slimAt(i)))
step("2 fat rows, array only", () => Array.from({ length: N }, (_v, i) => fatAt(i)))
step("3 key strings only", () => Array.from({ length: N }, (_v, i) => `r${i}`))
step("4 axisOf over slim", () => axisOfEntries(Array.from({ length: N }, (_v, i) => { const r = slimAt(i); return [r.id, r] as const })))
step("5 flatten over slim", () => { const a = axisOfEntries(Array.from({ length: N }, (_v, i) => { const r = slimAt(i); return [r.id, r] as const })); return flattenAxis(a, () => true) })
step("6 grid over slim proxy", () => { const g = mount(proxyOf(slimAt)); g.view.plan.$(); return g })
step("7 grid over fat proxy", () => { const g = mount(proxyOf(fatAt)); g.view.plan.$(); return g })
