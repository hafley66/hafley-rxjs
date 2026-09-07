import { createGrid, type GridState } from "@hafley66/grid"
import { type TreeColumn, TreeTable, treeColumnDefs } from "@hafley66/grid/react"
import type { Signal } from "@hafley66/signals"
import { useEffect, useMemo, useRef } from "react"
import { z } from "zod"
import { formatBytes } from "../lib/bytes"
import { formatAge } from "../lib/time"

export type FsRow = {
  id: string
  path: string
  name: string
  kind: "dir" | "file"
  size?: number
  mtime?: number
  children?: FsRow[]
  // false = a dir whose children come from getChildren on first expand
  loaded?: boolean
}

export type FsColumnsOptions = { age?: boolean; size?: boolean; now?: number }

const rank = (r: FsRow) => (r.kind === "dir" ? 0 : 1)

// path (tree, toggles), size (files only), age (from mtime); dirs sort before files in every column
export function fsColumns(o: FsColumnsOptions = {}): TreeColumn<FsRow>[] {
  const cols: TreeColumn<FsRow>[] = [
    {
      id: "path",
      header: "name",
      tree: true,
      toggleExpand: true,
      cell: r => (
        <span className="fs-name" data-kind={r.kind}>
          <span className="fs-glyph">{r.kind === "dir" ? "▸" : "·"}</span>
          {r.name}
        </span>
      ),
      sortValue: r => `${rank(r)}:${r.name.toLowerCase()}`,
    },
  ]
  if (o.size !== false)
    cols.push({
      id: "size",
      header: "size",
      cell: r => (r.kind === "file" ? formatBytes(r.size) : ""),
      cellClass: () => "fs-num",
      sortValue: r => (r.kind === "dir" ? -1 : (r.size ?? 0)),
      size: 80,
    })
  if (o.age !== false)
    cols.push({
      id: "age",
      header: "age",
      cell: r => (r.mtime ? formatAge(r.mtime, o.now) : ""),
      cellClass: () => "fs-num",
      sortValue: r => (r.kind === "dir" ? Number.MAX_SAFE_INTEGER : (r.mtime ?? 0)),
      size: 90,
    })
  return cols
}

export type FsTreeProps = {
  rows: Signal<FsRow[]>
  columns?: TreeColumn<FsRow>[]
  getChildren?: (row: FsRow) => Promise<FsRow[]>
  onOpen?: (row: FsRow) => void
  maxHeight?: number
  density?: "compact" | "standard" | "cozy"
}

const patch = (rows: FsRow[], id: string, next: Partial<FsRow>): FsRow[] =>
  rows.map(r => (r.id === id ? { ...r, ...next } : r.children ? { ...r, children: patch(r.children, id, next) } : r))

const find = (rows: FsRow[], id: string): FsRow | undefined => {
  for (const r of rows) {
    if (r.id === id) return r
    const hit = r.children && find(r.children, id)
    if (hit) return hit
  }
  return undefined
}

const expandedIds = (rows: FsRow[], expanded: GridState["expanded"]): string[] => {
  if (expanded === true) {
    const out: string[] = []
    const walk = (rs: FsRow[]) => {
      for (const r of rs) {
        if (r.kind === "dir") out.push(r.id)
        if (r.children) walk(r.children)
      }
    }
    walk(rows)
    return out
  }
  return Object.keys(expanded).filter(k => expanded[k])
}

// grid TreeTable preset for a file tree: dirs expand (lazily through getChildren when loaded === false),
// files open through onOpen; the caller owns the rows signal and gets children patched into it
export function FsTree({ rows, columns, getChildren, onOpen, maxHeight = 600, density = "compact" }: FsTreeProps) {
  const cols = useMemo(() => columns ?? fsColumns(), [columns])
  const grid = useMemo(
    () =>
      createGrid<FsRow>({
        schema: z.custom<FsRow>(),
        rows,
        getRowId: r => r.id,
        getSubRows: r => r.children,
        getRowCanExpand: r => r.kind === "dir",
        mode: "client",
        columnDefs: treeColumnDefs(cols),
      }),
    [rows, cols],
  )
  const pending = useRef(new Set<string>())
  useEffect(() => {
    if (!getChildren) return
    const sub = grid.state.$.subscribe(s => {
      for (const id of expandedIds(rows.$(), s.expanded)) {
        const row = find(rows.$(), id)
        if (!row || row.kind !== "dir" || row.loaded !== false || pending.current.has(id)) continue
        pending.current.add(id)
        getChildren(row).then(children => {
          rows.$(patch(rows.$(), id, { children, loaded: true }))
        })
      }
    })
    return () => sub.unsubscribe()
  }, [grid, rows, getChildren])
  return (
    <TreeTable
      grid={grid}
      density={density}
      indentGuides
      maxHeight={maxHeight}
      showFooter={false}
      rowClassName={r => `fs-${r.kind}`}
      onRowClick={r => r.kind === "file" && onOpen?.(r)}
    />
  )
}
