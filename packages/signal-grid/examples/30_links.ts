// A link is an `<a href>` the renderer builds, never a handler that assigns `location`: command
// click, middle click, copy link address, and the hover preview all live on the element.

// `ColumnDef.href` links one column's cells and `GridConfig.rowHref` links the rest of the row.
// Either one returning `undefined` leaves that row plain, and no epic is installed beside them.
import { grid, render, type ColumnDef } from "../src/index.js"
import source from "./30_links.ts?raw"
import type { Example } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly owner: string
  readonly issues: number
  readonly archived: boolean
}

const ROWS: readonly Row[] = [
  { id: "signal-grid", name: "signal-grid", owner: "hafley66", issues: 12, archived: false },
  { id: "signals", name: "signals", owner: "hafley66", issues: 4, archived: false },
  { id: "xdom", name: "xdom", owner: "hafley66", issues: 7, archived: false },
  { id: "path", name: "path", owner: "hafley66", issues: 0, archived: false },
  { id: "gothic", name: "gothic", owner: "hafley66", issues: 0, archived: true },
  { id: "marbler", name: "marbler", owner: "hafley66", issues: 2, archived: false },
  { id: "scene", name: "scene", owner: "hafley66", issues: 1, archived: true },
]

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Repository", flex: 1, minWidth: 200, href: (it) => `#repo-${it.id}` },
  { id: "owner", header: "Owner", width: 140 },
  { id: "issues", header: "Open issues", width: 140 },
]

export const links: Example = {
  id: "links",
  title: "A row, a column, or a cell as a link",
  summary:
    "The name column points at the repository, the rest of a live row points at its board, and an archived row is not a link at all.",
  feature: "view.a11y",
  source,
  mount: (host) => {
    const root = document.createElement("div")
    root.style.blockSize = "300px"
    host.append(root)
    const g = grid<Row>({
      id: "links",
      rows: ROWS,
      columns: COLUMNS,
      rowId: (row) => row.id,
      rowHref: (row) => (row.archived ? undefined : `#repo-${row.id}/board`),
    })
    const handle = render(g, root)
    return () => {
      handle.stop()
      g.close()
      root.remove()
    }
  },
}
