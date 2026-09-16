// A module the site suite hands to the docs page. The page's own dev server transforms it, so the
// grid it mounts is the source in this repository — the same module graph the demos on the page
// already run — rather than a bundle built for a test.
import { grid, render, type ColumnDef } from "../../src/index.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly size: number
}

const ROWS: readonly Row[] = [
  { id: "a", name: "alpha", size: 3 },
  { id: "b", name: "beta", size: 2 },
  { id: "c", name: "gamma", size: 1 },
]

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "Name", flex: 1 },
  { id: "size", header: "Size", width: 80 },
]

/** Mount a grid into a host the caller owns, and hand back what removes it again. */
export function mountProbe(host: HTMLElement): () => void {
  const root = document.createElement("div")
  root.dataset.probe = "grid"
  root.style.blockSize = "200px"
  host.append(root)
  const g = grid<Row>({ id: "site-probe", rows: ROWS, columns: COLUMNS, rowId: (row) => row.id })
  const handle = render(g, root)
  return () => {
    handle.stop()
    g.close()
    root.remove()
  }
}