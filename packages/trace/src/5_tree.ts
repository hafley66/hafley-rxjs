// @comment-ok: the two renders are the reason the model has both a parent and a birth time, and
// each paragraph names which field it reads
//
// `parent` is the edge and `born` is the order, so the same list of `Ident` draws two ways:
//
//   tree()  reads `parent`, indents a child under its parent, siblings sorted by `born`
//   gantt() reads `born`, one row per ident on a shared time axis, earliest at the top
//
// A pid is reused by the operating system, so `pid` alone is not a key. `pid` plus `born` is, which
// is what `key()` prints and what a child's `parent` has to match.
import type { Ident } from "./0_types.js"

/** The unique one. An operating system reuses a pid; it cannot reuse a pid at the same instant. */
export const key = (id: Ident): string => `${id.pid}@${Math.round(id.born)}`

const GLYPH: Readonly<Record<Ident["runtime"], string>> = {
  nodejs: "node", bun: "bun", deno: "deno", browser: "tab", worker: "wrk", unknown: "?",
}

interface Node {
  readonly id: Ident
  readonly kids: Node[]
}

function forest(all: readonly Ident[]): Node[] {
  const byPid = new Map<string, Node>()
  for (const id of all) byPid.set(id.pid, { id, kids: [] })
  const roots: Node[] = []
  for (const node of byPid.values()) {
    const up = node.id.parent === undefined ? undefined : byPid.get(node.id.parent)
    if (up === undefined) roots.push(node)
    else up.kids.push(node)
  }
  const order = (list: Node[]): void => {
    list.sort((a, b) => a.id.born - b.id.born)
    for (const node of list) order(node.kids)
  }
  order(roots)
  return roots
}

/** Who started whom, indented, siblings in the order they were born. */
export function tree(all: readonly Ident[]): string {
  const lines: string[] = []
  const walk = (node: Node, pad: string, last: boolean, root: boolean): void => {
    const stem = root ? "" : `${pad}${last ? "`-- " : "|-- "}`
    lines.push(`${stem}${GLYPH[node.id.runtime]} ${node.id.service} ${key(node.id)}`)
    const next = root ? "" : `${pad}${last ? "    " : "|   "}`
    for (const [i, kid] of node.kids.entries()) walk(kid, next, i === node.kids.length - 1, false)
  }
  for (const root of forest(all)) walk(root, "", true, true)
  return lines.join("\n")
}

export interface GanttOptions {
  /** Columns of bar, not counting the label gutter. */
  readonly width?: number
  /** Wall clock the axis ends at. Defaults to now. */
  readonly until?: number
}

/** Every ident on one time axis, earliest first, so "who appeared before whom" is the picture. */
export function gantt(all: readonly Ident[], options: GanttOptions = {}): string {
  if (all.length === 0) return ""
  const width = options.width ?? 56
  const end = options.until ?? Date.now()
  const rows = [...all].sort((a, b) => a.born - b.born)
  const start = rows[0]?.born ?? end
  const span = Math.max(1, end - start)
  const gutter = Math.max(...rows.map((it) => `${GLYPH[it.runtime]} ${it.service}`.length))
  const lines = rows.map((id) => {
    const at = Math.round(((id.born - start) / span) * (width - 1))
    const label = `${GLYPH[id.runtime]} ${id.service}`.padEnd(gutter)
    const bar = " ".repeat(at) + "#" + "=".repeat(Math.max(0, width - at - 1))
    return `${label} |${bar}| ${Math.round(id.born - start)}ms ${key(id)}`
  })
  const ruler = `${" ".repeat(gutter)} +${"-".repeat(width)}+ 0 to ${Math.round(span)}ms`
  return [ruler, ...lines].join("\n")
}
