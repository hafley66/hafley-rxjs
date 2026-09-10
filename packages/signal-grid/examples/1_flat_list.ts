// The smallest thing that renders: rows in, columns in, one element out.
// `flex` is on two of the three columns so the width resolution is visible without any state.
import { grid, render, type ColumnDef } from "../src/index.js"
import source from "./1_flat_list.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly size: number
  readonly kind: string
}

const KINDS = ["document", "image", "audio"] as const

const ROWS: readonly Row[] = Array.from({ length: 60 }, (_, i) => ({
  id: `r${i}`,
  name: `file-${String(i).padStart(3, "0")}`,
  size: ((i * 977) % 4096) + 16,
  kind: KINDS[i % 3] ?? "document",
}))

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", flex: 2, minWidth: 140 },
  { id: "size", header: "Size", width: 100 },
  { id: "kind", header: "Kind", flex: 1, minWidth: 100 },
]

export const flatList: Example = {
  id: "flat-list",
  title: "Flat list",
  summary: "Sixty rows and three columns, two of which split the leftover width two to one.",
  feature: "col.size",
  source,
  mount: (host) => {
    const root = document.createElement("div")
    root.style.blockSize = "320px"
    host.append(root)
    const g = grid<Row>({ id: "flat-list", rows: ROWS, columns: COLUMNS, rowId: (row) => row.id })
    const handle = render(g, root)
    return () => {
      handle.stop()
      root.remove()
    }
  },
}
