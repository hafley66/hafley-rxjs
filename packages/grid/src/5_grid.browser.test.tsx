import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { page } from "vitest/browser"
import type { ColumnDef } from "@tanstack/react-table"
import { Signal } from "@hafley66/signals"
import { z } from "zod"
import { createDefaultGridState, createGrid } from "./2_createGrid"
import type { GridFeatures } from "./0_features"
import { GridTable } from "./4_grid"
import { GridTree } from "./6_tree"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  document.body.replaceChildren()
  document.body.removeAttribute("style")
  window.scrollTo(0, 0)
})

type FSNode = { id: string; name: string; kind: "folder" | "file"; size: number; children?: FSNode[] }

const FS = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["folder", "file"]),
  size: z.number(),
})

const fsTree: FSNode[] = [
  {
    id: "src", name: "src", kind: "folder", size: 0, children: [
      { id: "0f", name: "0_features.ts", kind: "file", size: 1480 },
      { id: "1t", name: "1_types.ts", kind: "file", size: 2110 },
      { id: "2c", name: "2_createGrid.ts", kind: "file", size: 3040 },
      { id: "3r", name: "3_react.ts", kind: "file", size: 1020 },
      { id: "4g", name: "4_grid.tsx", kind: "file", size: 4520 },
      { id: "6t", name: "6_tree.tsx", kind: "file", size: 5310 },
      {
        id: "ss", name: "__screenshots__", kind: "folder", size: 0, children: [
          { id: "sc", name: "tree-collapsed.png", kind: "file", size: 12784 },
          { id: "se", name: "tree-expanded.png", kind: "file", size: 19012 },
        ],
      },
    ],
  },
  {
    id: "ex", name: "examples", kind: "folder", size: 0, children: [
      { id: "url", name: "url-synced-grid.ts", kind: "file", size: 690 },
    ],
  },
  { id: "pkg", name: "package.json", kind: "file", size: 1414 },
  { id: "tsc", name: "tsconfig.json", kind: "file", size: 443 },
  { id: "vite", name: "vite.config.ts", kind: "file", size: 433 },
  { id: "rd", name: "README.md", kind: "file", size: 5200 },
]

const EXT_COLOR: Record<string, string> = {
  ts: "#3178c6", tsx: "#3178c6", js: "#e8b400", jsx: "#e8b400",
  json: "#a3a323", md: "#6b7280", css: "#663399", html: "#e34c26",
  png: "#c026d3", jpg: "#c026d3", svg: "#f59e0b",
}

const extOf = (name: string) => {
  const i = name.lastIndexOf(".")
  return i > 0 ? name.slice(i + 1).toLowerCase() : ""
}

const FolderIcon = ({ open }: { open: boolean }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" style={{ flex: "0 0 auto" }}>
    <path fill={open ? "#3b82f6" : "#93b4f5"} d="M3 6.5 A1.5 1.5 0 0 1 4.5 5 H9 l2 2 h8.5 A1.5 1.5 0 0 1 21 8.5 V18 A1.5 1.5 0 0 1 19.5 19.5 H4.5 A1.5 1.5 0 0 1 3 18 Z" />
  </svg>
)

const FileIcon = ({ color }: { color: string }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" style={{ flex: "0 0 auto" }}>
    <path fill={color} fillOpacity=".14" d="M6 3.5 A1.5 1.5 0 0 1 7.5 2 H14 L20 8 V20.5 A1.5 1.5 0 0 1 18.5 22 H7.5 A1.5 1.5 0 0 1 6 20.5 Z" />
    <path fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" d="M6 3.5 A1.5 1.5 0 0 1 7.5 2 H14 L20 8 V20.5 A1.5 1.5 0 0 1 18.5 22 H7.5 A1.5 1.5 0 0 1 6 20.5 Z M14 2 V6.5 A1.5 1.5 0 0 0 15.5 8 H20" />
  </svg>
)

const Pill = ({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) => (
  <span style={{
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    background: bg,
    color,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: ".04em",
    textTransform: "uppercase",
  }}>{children}</span>
)

const tableColumns: ColumnDef<GridFeatures, FSNode>[] = [
  { id: "__expand", header: "" },
  {
    id: "name", accessorKey: "name", header: "Name",
    cell: ({ row, getValue }) => {
      const node = row.original
      const name = getValue() as string
      const isFolder = node.kind === "folder"
      const color = isFolder ? "#3b82f6" : (EXT_COLOR[extOf(name)] ?? "#9ca3af")
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
          {isFolder ? <FolderIcon open={row.getIsExpanded()} /> : <FileIcon color={color} />}
          <span style={{ fontWeight: isFolder ? 600 : 400, color: isFolder ? "#111827" : "#374151" }}>{name}</span>
        </span>
      )
    },
  },
  {
    id: "size", accessorKey: "size", header: "Size", meta: { align: "right" },
    cell: ({ row, getValue }) => {
      if (row.original.kind === "folder") return <span style={{ color: "#d1d5db" }}>—</span>
      const n = getValue() as number
      const fmt = n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`
      return <span style={{ color: "#6b7280" }}>{fmt}</span>
    },
  },
  {
    id: "kind", accessorKey: "kind", header: "Type",
    cell: ({ row }) => {
      const node = row.original
      if (node.kind === "folder") return <Pill bg="#eef2ff" color="#4f46e5">folder</Pill>
      const ext = extOf(node.name).toUpperCase() || "FILE"
      return <Pill bg="#f3f4f6" color="#6b7280">{ext}</Pill>
    },
  },
]

describe("GridTable filesystem demo", () => {
  it("renders a collapsed tree, then expands src/", async () => {
    const rows = Signal<FSNode[]>(fsTree)
    const grid = createGrid<FSNode>({
      schema: FS,
      rows,
      getRowId: (n) => n.id,
      getSubRows: (n) => n.children,
      columnDefs: tableColumns,
      mode: "client",
    })

    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<GridTable grid={grid} density="cozy" />))

    await expect(page.getByTestId("grid")).toMatchScreenshot("fs-collapsed")

    await act(async () => { await page.getByTestId("row-toggle").first().click() })

    await expect(page.getByTestId("grid")).toMatchScreenshot("fs-expanded")

    // Polling sources replace the array while retaining stable row ids. That
    // update must preserve the user's expansion state.
    await act(async () => rows.$([...fsTree]))
    expect(grid.state.$().expanded).toMatchInlineSnapshot(`
      {
        "src": true,
      }
    `)

    root.unmount()
    host.remove()
  })
})

// Arbitrary nesting: a file (README.md) is itself a folder of markdown AST blocks,
// and one block nests a code line — depth is unbounded.
type TreeNode = { id: string; name: string; kind: "folder" | "file" | "block"; children?: TreeNode[] }

const MD = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["folder", "file", "block"]),
})

const mdAst: TreeNode[] = [
  { id: "h1", name: "# @hafley66/grid", kind: "block" },
  {
    id: "inst", name: "## Install", kind: "block", children: [
      { id: "instc", name: "npm install @hafley66/grid ...", kind: "block" },
    ],
  },
  { id: "qs", name: "## Quick start", kind: "block" },
]

const explorer: TreeNode[] = [
  {
    id: "src", name: "src", kind: "folder", children: [
      { id: "0f", name: "0_features.ts", kind: "file" },
      { id: "2c", name: "2_createGrid.ts", kind: "file" },
      { id: "4g", name: "4_grid.tsx", kind: "file" },
      { id: "6t", name: "6_tree.tsx", kind: "file" },
      {
        id: "ss", name: "__screenshots__", kind: "folder", children: [
          { id: "col", name: "tree-collapsed.png", kind: "file" },
          { id: "exp", name: "tree-expanded.png", kind: "file" },
        ],
      },
    ],
  },
  {
    id: "ex", name: "examples", kind: "folder", children: [
      { id: "url", name: "url-synced-grid.ts", kind: "file" },
    ],
  },
  { id: "rd", name: "README.md", kind: "file", children: mdAst },
  { id: "pkg", name: "package.json", kind: "file" },
]

describe("GridTree explorer demo", () => {
  it("renders a collapsed tree, then opens a folder and a file's AST", async () => {
    const grid = createGrid<TreeNode>({
      schema: MD,
      rows: Signal<TreeNode[]>(explorer),
      getRowId: (n) => n.id,
      getSubRows: (n) => n.children,
      mode: "client",
    })

    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<GridTree grid={grid} label="Explorer" />))

    expect(document.querySelectorAll(".gt-row").length).toBe(4)
    await expect(page.getByTestId("grid-tree")).toMatchScreenshot("tree-collapsed")

    await act(async () => { await page.getByTestId("toggle-src").click() })
    await act(async () => { await page.getByTestId("toggle-rd").click() })
    await act(async () => { await page.getByTestId("toggle-inst").click() })

    expect(document.querySelectorAll(".gt-row").length).toBe(13)
    await expect(page.getByTestId("grid-tree")).toMatchScreenshot("tree-expanded")

    root.unmount()
    host.remove()
  })
})

type VirtualRow = { id: string; name: string; size: number }

const virtualSchema = z.object({ id: z.string(), name: z.string(), size: z.number() })
const virtualRows = Array.from({ length: 500 }, (_, index): VirtualRow => ({
  id: `row-${index}`,
  name: `Row ${String(index).padStart(3, "0")}`,
  size: index,
}))

const settleLayout = () => new Promise<void>((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
})

const settleMeasurements = () => new Promise<void>((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
})

const rowRange = () => ({
  start: Number(document.querySelector("[data-testid=grid]")?.getAttribute("data-visible-start")),
  end: Number(document.querySelector("[data-testid=grid]")?.getAttribute("data-visible-end")),
  mounted: document.querySelectorAll("[data-testid=grid-row]").length,
})

const variableHeightColumns: ColumnDef<GridFeatures, VirtualRow>[] = [
  {
    accessorKey: "name",
    header: "Variable height",
    cell: ({ getValue, row }) => (
      <div style={{ height: row.index % 2 ? 72 : 54, display: "flex", alignItems: "center" }}>
        {getValue() as string}
      </div>
    ),
  },
  { accessorKey: "size", header: "Size", meta: { align: "right" } },
]

describe("GridTable external-scroll virtualization", () => {
  it("uses document scroll after preceding content, caps the live viewport, and responds to viewport resize", async () => {
    await page.viewport(1280, 800)
    document.body.style.margin = "0"
    const host = document.createElement("div")
    const before = document.createElement("div")
    before.style.height = "180px"
    before.textContent = "content before grid"
    document.body.append(before)
    document.body.append(host)
    const after = document.createElement("div")
    after.style.height = "1000px"
    after.textContent = "content after grid"
    document.body.append(after)
    const grid = createGrid<VirtualRow>({
      schema: virtualSchema,
      rows: Signal<VirtualRow[]>(virtualRows),
      // Browser receipts use server mode, where the producer owns paging and
      // client pagination is disabled. The final test covers the 20-row page.
      getRowId: (row) => row.id,
      mode: "server",
    })
    const root = createRoot(host)
    await act(async () => root.render(<GridTable grid={grid} />))
    await act(settleLayout)

    const preservedHeight = 500 * 42
    expect(page.getByTestId("grid")).toHaveAttribute("data-scroll-mode", "external")
    expect(document.querySelector("[data-testid=grid]")?.getBoundingClientRect().height).toBeGreaterThanOrEqual(preservedHeight)
    expect(document.documentElement.scrollHeight).toBeGreaterThanOrEqual(180 + preservedHeight)
    expect(document.querySelector("[data-testid=grid-viewport]")?.scrollHeight).toBeLessThanOrEqual(
      document.querySelector("[data-testid=grid]")?.scrollHeight ?? Infinity,
    )
    expect(document.querySelector("[data-testid=grid-viewport]")?.style.overflowY).toBe("clip")

    await act(async () => {
      window.scrollTo(0, 180 + 120 * 42)
      await settleLayout()
    })
    expect(rowRange()).toMatchInlineSnapshot(`
      {
        "end": 133,
        "mounted": 28,
        "start": 115,
      }
    `)
    expect(document.querySelector("[data-testid=grid-row]")?.getAttribute("data-row-index")).toBe("116")
    expect(document.querySelector("thead")?.getBoundingClientRect().top).toBeLessThanOrEqual(1)
    await expect(page.getByTestId("grid-viewport")).toMatchScreenshot("virtual-document-inside")

    await act(async () => {
      await page.viewport(1280, 520)
      await settleLayout()
    })
    expect(document.querySelector("[data-testid=grid-viewport]")?.getBoundingClientRect().height).toBeLessThanOrEqual(520)
    expect(rowRange()).toMatchInlineSnapshot(`
      {
        "end": 126,
        "mounted": 21,
        "start": 115,
      }
    `)
    await expect(page.getByTestId("grid-viewport")).toMatchScreenshot("virtual-document-resized")

    await act(async () => {
      window.scrollTo(0, 180 + 500 * 42 + 120)
      await settleLayout()
    })
    expect(document.querySelector("[data-testid=grid-viewport]")?.getBoundingClientRect().bottom).toBeLessThanOrEqual(0)

    root.unmount()
    before.remove()
    host.remove()
    after.remove()
    window.scrollTo(0, 0)
  })

  it("uses the nearest nested scroll parent through CSS grid and flex-column layout", async () => {
    await page.viewport(1280, 800)
    document.body.style.margin = "0"
    const host = document.createElement("div")
    host.style.cssText = "display:grid; grid-template-rows:minmax(0, 1fr); height:520px; width:720px"
    document.body.append(host)
    const flex = document.createElement("div")
    flex.style.cssText = "display:flex; flex-direction:column; min-height:0"
    const scroller = document.createElement("div")
    scroller.dataset.testid = "external-scroll-parent"
    scroller.style.cssText = "overflow-y:auto; height:410px; min-height:0"
    const before = document.createElement("div")
    before.style.height = "96px"
    before.textContent = "nested content before grid"
    scroller.append(before)
    flex.append(scroller)
    host.append(flex)
    const mount = document.createElement("div")
    scroller.append(mount)
    const grid = createGrid<VirtualRow>({
      schema: virtualSchema,
      rows: Signal<VirtualRow[]>(virtualRows),
      getRowId: (row) => row.id,
      mode: "server",
    })
    const root = createRoot(mount)
    await act(async () => root.render(<GridTable grid={grid} />))
    await act(settleLayout)

    expect(scroller.scrollHeight).toBeGreaterThanOrEqual(96 + 500 * 42)
    expect(rowRange().mounted).toBeLessThan(40)
    await act(async () => {
      scroller.scrollTop = 96 + 80 * 42
      scroller.dispatchEvent(new Event("scroll"))
      await settleLayout()
    })
    expect(rowRange()).toMatchInlineSnapshot(`
      {
        "end": 85,
        "mounted": 18,
        "start": 77,
      }
    `)
    expect(document.querySelector("[data-testid=grid-row]")?.getAttribute("data-row-index")).toBe("76")
    expect(document.querySelector("[data-testid=grid-viewport]")?.getBoundingClientRect().height).toBeLessThanOrEqual(window.innerHeight + 2)
    expect(scroller.scrollTop).toBe(96 + 80 * 42)
    await expect(page.getByTestId("grid-viewport")).toMatchScreenshot("virtual-ancestor-inside")

    root.unmount()
    host.remove()
  })

  it("keeps virtual indexes inside the active client page", async () => {
    const host = document.createElement("div")
    document.body.append(host)
    const grid = createGrid<VirtualRow>({
      schema: virtualSchema,
      rows: Signal<VirtualRow[]>(virtualRows),
      state: Signal(createDefaultGridState({ pagination: { pageIndex: 3, pageSize: 20 } })),
      getRowId: (row) => row.id,
      mode: "client",
    })
    const root = createRoot(host)
    await act(async () => root.render(<GridTable grid={grid} />))
    await act(settleLayout)

    expect(rowRange()).toMatchInlineSnapshot(`
      {
        "end": 17,
        "mounted": 20,
        "start": 0,
      }
    `)
    expect(document.querySelector("[data-testid=grid-row]")?.textContent).toContain("Row 060")
    expect(document.querySelectorAll("[data-testid=grid-row]").length).toBe(20)

    root.unmount()
    host.remove()
  })

  it("measures variable-height rows and contributes the refined extent to document scroll", async () => {
    await page.viewport(1280, 800)
    const before = document.createElement("div")
    before.style.height = "120px"
    const host = document.createElement("div")
    const after = document.createElement("div")
    after.style.height = "1000px"
    document.body.append(before, host, after)
    const grid = createGrid<VirtualRow>({
      schema: virtualSchema,
      rows: Signal<VirtualRow[]>(virtualRows),
      columnDefs: variableHeightColumns,
      getRowId: (row) => row.id,
      mode: "server",
    })
    const root = createRoot(host)
    await act(async () => root.render(<GridTable grid={grid} density="compact" />))
    await act(settleMeasurements)

    const estimatedExtent = 500 * 30
    const gridHeight = document.querySelector("[data-testid=grid]")?.getBoundingClientRect().height ?? 0
    expect(gridHeight).toBeGreaterThan(estimatedExtent)
    expect(document.documentElement.scrollHeight).toBeGreaterThan(120 + estimatedExtent)
    expect(rowRange().mounted).toBeLessThan(40)

    await act(async () => {
      window.scrollTo(0, 120 + 160 * 30)
      await settleMeasurements()
    })
    const range = rowRange()
    const mounted = [...document.querySelectorAll<HTMLElement>("[data-testid=grid-row]")]
      .map((row) => Number(row.dataset.rowIndex))
    expect(range.start).toBeGreaterThan(0)
    expect(range.end).toBeGreaterThanOrEqual(range.start)
    expect(Math.min(...mounted)).toBeLessThanOrEqual(range.start)
    expect(Math.max(...mounted)).toBeGreaterThanOrEqual(range.end)
    expect(mounted.length).toBeLessThan(40)
    await expect(page.getByTestId("grid-viewport")).toMatchScreenshot("virtual-variable-height-inside")

    root.unmount()
    before.remove()
    host.remove()
    after.remove()
  })
})
