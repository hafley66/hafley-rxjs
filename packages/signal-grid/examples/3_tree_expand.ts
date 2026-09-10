// Supplying `subRows` is the whole of tree mode: the same call that renders a flat list renders a
// forest, because both are one `Axis`. The expander box is drawn by the renderer ahead of the
// first cell run, so no column is needed to make a row openable.
import { grid, render, type ColumnDef } from "../src/index.js"
import source from "./3_tree_expand.ts?raw"
import type { Example } from "./0_types.js"

interface Node {
  readonly id: string
  readonly name: string
  readonly size: number
  readonly children?: readonly Node[]
}

const leaf = (id: string, n: number): Node => ({ id, name: `part-${n}.bin`, size: n * 37 + 12 })

const TREE: readonly Node[] = Array.from({ length: 4 }, (_, f) => ({
  id: `dir${f}`,
  name: `chapter-${f}`,
  size: 0,
  children: Array.from({ length: 5 }, (_, i) => ({
    id: `dir${f}-s${i}`,
    name: `section-${f}.${i}`,
    size: 0,
    children: Array.from({ length: 3 }, (_, j) => leaf(`dir${f}-s${i}-p${j}`, f * 20 + i * 3 + j)),
  })),
}))

const COLUMNS: readonly ColumnDef<Node>[] = [
  { id: "name", header: "Name", flex: 2, minWidth: 200 },
  { id: "size", header: "Size", width: 110 },
]

export const treeExpand: Example = {
  id: "tree-expand",
  title: "Tree data with expand",
  summary: "Three levels from nested source data; alt-click an expander to open a whole branch.",
  feature: "row.tree",
  source,
  mount: (host) => {
    const root = document.createElement("div")
    root.style.blockSize = "340px"
    host.append(root)
    const g = grid<Node>({
      id: "tree-expand",
      rows: TREE,
      columns: COLUMNS,
      rowId: (row) => row.id,
      subRows: (row) => row.children,
      state: { expanded: { dir0: true, "dir0-s0": true } },
    })
    const handle = render(g, root)
    return () => {
      handle.stop()
      root.remove()
    }
  },
}
