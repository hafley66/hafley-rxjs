// A header group is an interior node of the column forest, so nesting is the same `flattenAxis`
// call the row axis makes. The band labels its leaves and holds no seat: no track, no data cell.
import { grid, headerGroup, render, type ColumnDef } from "../src/index.js"
import source from "./29_header_groups.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly project: string
  readonly owner: string
  readonly budget: number
  readonly spend: number
  readonly opened: number
  readonly closed: number
}

const OWNERS = ["ana", "bo", "cyd", "dev"] as const

const ROWS: readonly Row[] = Array.from({ length: 40 }, (_row, index) => ({
  id: `r${index}`,
  project: `project-${String(index).padStart(2, "0")}`,
  owner: OWNERS[index % 4] ?? "ana",
  budget: (index + 1) * 1250,
  spend: (index + 1) * 1250 - ((index * 137) % 900),
  opened: (index % 7) + 2,
  closed: index % 5,
}))

// Three levels: "Money" and "Tickets" sit under "Quarter", and "project" stands outside every band.
const COLUMNS: readonly ColumnDef<Row>[] = [
  headerGroup<Row>({ id: "quarter", header: "Q3" }),
  headerGroup<Row>({ id: "money", header: "Money", group: "quarter" }),
  headerGroup<Row>({ id: "tickets", header: "Tickets", group: "quarter" }),
  { id: "project", header: "Project", width: 190 },
  { id: "owner", header: "Owner", width: 120 },
  { id: "budget", header: "Budget", width: 130, group: "money", resizable: true },
  { id: "spend", header: "Spend", width: 130, group: "money", resizable: true },
  { id: "opened", header: "Opened", width: 110, group: "tickets", resizable: true },
  { id: "closed", header: "Closed", width: 110, group: "tickets", resizable: true },
]

export const headerGroups: Example = {
  id: "header-groups",
  title: "Header groups",
  summary: "Two band levels over six leaves, each band covering exactly the tracks its leaves take.",
  feature: "col.group",
  source,
  mount: (host) => {
    const root = document.createElement("div")
    root.style.blockSize = "320px"
    host.append(root)
    const g = grid<Row>({
      id: "header-groups",
      rows: ROWS,
      columns: COLUMNS,
      rowId: (row) => row.id,
    })
    const handle = render(g, root)
    return () => {
      handle.stop()
      g.close()
      root.remove()
    }
  },
}
