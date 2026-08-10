// Golden file explorer: every new technique in one file.
// sync:{key} (1,4), Param<T> + route composition (2,3), SignalReact (5).
import { Signal } from "@hafley66/signals"
import { SignalReact } from "@hafley66/signals/react"
import { slash } from "@hafley66/path"
import type { Param } from "@hafley66/path"
import { z } from "zod"
import { createGrid, gridStateParam, type Grid } from "@hafley66/grid"
import { GridTree } from "@hafley66/grid/react"

type FSNode = { id: string; name: string; kind: "folder" | "file"; size: number; children?: FSNode[] }

const FS = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["folder", "file"]),
  size: z.number(),
})

const tree: FSNode[] = [
  { id: "src", name: "src", kind: "folder", size: 0, children: [
    { id: "0f", name: "0_features.ts", kind: "file", size: 1480 },
    { id: "1t", name: "1_types.ts", kind: "file", size: 2110 },
    { id: "2c", name: "2_createGrid.ts", kind: "file", size: 3040 },
    { id: "4g", name: "4_grid.tsx", kind: "file", size: 4520 },
    { id: "6t", name: "6_tree.tsx", kind: "file", size: 5310 },
  ]},
  { id: "ex", name: "examples", kind: "folder", size: 0, children: [
    { id: "url", name: "url-synced-grid.ts", kind: "file", size: 690 },
    { id: "fe", name: "file-explorer.tsx", kind: "file", size: 1180 },
  ]},
  { id: "pkg", name: "package.json", kind: "file", size: 1414 },
  { id: "rd", name: "README.md", kind: "file", size: 5200 },
]

const source = Signal<FSNode[]>(tree)

// sync:{key} builds the URL-backed state signal; route-local key per page.
const explorerFor = (key: string) =>
  createGrid<FSNode>({
    schema: FS,
    rows: source,
    getRowId: (n) => n.id,
    getSubRows: (n) => n.children,
    mode: "client",
    sync: { key },
  })

// A custom Param<T> for the selected file id; same trait as the grid's.
const selectedParam: Param<string> = {
  parse: (raw) => (raw ? decodeURIComponent(raw) : undefined),
  print: (id) => encodeURIComponent(id),
}

// Route composition: gridStateParam + selectedParam -> typed { fs: GridState, sel }.
const exploreRoute = slash("/explore?{fs}&{sel}", {
  params: { fs: gridStateParam, sel: selectedParam },
})

const srcExplorer = explorerFor("src")    // /explore?src=<blob>
const docsExplorer = explorerFor("docs")  // /explore?docs=<blob>

// SignalReact auto-tracks .$() reads; re-renders on patch and on popstate.
export default SignalReact(function FileExplorer({ grid }: { grid: Grid<FSNode> }) {
  const open = Object.keys(grid.state.expanded.$()).length
  const href = exploreRoute.print({ fs: grid.state.$(), sel: "" })
  return (
    <div style={{ display: "flex", gap: 16, fontFamily: "-apple-system, sans-serif" }}>
      <GridTree grid={grid} label={`${open} open`} />
      <aside style={{ width: 240, fontSize: 12, color: "#6b7280" }}>
        <p>Reloading restores the open folders from the URL.</p>
        <p>
          <a href={href} style={{ color: "#3b82f6" }}>share this view</a>
        </p>
        <p style={{ wordBreak: "break-all", fontSize: 10 }}>{href}</p>
      </aside>
    </div>
  )
})

export { srcExplorer, docsExplorer, exploreRoute, explorerFor }
