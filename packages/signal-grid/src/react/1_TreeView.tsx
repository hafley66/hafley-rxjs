import { createElement, useEffect, useId, useLayoutEffect, useRef, type ReactElement } from "react"
import { fsTreeSpec, treeGrid, type FsTreeRow, type TreeSpec } from "../22_tree.js"
import type { Grid } from "../8_grid.js"
import { GridView } from "./index.js"

export interface TreeViewProps<TRow> {
  readonly rows: readonly TRow[]
  readonly spec: TreeSpec<TRow>
  readonly className?: string
}

interface Held<TRow> {
  readonly grid: Grid<TRow>
  rows: readonly TRow[]
  active: boolean
}

/** The spec is read once, at mount. A new `rows` array is written into the grid, so open folders stay open. */
export function TreeView<TRow>({ rows, spec, className }: TreeViewProps<TRow>): ReactElement {
  const id = useId().replaceAll(":", "")
  const held = useRef<Held<TRow> | null>(null)
  held.current ??= { grid: treeGrid(`sg-tree-${id}`, rows, spec), rows, active: false }
  const current = held.current

  useLayoutEffect(() => {
    if (current.rows === rows) return
    current.rows = rows
    current.grid.rows.$(rows)
  }, [current, rows])

  // StrictMode unmounts and remounts once; the grid closes only when no remount follows.
  useEffect(() => {
    current.active = true
    return () => {
      current.active = false
      queueMicrotask(() => {
        if (!current.active) current.grid.close()
      })
    }
  }, [current])

  return createElement(GridView<TRow>, {
    grid: current.grid,
    className: className === undefined ? "sg-tree" : `sg-tree ${className}`,
  })
}

export interface FsTreeViewProps {
  readonly rows: readonly FsTreeRow[]
  readonly className?: string
}

/** Files and folders: `data-kind` dir/file, `data-ext` per file for the tree.css icon colours. */
export function FsTreeView({ rows, className }: FsTreeViewProps): ReactElement {
  return createElement(TreeView<FsTreeRow>, { rows, spec: fsTreeSpec, ...(className === undefined ? {} : { className }) })
}
