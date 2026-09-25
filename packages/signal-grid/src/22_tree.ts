// Tree mode as one component: rows from any tree, an icon + label + note entry per row, folders that
// open from their label as well as the glyph. The file preset is one `TreeSpec`; stylesheet: tree.css.
import { filter, map } from "rxjs"
import type { ColumnDef, GridAction, GridIntent, RowId } from "./0_types.js"
import { defaultEpics, type GridEpic } from "./7_epics.js"
import { grid, type Grid } from "./8_grid.js"

/** What one row shows. `kind` and `ext` land as `data-kind` / `data-ext`, the stylesheet's hooks. */
export interface TreeEntry {
  readonly label: string
  readonly kind?: string
  readonly ext?: string
  readonly note?: string
}

/** How to read a tree of any shape. */
export interface TreeSpec<TRow> {
  readonly id: (row: TRow) => RowId
  /** Present (even empty) makes a branch; undefined makes a leaf. */
  readonly children: (row: TRow) => readonly TRow[] | undefined
  readonly entry: (row: TRow) => TreeEntry
}

export function treeEntryNode(entry: TreeEntry): HTMLElement {
  const el = document.createElement("span")
  el.className = "sg-tree-entry"
  if (entry.kind !== undefined) el.dataset.kind = entry.kind
  if (entry.ext !== undefined) el.dataset.ext = entry.ext
  const icon = el.appendChild(document.createElement("span"))
  icon.className = "sg-tree-icon"
  icon.setAttribute("aria-hidden", "true")
  const label = el.appendChild(document.createElement("span"))
  label.className = "sg-tree-label"
  label.textContent = entry.label
  if (entry.note !== undefined) {
    const note = el.appendChild(document.createElement("span"))
    note.className = "sg-tree-note"
    note.textContent = entry.note
  }
  return el
}

type CellClick = Extract<GridIntent, { type: "cell.click" }>

/** A plain click anywhere on a branch's cell flips it, as the expander glyph does. */
export function expandOnBranchClick<TRow>(): GridEpic<TRow> {
  return (actions$, state, ctx) =>
    actions$.pipe(
      filter((it): it is CellClick => it.phase === "intent" && it.type === "cell.click"),
      filter((it) => !it.interactive && it.mods.button === 0),
      map((it) => it.row),
      filter((row) => ctx.view.flat.$().some((it) => it.key === row && it.hasChildren)),
      map((row): GridAction<TRow> => {
        const open = state.expanded.$()
        return { phase: "change", type: "expanded", expanded: { ...open, [row]: open[row] !== true } }
      }),
    )
}

/** Must equal `--sg-tree-row-h` in tree.css: rows are measured, and this is the first guess. */
export const TREE_ROW_H = 24

/** One grid per tree: a single headerless column, rows measured, every folder closed. */
export function treeGrid<TRow>(id: string, rows: readonly TRow[], spec: TreeSpec<TRow>): Grid<TRow> {
  const columns: readonly ColumnDef<TRow>[] = [
    {
      id: "entry",
      header: "",
      flex: 1,
      sortable: false,
      resizable: false,
      movable: false,
      cell: (ctx) => treeEntryNode(spec.entry(ctx.data)),
    },
  ]
  return grid<TRow>({
    id,
    rows,
    columns,
    rowId: spec.id,
    subRows: spec.children,
    rowMeasure: { initial: TREE_ROW_H },
    state: { density: "compact", virtualize: { vertical: false, horizontal: false } },
    epics: [...defaultEpics<TRow>(), expandOnBranchClick<TRow>()],
  })
}

// --- File preset --------------------------------------------------------------------------------

export interface FsTreeRow {
  readonly name: string
  /** Unique per tree; the row id. */
  readonly path: string
  readonly kind: "dir" | "file"
  readonly note?: string
  readonly children: readonly FsTreeRow[]
}

const extOf = (name: string): string => {
  const dot = name.lastIndexOf(".")
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ""
}

export const fsTreeSpec: TreeSpec<FsTreeRow> = {
  id: (row) => row.path,
  children: (row) => (row.kind === "dir" ? row.children : undefined),
  entry: (row) => ({
    label: row.name,
    kind: row.kind,
    ext: row.kind === "file" ? extOf(row.name) : "",
    ...(row.note === undefined ? {} : { note: row.note }),
  }),
}
