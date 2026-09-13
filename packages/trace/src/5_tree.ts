// @comment-ok: the two renders are the reason the model has both a parent and a birth time, and
// each paragraph names which field it reads
//
// `parent` is the edge and `born` is the order, so the same list of `Ident` draws two ways:
//
//   tree()  reads `parent`, indents a child under its parent, siblings sorted by `born`
//   gantt() reads `born`, one row per ident on a shared time axis, earliest at the top
//
// A pid is reused by the operating system, so `pid` alone is not a key. `pid` plus `born` is, which
// is what `key()` prints and what a child's `parent` has to match. A child matches its parent by
// `parentKey()` first (the handed key), then by `parent` pid alone for a node child with no handoff.
// Both renders also take a `Span`, so a row can carry a death and a bar can stop where it died.
import type { Death, Edge, Ident, Span } from "./0_types.js"
import { key, parentKey } from "./1_ident.js"

export { key } from "./1_ident.js"

const GLYPH: Readonly<Record<Ident["runtime"], string>> = {
  nodejs: "node", bun: "bun", deno: "deno", browser: "tab", worker: "wrk", unknown: "?",
}

interface Row {
  readonly ident: Ident
  readonly died: Death | undefined
  /** An edge that pins this child under the parent it had. */
  readonly edge: Edge | undefined
}

function rows(input: readonly (Ident | Span)[], edges: readonly Edge[] | undefined): Row[] {
  const pinned = new Map<string, Edge>()
  for (const e of edges ?? []) if (e.until !== undefined) pinned.set(e.child, e)
  return input.map((item) => {
    const isSpan = "ident" in item
    const id = isSpan ? (item as Span).ident : (item as Ident)
    return { ident: id, died: isSpan ? (item as Span).died : undefined, edge: pinned.get(key(id)) }
  })
}

interface Node {
  readonly row: Row
  readonly kids: Node[]
}

function forest(all: readonly Row[]): Node[] {
  const byKey = new Map<string, Node>()
  for (const row of all) byKey.set(key(row.ident), { row, kids: [] })
  const byPid = new Map<string, Node>()
  for (const node of byKey.values()) if (!byPid.has(node.row.ident.pid)) byPid.set(node.row.ident.pid, node)
  const roots: Node[] = []
  for (const node of byKey.values()) {
    // An ended edge wins: the child is drawn under the parent it had, not wherever its own parent
    // field points now. Otherwise prefer the handed key, then a bare-pid match.
    const edgeParent = node.row.edge?.until !== undefined ? node.row.edge.parent : undefined
    const byKeyParent = edgeParent ?? parentKey(node.row.ident)
    const up = byKeyParent === undefined ? undefined : byKey.get(byKeyParent)
    const upByPid = up ?? (node.row.ident.parent !== undefined ? byPid.get(node.row.ident.parent) : undefined)
    if (upByPid === undefined || upByPid === node) roots.push(node)
    else upByPid.kids.push(node)
  }
  const order = (list: Node[]): void => {
    list.sort((a, b) => a.row.ident.born - b.row.ident.born)
    for (const node of list) order(node.kids)
  }
  order(roots)
  return roots
}

function label(row: Row): string {
  const id = row.ident
  const base = `${GLYPH[id.runtime]} ${id.service} ${key(id)}`
  const bits: string[] = []
  if (row.died !== undefined) bits.push(row.died.how === "timeout" ? `?@${row.died.at}` : `x@${row.died.at}`)
  const until = row.edge?.until
  if (until !== undefined) bits.push(`until +${until - id.born}ms`)
  return bits.length === 0 ? base : `${base} ${bits.join(" ")}`
}

/** Who started whom, indented, siblings in the order they were born. */
export function tree(all: readonly (Ident | Span)[], edges?: readonly Edge[]): string {
  const lines: string[] = []
  const walk = (node: Node, pad: string, last: boolean, root: boolean): void => {
    const stem = root ? "" : `${pad}${last ? "`-- " : "|-- "}`
    lines.push(`${stem}${label(node.row)}`)
    const next = root ? "" : `${pad}${last ? "    " : "|   "}`
    for (const [i, kid] of node.kids.entries()) walk(kid, next, i === node.kids.length - 1, false)
  }
  for (const root of forest(rows(all, edges))) walk(root, "", true, true)
  return lines.join("\n")
}

export interface GanttOptions {
  /** Columns of bar, not counting the label gutter. */
  readonly width?: number
  /** Wall clock the axis ends at. Defaults to now. */
  readonly until?: number
}

/** Every ident on one time axis, earliest first, so "who appeared before whom" is the picture. A
 * span's bar runs `born` to `died.at`, ending in `x` (reported) or `?` (timeout). */
export function gantt(all: readonly (Ident | Span)[], options: GanttOptions = {}): string {
  if (all.length === 0) return ""
  const width = options.width ?? 56
  const end = options.until ?? Date.now()
  const list = rows(all, undefined).sort((a, b) => a.ident.born - b.ident.born)
  const start = list[0]?.ident.born ?? end
  const span = Math.max(1, end - start)
  const gutter = Math.max(...list.map((it) => `${GLYPH[it.ident.runtime]} ${it.ident.service}`.length))
  const col = (t: number): number => Math.round(((t - start) / span) * (width - 1))
  const lines = list.map((row) => {
    const at = col(row.ident.born)
    const label = `${GLYPH[row.ident.runtime]} ${row.ident.service}`.padEnd(gutter)
    const died = row.died
    if (died === undefined) {
      const bar = " ".repeat(at) + "#" + "=".repeat(Math.max(0, width - at - 1))
      return `${label} |${bar}| ${Math.round(row.ident.born - start)}ms ${key(row.ident)}`
    }
    const stop = col(died.at)
    const marker = died.how === "timeout" ? "?" : "x"
    const bar = " ".repeat(at) + "#" + "=".repeat(Math.max(0, stop - at - 1)) + marker + " ".repeat(Math.max(0, width - stop - 1))
    return `${label} |${bar}| ${Math.round(row.ident.born - start)}ms ${key(row.ident)} ${marker}@${died.at}`
  })
  const ruler = `${" ".repeat(gutter)} +${"-".repeat(width)}+ 0 to ${Math.round(span)}ms`
  return [ruler, ...lines].join("\n")
}
