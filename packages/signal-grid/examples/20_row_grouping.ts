// Grouping mints a synthetic parent per distinct path and reparents the rows under it, so the
// result is the same ordered forest tree data produces and one flatten serves both. The key is
// `GROUP_PREFIX` plus the JSON of the path, which is what keeps two levels from colliding.
import { GROUP_PREFIX, grid, render, type ColumnDef } from "../src/index.js"
import source from "./20_row_grouping.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly kind: string
  readonly owner: string
  readonly size: number
}

const KINDS = ["document", "image", "audio"] as const
const OWNERS = ["ana", "bo"] as const

const ROWS: readonly Row[] = Array.from({ length: 60 }, (_, i) => ({
  id: `r${i}`,
  name: `asset-${String(i).padStart(2, "0")}`,
  kind: KINDS[i % 3] ?? "document",
  owner: OWNERS[i % 2] ?? "ana",
  size: (i * 271) % 900,
}))

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", flex: 2, minWidth: 200, groupable: true },
  { id: "kind", header: "Kind", width: 140, groupable: true },
  { id: "owner", header: "Owner", width: 120, groupable: true },
  { id: "size", header: "Size", width: 110 },
]

const groupKey = (path: readonly unknown[]): string => GROUP_PREFIX + JSON.stringify(path)

const OPEN: Readonly<Record<string, boolean>> = Object.fromEntries(
  KINDS.map((kind) => [groupKey([kind]), true]),
)

export const rowGrouping: Example = {
  id: "row-grouping",
  title: "Row grouping",
  summary:
    "Grouped by kind then owner. Each heading names the column it grouped, the value, and how many rows sit under it; the first level is open and the second is one expander away.",
  feature: "row.group",
  source,
  mount: (host) => {
    const root = document.createElement("div")
    root.style.blockSize = "340px"
    host.append(root)
    const g = grid<Row>({
      id: "row-grouping",
      rows: ROWS,
      columns: COLUMNS,
      rowId: (row) => row.id,
      state: { group: ["kind", "owner"], expanded: OPEN, sort: [{ field: "name", sort: "asc" }] },
    })
    const handle = render(g, root)
    return () => {
      handle.stop()
      g.close()
      root.remove()
    }
  },
}
