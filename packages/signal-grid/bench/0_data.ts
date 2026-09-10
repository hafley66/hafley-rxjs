// Seeded generators shared by every file in `bench/`. Nothing reads Math.random, Date.now, the
// environment, or the filesystem, so identical arguments give identical rows across processes.

/** 6 columns, mixed types. `dept` and `tier` are the low-cardinality keys the group benchmarks use. */
export interface Row {
  readonly id: string
  readonly name: string
  readonly dept: string
  readonly tier: string
  readonly score: number
  readonly active: boolean
}

/** Same 6 columns plus the nested edge, the shape `axisOfTree` and TanStack `getSubRows` both read. */
export interface TreeRow extends Row {
  readonly children?: readonly TreeRow[]
}

const DEPTS = ["ops", "eng", "sales", "legal", "hr", "data", "risk", "cs"] as const
const TIERS = ["bronze", "silver", "gold", "platinum"] as const
const SYLLABLES = ["ka", "ro", "mi", "ta", "lu", "ne", "vo", "se", "dri", "pha"] as const

/** xorshift32, not an LCG: LCG low bits cycle with period 2 and 4 and `next() % 8` would degrade. */
const rng = (seed: number): (() => number) => {
  let word = seed | 0 || 0x9e3779b9
  return () => {
    word ^= word << 13
    word ^= word >>> 17
    word ^= word << 5
    return word >>> 0
  }
}

/** Non-commutative, so `flatRows(1000)` and `flatRows(10000)` do not share a seed. */
const seedOf = (...args: readonly number[]): number => {
  let acc = 0x811c9dc5
  for (const arg of args) {
    acc = (acc ^ (arg | 0)) >>> 0
    acc = Math.imul(acc, 0x01000193) >>> 0
  }
  return acc | 0
}

const pad = (value: number, width: number): string => String(value).padStart(width, "0")

const nameOf = (next: () => number): string => {
  const parts = 2 + (next() % 2)
  let out = ""
  for (let at = 0; at < parts; at++) out += SYLLABLES[next() % SYLLABLES.length]
  return out
}

/** `n` rows, ids `r000000` upward. Score is integer-quantized so the checksum survives a machine. */
export function flatRows(n: number): readonly Row[] {
  const count = Math.max(0, Math.trunc(n))
  const next = rng(seedOf(1, count))
  const out: Row[] = new Array<Row>(count)
  for (let at = 0; at < count; at++) {
    out[at] = {
      id: "r" + pad(at, 6),
      name: nameOf(next),
      dept: DEPTS[next() % DEPTS.length] as string,
      tier: TIERS[next() % TIERS.length] as string,
      score: (next() % 100000) / 100,
      active: (next() & 1) === 1,
    }
  }
  return out
}

/** `depth` levels, exactly `fanout` children per internal node, root count rounded up to `leaves`. */
export function treeRows(leaves: number, depth: number, fanout: number): readonly TreeRow[] {
  const levels = Math.max(1, Math.trunc(depth))
  const width = Math.max(1, Math.trunc(fanout))
  const want = Math.max(1, Math.trunc(leaves))
  const perRoot = width ** (levels - 1)
  const roots = Math.max(1, Math.ceil(want / perRoot))
  const next = rng(seedOf(2, want, levels, width))
  let issued = 0
  const build = (level: number): TreeRow => {
    const id = "n" + issued
    issued++
    const row: Row = {
      id,
      name: nameOf(next),
      dept: DEPTS[next() % DEPTS.length] as string,
      tier: TIERS[next() % TIERS.length] as string,
      score: (next() % 100000) / 100,
      active: (next() & 1) === 1,
    }
    if (level >= levels) return row
    const kids: TreeRow[] = new Array<TreeRow>(width)
    for (let at = 0; at < width; at++) kids[at] = build(level + 1)
    return { ...row, children: kids }
  }
  const out: TreeRow[] = new Array<TreeRow>(roots)
  for (let at = 0; at < roots; at++) out[at] = build(1)
  return out
}

/** Exact node and leaf counts for a `treeRows` call, without building it. */
export function treeShape(
  leaves: number,
  depth: number,
  fanout: number,
): { readonly roots: number; readonly nodes: number; readonly leaves: number } {
  const levels = Math.max(1, Math.trunc(depth))
  const width = Math.max(1, Math.trunc(fanout))
  const perRoot = width ** (levels - 1)
  const roots = Math.max(1, Math.ceil(Math.max(1, Math.trunc(leaves)) / perRoot))
  const perTree = width === 1 ? levels : (width ** levels - 1) / (width - 1)
  return { roots, nodes: roots * perTree, leaves: roots * perRoot }
}

/** Depth-first ids of a generated forest, in the order `axisOfTree` places them. */
export const treeIds = (items: readonly TreeRow[]): readonly string[] => {
  const out: string[] = []
  const stack: TreeRow[] = [...items].reverse()
  while (stack.length > 0) {
    const at = stack.pop()
    if (at === undefined) break
    out.push(at.id)
    const kids = at.children
    if (kids !== undefined) for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i] as TreeRow)
  }
  return out
}

/** FNV-1a over the printed fields. Two processes that disagree here are not running one benchmark. */
export function checksum(rows: readonly Row[]): number {
  let acc = 0x811c9dc5
  for (const row of rows) {
    const text =
      row.id + "|" + row.name + "|" + row.dept + "|" + row.tier + "|" + row.score + "|" + row.active
    for (let at = 0; at < text.length; at++) {
      acc = (acc ^ text.charCodeAt(at)) >>> 0
      acc = Math.imul(acc, 0x01000193) >>> 0
    }
  }
  return acc >>> 0
}

/** Recorded checksums. A generator edit that moves these invalidates every number in README.md. */
export const EXPECTED: Readonly<Record<string, number>> = {
  "flat/1000": 0xf41b6e57,
  "flat/10000": 0x461b92fe,
  "flat/100000": 0xc750ffbf,
  "flat/1000000": 0x8bce91d6,
}

let sink = 0

/** Consumed by every benchmark body, folded into a module word, so no result is dead. */
export const consume = (value: unknown): void => {
  if (typeof value === "number") sink = (sink ^ value) | 0
  else if (typeof value === "string") sink = (sink ^ value.length) | 0
  else if (typeof value === "boolean") sink = (sink ^ (value ? 1 : 2)) | 0
  else if (Array.isArray(value)) sink = (sink ^ value.length) | 0
  else if (value instanceof Map) sink = (sink ^ value.size) | 0
  else if (value === null || value === undefined) sink = (sink ^ 0x5a) | 0
  else sink = (sink ^ Object.keys(value as object).length) | 0
}

export const drain = (): number => sink
