// Two sort keys at once. The seed puts `kind` ahead of `size`, and a shift-click on any header
// appends or flips a key without dropping the ones already in the model.
import { grid, render, type ColumnDef } from "../src/index.js"
import source from "./2_multi_sort.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly size: number
  readonly kind: string
}

const KINDS = ["audio", "document", "image"] as const

const ROWS: readonly Row[] = Array.from({ length: 40 }, (_, i) => ({
  id: `r${i}`,
  name: `asset-${String(i).padStart(2, "0")}`,
  size: ((i * 613) % 900) + 10,
  kind: KINDS[i % 3] ?? "audio",
}))

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "kind", header: "Kind", width: 140, sortable: true },
  { id: "size", header: "Size", width: 110, sortable: true, type: "number" },
  { id: "name", header: "Name", flex: 1, minWidth: 160, sortable: true },
]

export const multiSort: Example = {
  id: "multi-sort",
  title: "Multi-column sort",
  summary: "Kind ascending then size descending; shift-click a header to add or flip a key.",
  feature: "row.sort.multi",
  source,
  mount: (host) => {
    const root = document.createElement("div")
    root.style.blockSize = "320px"
    host.append(root)
    const g = grid<Row>({
      id: "multi-sort",
      rows: ROWS,
      columns: COLUMNS,
      rowId: (row) => row.id,
      state: { sort: [{ field: "kind", sort: "asc" }, { field: "size", sort: "desc" }] },
    })
    const handle = render(g, root)
    return () => {
      handle.stop()
      g.close()
      root.remove()
    }
  },
}
