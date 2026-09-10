// A filesystem-shaped relation, deterministic from one seed, so a screenshot taken today and one
// taken next month show the same bytes in the same rows.
//
// 50,000 leaf files hang under 636 directories four levels deep, which makes a path of five
// levels counting the file itself. Directory size and mtime aggregate from the children, so a
// sort by size on a collapsed tree still orders the roots the way a file manager would.

export interface FsRow {
  readonly id: string
  readonly name: string
  readonly size: number
  /** Epoch milliseconds. `type: "date"` in the column def compares it through `dateOf`. */
  readonly modified: number
  readonly kind: string
  readonly owner: string
  readonly depth: number
  readonly children?: readonly FsRow[]
}

export const SEED = 20260910
export const LEAF_TARGET = 50_000

/** Directories per level. Index 0 is the root count, so the deepest directory sits at depth 3. */
const FANOUT: readonly number[] = [6, 5, 4, 4]

export const VOLUMES = ["workspace", "archive", "media", "build", "vendor", "scratch"] as const

export const OWNERS = [
  "ada", "grace", "linus", "barbara", "ken", "margaret", "alan", "radia", "edsger", "katherine",
] as const

export const KINDS = [
  "folder", "typescript", "stylesheet", "markdown", "json", "image", "binary", "log", "shader",
] as const

const DIR_WORDS = [
  "src", "lib", "core", "kernel", "render", "adapters", "fixtures", "vendor", "assets", "docs",
  "scripts", "tools", "cache", "drafts", "exports", "shaders", "layouts", "themes", "audio", "raw",
] as const

const FILE_STEMS = [
  "index", "grid", "axis", "slice", "paths", "epics", "theme", "report", "notes", "atlas",
  "sprite", "capture", "session", "bundle", "sample", "trace", "digest", "manifest", "patch", "seed",
] as const

/** Extension to `kind`. Weighted by repetition so typescript dominates the way a repo does. */
const EXTENSIONS: readonly (readonly [string, string])[] = [
  ["ts", "typescript"], ["ts", "typescript"], ["tsx", "typescript"],
  ["css", "stylesheet"], ["md", "markdown"], ["json", "json"],
  ["png", "image"], ["jpg", "image"], ["wasm", "binary"], ["log", "log"], ["wgsl", "shader"],
]

/** One epoch for the whole relation, so "modified" is stable whatever the clock says. */
const NOW = Date.UTC(2026, 8, 10)
const DAY = 86_400_000

/** mulberry32. One multiply and a few shifts, and the same seed always walks the same sequence. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function at<T>(pool: readonly T[], index: number): T {
  const value = pool[((index % pool.length) + pool.length) % pool.length]
  if (value === undefined) throw new Error("empty pool")
  return value
}

interface Walk {
  readonly random: () => number
  /** Which leaf directory is being filled, so the file budget lands exactly on LEAF_TARGET. */
  leafDir: number
  leaves: number
}

const LEAF_DIRS = (FANOUT[0] ?? 1) * (FANOUT[1] ?? 1) * (FANOUT[2] ?? 1) * (FANOUT[3] ?? 1)
const FILES_PER_DIR = Math.floor(LEAF_TARGET / LEAF_DIRS)
const DIRS_WITH_ONE_MORE = LEAF_TARGET - FILES_PER_DIR * LEAF_DIRS

function makeFile(parent: string, index: number, walk: Walk): FsRow {
  const r = walk.random()
  const stem = at(FILE_STEMS, Math.floor(r * FILE_STEMS.length))
  const ext = at(EXTENSIONS, Math.floor(walk.random() * EXTENSIONS.length))
  const name = `${stem}-${index}.${ext[0]}`
  // Log-ish spread: most files are small, a few are very large.
  const magnitude = walk.random()
  const size = Math.round(64 * Math.pow(2, magnitude * 18))
  return {
    id: `${parent}/${name}`,
    name,
    size,
    modified: NOW - Math.round(walk.random() * 900) * DAY - Math.round(walk.random() * DAY),
    kind: ext[1],
    owner: at(OWNERS, Math.floor(walk.random() * OWNERS.length)),
    depth: 4,
  }
}

function makeDir(parent: string, name: string, depth: number, walk: Walk): FsRow {
  const id = `${parent}/${name}`
  const subCount = FANOUT[depth + 1] ?? 0
  const children: FsRow[] = []
  if (subCount > 0) {
    for (let i = 0; i < subCount; i++) {
      const word = at(DIR_WORDS, Math.floor(walk.random() * DIR_WORDS.length))
      children.push(makeDir(id, `${word}-${i}`, depth + 1, walk))
    }
  } else {
    const extra = walk.leafDir < DIRS_WITH_ONE_MORE ? 1 : 0
    const count = FILES_PER_DIR + extra
    walk.leafDir += 1
    for (let i = 0; i < count; i++) {
      children.push(makeFile(id, i, walk))
      walk.leaves += 1
    }
  }
  let size = 0
  let modified = 0
  for (const child of children) {
    size += child.size
    if (child.modified > modified) modified = child.modified
  }
  return {
    id,
    name,
    size,
    modified,
    kind: "folder",
    owner: at(OWNERS, Math.floor(walk.random() * OWNERS.length)),
    depth,
    children,
  }
}

let cachedTree: readonly FsRow[] | null = null
let cachedLeaves: readonly FsRow[] | null = null

/** Milliseconds spent building each relation, filled on the first call and read by the readout. */
export const timing = { treeMs: 0, leavesMs: 0 }

/** The forest. Built once per page, memoized, and identical for a given seed. */
export function tree(): readonly FsRow[] {
  if (cachedTree !== null) return cachedTree
  const started = performance.now()
  const walk: Walk = { random: rng(SEED), leafDir: 0, leaves: 0 }
  const roots: FsRow[] = []
  const count = FANOUT[0] ?? 0
  for (let i = 0; i < count; i++) roots.push(makeDir("", at(VOLUMES, i), 0, walk))
  cachedTree = roots
  timing.treeMs = performance.now() - started
  return roots
}

/** The same 50,000 files with no edges: the flat relation grouping and paging read best. */
export function leaves(): readonly FsRow[] {
  if (cachedLeaves !== null) return cachedLeaves
  const started = performance.now()
  const out: FsRow[] = []
  const stack: FsRow[] = [...tree()].reverse()
  while (stack.length > 0) {
    const row = stack.pop()
    if (row === undefined) break
    const kids = row.children
    if (kids === undefined) {
      out.push(row)
      continue
    }
    for (let i = kids.length - 1; i >= 0; i--) {
      const kid = kids[i]
      if (kid !== undefined) stack.push(kid)
    }
  }
  cachedLeaves = out
  timing.leavesMs = performance.now() - started
  return out
}

/** Every directory id. What "expand all" writes, and cheap: 636 keys, never 50,000. */
export function directoryIds(): readonly string[] {
  const out: string[] = []
  const stack: FsRow[] = [...tree()]
  while (stack.length > 0) {
    const row = stack.pop()
    if (row === undefined) break
    const kids = row.children
    if (kids === undefined) continue
    out.push(row.id)
    for (const kid of kids) stack.push(kid)
  }
  return out
}

/**
 * The ids down the leftmost path, root first. Deterministic, so a preset can name three levels of
 * one branch without a DOM or a running grid to read them off.
 */
export function leftmostPath(levels: number): readonly string[] {
  const out: string[] = []
  let row = tree()[0]
  for (let i = 0; i < levels && row !== undefined; i++) {
    out.push(row.id)
    row = row.children?.[0]
  }
  return out
}

const UNITS = ["B", "KB", "MB", "GB", "TB"] as const

export function formatSize(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return ""
  let scaled = n
  let unit = 0
  while (scaled >= 1024 && unit < UNITS.length - 1) {
    scaled /= 1024
    unit += 1
  }
  const digits = scaled < 10 && unit > 0 ? 1 : 0
  return `${scaled.toFixed(digits)} ${at(UNITS, unit)}`
}

export function formatDate(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return ""
  return new Date(n).toISOString().slice(0, 10)
}
