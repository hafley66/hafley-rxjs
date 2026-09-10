// Pinned columns are sticky runs, not a second table: one row element holds a start run, a center
// run, and an end run, so a row never splits across three scroll containers that can drift apart.
import { grid, render, type ColumnDef, type Side } from "../src/index.js"
import source from "./5_column_pinning.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly owner: string
  readonly region: string
  readonly quarter: string
  readonly budget: number
  readonly spend: number
  readonly status: string
}

const OWNERS = ["ana", "bo", "cyd", "dev"] as const
const REGIONS = ["emea", "apac", "amer"] as const

const ROWS: readonly Row[] = Array.from({ length: 80 }, (_, i) => ({
  id: `r${i}`,
  name: `project-${String(i).padStart(2, "0")}`,
  owner: OWNERS[i % 4] ?? "ana",
  region: REGIONS[i % 3] ?? "emea",
  quarter: `Q${(i % 4) + 1}`,
  budget: (i + 1) * 1250,
  spend: (i + 1) * 1250 - ((i * 137) % 900),
  status: i % 5 === 0 ? "at risk" : "on track",
}))

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", width: 200 },
  { id: "owner", header: "Owner", width: 140 },
  { id: "region", header: "Region", width: 140 },
  { id: "quarter", header: "Quarter", width: 140 },
  { id: "budget", header: "Budget", width: 160 },
  { id: "spend", header: "Spend", width: 160 },
  { id: "status", header: "Status", width: 160 },
]

const PINNED: Readonly<Record<string, Side>> = { name: "start", status: "end" }

export const columnPinning: Example = {
  id: "column-pinning",
  title: "Column pinning",
  summary: "Name held at the leading edge and status at the trailing one while the rest scroll sideways.",
  feature: "col.pin",
  source,
  mount: (host) => {
    const root = document.createElement("div")
    root.style.blockSize = "300px"
    host.append(root)
    const g = grid<Row>({
      id: "column-pinning",
      rows: ROWS,
      columns: COLUMNS,
      rowId: (row) => row.id,
      state: { colPinning: PINNED },
    })
    const handle = render(g, root)
    return () => {
      handle.stop()
      root.remove()
    }
  },
}
