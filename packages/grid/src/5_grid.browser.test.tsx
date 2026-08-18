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
  document.documentElement.removeAttribute("style")
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
    await act(async () => root.render(<GridTable grid={grid} density="cozy" scrollMode="internal" />))

    await expect(page.getByTestId("grid")).toMatchScreenshot("fs-collapsed")

    await act(async () => { await page.getByTestId("row-toggle").first().click() })

    // The explicit internal mode retains the pre-external-scroll max-height cap.
    expect(document.querySelector("[data-testid=grid]")?.getBoundingClientRect().height).toBe(602)
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
const receiptRows = virtualRows.slice(0, 160)
const largeVirtualRows = Array.from({ length: 5000 }, (_, index): VirtualRow => ({
  id: `large-row-${index}`,
  name: `Row ${String(index).padStart(4, "0")}`,
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

const mountedRowLabels = () => [...document.querySelectorAll<HTMLElement>("[data-testid=grid-row]")]
  .map((row) => ({ index: Number(row.dataset.rowIndex), text: row.innerText.trim() }))

const scrollableGridDescendants = (root: HTMLElement) => [root, ...root.querySelectorAll<HTMLElement>("*")]
  .filter((element) => {
    const overflowY = getComputedStyle(element).overflowY
    return (overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight
  })

const assertMountedRangeHasLabels = () => {
  const range = rowRange()
  const labels = mountedRowLabels()
  expect(labels.length).toBe(range.mounted)
  expect(labels.every(({ text }) => text.length > 0)).toBe(true)
  const visible = labels.find(({ index }) => index >= range.start && index <= range.end)
  expect(visible?.text).toContain(`Row ${String(visible?.index).padStart(3, "0")}`)
}

const assertMountedRowsAreBounded = () => {
  const range = rowRange()
  const indexes = [...document.querySelectorAll<HTMLElement>("[data-testid=grid-row]")]
    .map((row) => Number(row.dataset.rowIndex))
  // The buffered window (visible ± overscan) stays small and always covers the
  // visible range, with buffered rows extending on both sides.
  expect(indexes.length).toBeLessThan(100)
  expect(indexes.length).toBeGreaterThan(range.end - range.start)
  expect(Math.min(...indexes)).toBeLessThanOrEqual(range.start)
  expect(Math.max(...indexes)).toBeGreaterThanOrEqual(range.end)
}

const receiptStyles = {
  page: "box-sizing:border-box; width:100%; background:#f8fafc; color:#172033; font:13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
  block: "box-sizing:border-box; display:flex; align-items:center; padding:24px; border:2px solid; font-size:18px; font-weight:700",
  panel: "margin:16px 24px; padding:12px 16px; border:1px solid #94a3b8; border-radius:8px; background:#fff; white-space:pre-wrap; font-size:14px",
  title: "margin:24px; font:700 24px/1.2 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
}

function receiptTypography(receipt: HTMLElement) {
  const style = document.createElement("style")
  style.textContent = ".virtualization-receipt [data-testid=grid] { font-size:14px !important }"
  receipt.classList.add("virtualization-receipt")
  receipt.append(style)
}

function receiptPanel({
  name,
  owner,
  rows,
  fixed = false,
}: {
  name: string
  owner: "window" | HTMLElement
  rows: VirtualRow[]
  fixed?: boolean
}) {
  const panel = document.createElement("pre")
  panel.dataset.testid = `${name}-instrumentation`
  panel.style.cssText = `${receiptStyles.panel}${fixed ? "; position:fixed; right:16px; bottom:16px; z-index:4; width:420px; margin:0; box-shadow:0 8px 24px #0003" : ""}`
  const update = () => {
    const grid = document.querySelector<HTMLElement>("[data-testid=grid]")
    const gridRect = grid?.getBoundingClientRect()
    const range = rowRange()
    const scrollTop = owner === "window" ? window.scrollY : owner.scrollTop
    panel.textContent = [
      `table title: ${name}`,
      `total rows: ${rows.length}`,
      `mounted DOM rows: ${range.mounted}`,
      `visible range: ${range.start}..${range.end}`,
      `scrollTop/window.scrollY: ${Math.round(scrollTop)}`,
      `viewport height: ${owner === "window" ? window.innerHeight : owner.clientHeight}`,
      `estimate px: ${grid?.dataset.virtualEstimateSize ?? "0"}`,
      `measured total px: ${grid?.dataset.virtualTotalSize ?? "0"}`,
      `grid document top: ${Math.round((gridRect?.top ?? 0) + window.scrollY)}`,
      `scroll owner type: ${grid?.dataset.scrollOwner ?? "unknown"}`,
    ].join("\n")
  }
  return { panel, update }
}

function receiptBlock(label: string, height: number, color: string) {
  const block = document.createElement("div")
  block.dataset.testid = `receipt-${label.toLowerCase().replaceAll(" ", "-")}`
  block.style.cssText = `${receiptStyles.block}; height:${height}px; border-color:${color}; background:${color}22`
  block.textContent = label
  return block
}

function viewportReceipt(id: string) {
  const frame = document.createElement("div")
  frame.dataset.testid = id
  frame.style.cssText = "position:absolute; left:0; z-index:10; box-sizing:border-box; width:100%; pointer-events:none; outline:3px solid #0f172a; outline-offset:-3px"
  document.body.append(frame)
  return {
    capture: async (name: string) => {
      frame.style.top = `${window.scrollY}px`
      frame.style.height = `${window.innerHeight}px`
      await expect(page.getByTestId(id)).toMatchScreenshot(name)
    },
    remove: () => frame.remove(),
  }
}

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
    const receipt = document.createElement("main")
    receipt.dataset.testid = "virtual-document-page"
    receipt.style.cssText = receiptStyles.page
    receiptTypography(receipt)
    const beforeOne = receiptBlock("Before table: source summary", 440, "#60a5fa")
    const beforeTwo = receiptBlock("Before table: filter results", 460, "#a78bfa")
    const title = document.createElement("h1")
    title.style.cssText = receiptStyles.title
    title.textContent = "Document scroll owner: virtualized table"
    const instrumentation = receiptPanel({ name: "Document external virtualization", owner: "window", rows: receiptRows, fixed: true })
    const host = document.createElement("div")
    host.style.cssText = "margin:16px 24px"
    const after = receiptBlock("After table: document continuation", 300, "#34d399")
    receipt.append(beforeOne, beforeTwo, title, instrumentation.panel, host, after)
    document.body.append(receipt)
    const grid = createGrid<VirtualRow>({
      schema: virtualSchema,
      rows: Signal<VirtualRow[]>(receiptRows),
      // Browser receipts use server mode, where the producer owns paging and
      // client pagination is disabled. The final test covers the 20-row page.
      getRowId: (row) => row.id,
      mode: "server",
    })
    const root = createRoot(host)
    await act(async () => root.render(<GridTable grid={grid} />))
    await act(settleLayout)

    const preservedHeight = receiptRows.length * 42
    expect(page.getByTestId("grid")).toHaveAttribute("data-scroll-mode", "external")
    expect(document.querySelector("[data-testid=grid]")?.getBoundingClientRect().height).toBeGreaterThanOrEqual(preservedHeight)
    expect(beforeOne.getBoundingClientRect().height + beforeTwo.getBoundingClientRect().height).toBeGreaterThan(window.innerHeight)
    expect(document.documentElement.scrollHeight).toBeGreaterThanOrEqual(900 + preservedHeight + after.getBoundingClientRect().height)
    const gridRoot = document.querySelector<HTMLElement>("[data-testid=grid]")!
    const liveViewport = document.querySelector<HTMLElement>("[data-testid=grid-viewport]")!
    expect(liveViewport.scrollHeight).toBe(liveViewport.clientHeight)
    expect(getComputedStyle(liveViewport).overflowY).toBe("hidden")
    expect(scrollableGridDescendants(gridRoot)).toMatchInlineSnapshot(`[]`)
    instrumentation.update()
    expect(instrumentation.panel.textContent).toContain("scroll owner type: window")
    const viewport = viewportReceipt("virtual-document-viewport")
    await act(async () => {
      const scrollMargin = Number(document.querySelector<HTMLElement>("[data-testid=grid]")?.dataset.scrollMargin)
      window.scrollTo(0, scrollMargin - 320)
      await settleLayout()
    })
    assertMountedRangeHasLabels()
    instrumentation.update()
    await viewport.capture("virtual-document-before")

    await act(async () => {
      const scrollMargin = Number(document.querySelector<HTMLElement>("[data-testid=grid]")?.dataset.scrollMargin)
      window.scrollTo(0, scrollMargin + 120 * 42)
      await settleLayout()
    })
    expect(rowRange().start).toBeGreaterThan(100)
    expect(rowRange().end).toBeGreaterThanOrEqual(rowRange().start)
    expect(rowRange().mounted).toBeLessThan(100)
    assertMountedRangeHasLabels()
    expect(mountedRowLabels().some(({ text }) => text.includes("Row 120"))).toBe(true)
    expect(document.querySelector("thead")?.getBoundingClientRect().top).toBeLessThanOrEqual(1)
    instrumentation.update()
    await viewport.capture("virtual-document-after")

    await act(async () => {
      await page.viewport(1280, 520)
      await settleLayout()
    })
    expect(document.querySelector("[data-testid=grid-viewport]")?.getBoundingClientRect().height).toBeLessThanOrEqual(520)
    expect(rowRange().mounted).toBeLessThan(100)
    assertMountedRangeHasLabels()

    await act(async () => {
      window.scrollTo(0, document.documentElement.scrollHeight)
      await settleLayout()
    })
    expect(after.getBoundingClientRect().top).toBeLessThan(window.innerHeight)

    root.unmount()
    viewport.remove()
    receipt.remove()
    document.body.removeAttribute("style")
    window.scrollTo(0, 0)
  })

  it("collapses the terminal external window directly from Row 099 into its footer", async () => {
    await page.viewport(1280, 800)
    document.body.style.margin = "0"
    const receipt = document.createElement("main")
    receipt.style.cssText = receiptStyles.page
    receiptTypography(receipt)
    const before = receiptBlock("Before table: terminal range", 280, "#60a5fa")
    const host = document.createElement("div")
    host.style.cssText = "margin:0 24px"
    const after = receiptBlock("After table: terminal continuation", 220, "#34d399")
    receipt.append(before, host, after)
    document.body.append(receipt)
    const grid = createGrid<VirtualRow>({
      schema: virtualSchema,
      rows: Signal<VirtualRow[]>(virtualRows.slice(0, 100)),
      getRowId: (row) => row.id,
      mode: "server",
    })
    const root = createRoot(host)
    await act(async () => root.render(<GridTable grid={grid} />))
    await act(settleLayout)

    expect(document.documentElement.scrollHeight).toBeGreaterThan(document.documentElement.clientHeight)
    const gridRoot = document.querySelector<HTMLElement>("[data-testid=grid]")!
    expect(scrollableGridDescendants(gridRoot)).toMatchInlineSnapshot(`[]`)
    await act(async () => {
      window.scrollTo(0, document.documentElement.scrollHeight)
      await settleLayout()
    })

    const lastRow = [...document.querySelectorAll<HTMLElement>("[data-testid=grid-row]")]
      .find((row) => row.dataset.rowIndex === "99")!
    const liveViewport = document.querySelector<HTMLElement>("[data-testid=grid-viewport]")!
    const footer = document.querySelector<HTMLElement>("[data-testid=grid-footer]")!
    expect(lastRow.textContent).toContain("Row 099")
    expect(liveViewport.getBoundingClientRect().bottom - footer.getBoundingClientRect().bottom).toBeLessThanOrEqual(1)
    expect(footer.getBoundingClientRect().top - lastRow.getBoundingClientRect().bottom).toBeLessThanOrEqual(1)
    expect(after.getBoundingClientRect().top - liveViewport.getBoundingClientRect().bottom).toBeLessThanOrEqual(1)
    expect(document.documentElement.scrollHeight).toBeGreaterThan(document.documentElement.clientHeight)

    const viewport = viewportReceipt("virtual-terminal-end-viewport")
    await viewport.capture("virtual-terminal-end")
    root.unmount()
    viewport.remove()
    receipt.remove()
    document.body.removeAttribute("style")
    window.scrollTo(0, 0)
  })

  it("keeps 5,000 fixed and variable-height document ranges bounded through the end", async () => {
    await page.viewport(1280, 800)
    for (const scenario of [
      { name: "fixed", density: "standard" as const, columns: undefined, estimate: 42 },
      { name: "variable", density: "compact" as const, columns: variableHeightColumns, estimate: 30 },
    ]) {
      document.body.style.margin = "0"
      const receipt = document.createElement("main")
      receipt.style.cssText = receiptStyles.page
      receiptTypography(receipt)
      const before = receiptBlock(`Before table: 5000 ${scenario.name} rows`, 160, "#60a5fa")
      const host = document.createElement("div")
      host.style.cssText = "margin:0 24px"
      const after = receiptBlock(`After table: 5000 ${scenario.name} rows`, 180, "#34d399")
      receipt.append(before, host, after)
      document.body.append(receipt)
      const grid = createGrid<VirtualRow>({
        schema: virtualSchema,
        rows: Signal<VirtualRow[]>(largeVirtualRows),
        columnDefs: scenario.columns,
        getRowId: (row) => row.id,
        mode: "server",
      })
      const root = createRoot(host)
      await act(async () => root.render(<GridTable grid={grid} density={scenario.density} />))
      await act(settleMeasurements)

      assertMountedRowsAreBounded()
      expect(mountedRowLabels().some(({ text }) => text.includes("Row 0000"))).toBe(true)
      const gridRoot = document.querySelector<HTMLElement>("[data-testid=grid]")!
      expect(scrollableGridDescendants(gridRoot)).toMatchInlineSnapshot(`[]`)

      await act(async () => {
        const scrollMargin = Number(gridRoot.dataset.scrollMargin)
        window.scrollTo(0, scrollMargin + 2500 * scenario.estimate)
        await settleMeasurements()
      })
      for (let attempt = 0; attempt < 3 && !mountedRowLabels().some(({ text }) => text.includes("Row 2500")); attempt += 1) {
        await act(async () => {
          window.scrollBy(0, (2500 - rowRange().start) * scenario.estimate)
          await settleMeasurements()
        })
      }
      assertMountedRowsAreBounded()
      expect(mountedRowLabels().some(({ text }) => text.includes("Row 2500"))).toBe(true)

      for (let attempt = 0; attempt < 12; attempt += 1) {
        await act(async () => {
          window.scrollTo(0, document.documentElement.scrollHeight)
          await settleMeasurements()
        })
      }
      assertMountedRowsAreBounded()
      const lastRow = [...document.querySelectorAll<HTMLElement>("[data-testid=grid-row]")]
        .find((row) => row.dataset.rowIndex === "4999")!
      const liveViewport = document.querySelector<HTMLElement>("[data-testid=grid-viewport]")!
      const footer = document.querySelector<HTMLElement>("[data-testid=grid-footer]")!
      expect(lastRow.textContent).toContain("Row 4999")
      expect(footer.getBoundingClientRect().top - lastRow.getBoundingClientRect().bottom).toBeLessThanOrEqual(1)
      expect(after.getBoundingClientRect().top - liveViewport.getBoundingClientRect().bottom).toBeLessThanOrEqual(1)

      const viewport = viewportReceipt(`virtual-5000-${scenario.name}-end-viewport`)
      await viewport.capture(`virtual-5000-${scenario.name}-end`)
      // Repeat after measurement settling. The same baseline validates a
      // deterministic screenshot at the same terminal scroll position.
      await act(settleMeasurements)
      await viewport.capture(`virtual-5000-${scenario.name}-end`)
      root.unmount()
      viewport.remove()
      receipt.remove()
      document.body.removeAttribute("style")
      window.scrollTo(0, 0)
    }
  })

  it("uses the nearest nested scroll parent through CSS grid and flex-column layout", async () => {
    await page.viewport(1280, 800)
    document.documentElement.style.cssText = "height:800px; overflow:hidden"
    document.body.style.cssText = "margin:0; height:800px; overflow:hidden"
    const receipt = document.createElement("section")
    receipt.dataset.testid = "virtual-ancestor-receipt"
    receipt.style.cssText = `${receiptStyles.page}; width:760px; height:800px; overflow:hidden; padding:20px`
    receiptTypography(receipt)
    const title = document.createElement("h1")
    title.style.cssText = receiptStyles.title
    title.textContent = "Ancestor scroll owner: CSS grid and flex column"
    receipt.append(title)
    const host = document.createElement("div")
    host.style.cssText = "display:grid; grid-template-rows:minmax(0, 1fr); height:520px; width:720px; border:4px solid #fb923c; background:#fff"
    receipt.append(host)
    document.body.append(receipt)
    const flex = document.createElement("div")
    flex.style.cssText = "display:flex; flex-direction:column; min-height:0"
    const scroller = document.createElement("div")
    scroller.dataset.testid = "external-scroll-parent"
    scroller.style.cssText = "overflow-y:auto; height:410px; min-height:0; border:3px solid #0ea5e9"
    const beforeOne = receiptBlock("Before table: ancestor metadata", 240, "#60a5fa")
    const beforeTwo = receiptBlock("Before table: ancestor activity", 230, "#a78bfa")
    scroller.append(beforeOne, beforeTwo)
    flex.append(scroller)
    host.append(flex)
    const mount = document.createElement("div")
    const gridTitle = document.createElement("h2")
    gridTitle.style.cssText = "margin:12px; font:700 18px/1.2 -apple-system, sans-serif"
    gridTitle.textContent = "Virtualized rows inside external owner"
    scroller.append(gridTitle)
    scroller.append(mount)
    const after = receiptBlock("After table: ancestor continuation", 180, "#34d399")
    scroller.append(after)
    const grid = createGrid<VirtualRow>({
      schema: virtualSchema,
      rows: Signal<VirtualRow[]>(receiptRows),
      getRowId: (row) => row.id,
      mode: "server",
    })
    const root = createRoot(mount)
    await act(async () => root.render(<GridTable grid={grid} />))
    await act(settleLayout)

    const instrumentation = receiptPanel({ name: "ancestor", owner: scroller, rows: receiptRows })
    receipt.insertBefore(instrumentation.panel, host)
    instrumentation.update()
    expect(beforeOne.getBoundingClientRect().height + beforeTwo.getBoundingClientRect().height).toBeGreaterThan(scroller.clientHeight)
    expect(document.documentElement.scrollHeight).toBe(document.documentElement.clientHeight)
    expect(scroller.scrollHeight).toBeGreaterThanOrEqual(470 + receiptRows.length * 42 + after.getBoundingClientRect().height)
    expect(rowRange().mounted).toBeLessThan(100)
    const viewport = viewportReceipt("virtual-ancestor-viewport")
    await act(async () => {
      const scrollMargin = Number(document.querySelector<HTMLElement>("[data-testid=grid]")?.dataset.scrollMargin)
      scroller.scrollTop = scrollMargin - 240
      scroller.dispatchEvent(new Event("scroll"))
      await settleLayout()
    })
    assertMountedRangeHasLabels()
    instrumentation.update()
    await viewport.capture("virtual-ancestor-before")
    await act(async () => {
      const scrollMargin = Number(document.querySelector<HTMLElement>("[data-testid=grid]")?.dataset.scrollMargin)
      scroller.scrollTop = scrollMargin + 80 * 42
      scroller.dispatchEvent(new Event("scroll"))
      await settleLayout()
    })
    expect(rowRange().start).toBeGreaterThan(70)
    expect(rowRange().mounted).toBeLessThan(100)
    assertMountedRangeHasLabels()
    expect(document.querySelector("[data-testid=grid-viewport]")?.getBoundingClientRect().height).toBeLessThanOrEqual(window.innerHeight + 2)
    expect(scroller.scrollTop).toBeCloseTo(Number(document.querySelector<HTMLElement>("[data-testid=grid]")?.dataset.scrollMargin) + 80 * 42, 0)
    instrumentation.update()
    await viewport.capture("virtual-ancestor-after")

    root.unmount()
    viewport.remove()
    receipt.remove()
    document.body.removeAttribute("style")
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

  it("leaves short external tables in parent flow while internal mode owns a bounded scrollbar", async () => {
    await page.viewport(1280, 800)
    const externalHost = document.createElement("div")
    document.body.append(externalHost)
    const externalGrid = createGrid<VirtualRow>({
      schema: virtualSchema,
      rows: Signal<VirtualRow[]>(virtualRows.slice(0, 20)),
      getRowId: (row) => row.id,
      mode: "server",
    })
    const externalRoot = createRoot(externalHost)
    await act(async () => externalRoot.render(<GridTable grid={externalGrid} density="compact" />))
    await act(settleLayout)

    const externalElement = document.querySelector<HTMLElement>("[data-testid=grid]")!
    expect(getComputedStyle(externalElement).overflowY).toBe("visible")
    expect(scrollableGridDescendants(externalElement)).toMatchInlineSnapshot(`[]`)

    externalRoot.unmount()
    externalHost.remove()
    const internalHost = document.createElement("div")
    document.body.append(internalHost)
    const internalGrid = createGrid<VirtualRow>({
      schema: virtualSchema,
      rows: Signal<VirtualRow[]>(receiptRows),
      getRowId: (row) => row.id,
      mode: "server",
    })
    const internalRoot = createRoot(internalHost)
    await act(async () => internalRoot.render(<GridTable grid={internalGrid} scrollMode="internal" />))
    await act(settleLayout)

    const internalElement = document.querySelector<HTMLElement>("[data-testid=grid]")!
    expect(getComputedStyle(internalElement).overflowY).toBe("auto")
    expect(internalElement.scrollHeight).toBeGreaterThan(internalElement.clientHeight)

    internalRoot.unmount()
    internalHost.remove()
  })

  it("measures variable-height rows and contributes the refined extent to document scroll", async () => {
    await page.viewport(1280, 800)
    document.body.style.margin = "0"
    const receipt = document.createElement("main")
    receipt.dataset.testid = "virtual-variable-height-page"
    receipt.style.cssText = receiptStyles.page
    receiptTypography(receipt)
    const beforeOne = receiptBlock("Before table: varying-height overview", 420, "#60a5fa")
    const beforeTwo = receiptBlock("Before table: varying-height legend", 400, "#a78bfa")
    const title = document.createElement("h1")
    title.style.cssText = receiptStyles.title
    title.textContent = "Document scroll owner: measured variable-height rows"
    const host = document.createElement("div")
    host.style.cssText = "margin:16px 24px"
    const after = receiptBlock("After table: measured extent continuation", 300, "#34d399")
    const instrumentation = receiptPanel({ name: "Variable-height external virtualization", owner: "window", rows: receiptRows, fixed: true })
    receipt.append(beforeOne, beforeTwo, title, instrumentation.panel, host, after)
    document.body.append(receipt)
    const grid = createGrid<VirtualRow>({
      schema: virtualSchema,
      rows: Signal<VirtualRow[]>(receiptRows),
      columnDefs: variableHeightColumns,
      getRowId: (row) => row.id,
      mode: "server",
    })
    const root = createRoot(host)
    await act(async () => root.render(<GridTable grid={grid} density="compact" />))
    await act(settleMeasurements)

    const estimatedExtent = receiptRows.length * 30
    const gridHeight = document.querySelector("[data-testid=grid]")?.getBoundingClientRect().height ?? 0
    expect(gridHeight).toBeGreaterThan(estimatedExtent)
    expect(document.documentElement.scrollHeight).toBeGreaterThan(820 + estimatedExtent)
    expect(rowRange().mounted).toBeLessThan(100)
    assertMountedRangeHasLabels()
    instrumentation.update()
    const viewport = viewportReceipt("virtual-variable-height-viewport")
    await act(async () => {
      const scrollMargin = Number(document.querySelector<HTMLElement>("[data-testid=grid]")?.dataset.scrollMargin)
      window.scrollTo(0, scrollMargin - 320)
      await settleMeasurements()
    })
    assertMountedRangeHasLabels()
    instrumentation.update()
    await viewport.capture("virtual-variable-height-before")

    await act(async () => {
      const scrollMargin = Number(document.querySelector<HTMLElement>("[data-testid=grid]")?.dataset.scrollMargin)
      window.scrollTo(0, scrollMargin + 80 * 30)
      await settleMeasurements()
    })
    const range = rowRange()
    const mounted = [...document.querySelectorAll<HTMLElement>("[data-testid=grid-row]")]
      .map((row) => Number(row.dataset.rowIndex))
    expect(range.start).toBeGreaterThan(0)
    expect(range.end).toBeGreaterThanOrEqual(range.start)
    expect(Math.min(...mounted)).toBeLessThanOrEqual(range.start)
    expect(Math.max(...mounted)).toBeGreaterThanOrEqual(range.end)
    expect(mounted.length).toBeLessThan(100)
    assertMountedRangeHasLabels()
    instrumentation.update()
    await viewport.capture("virtual-variable-height-after")

    root.unmount()
    viewport.remove()
    receipt.remove()
    document.body.removeAttribute("style")
    window.scrollTo(0, 0)
  })

  it("buffers rows beyond the visible range and applies a sub-row translateY", async () => {
    await page.viewport(1280, 800)
    document.body.style.margin = "0"
    const host = document.createElement("div")
    host.style.cssText = "margin:0 24px"
    document.body.append(host)
    const grid = createGrid<VirtualRow>({
      schema: virtualSchema,
      rows: Signal<VirtualRow[]>(virtualRows),
      getRowId: (row) => row.id,
      mode: "server",
    })
    const root = createRoot(host)
    await act(async () => root.render(<GridTable grid={grid} />))
    await act(settleLayout)

    await act(async () => {
      const scrollMargin = Number(document.querySelector<HTMLElement>("[data-testid=grid]")?.dataset.scrollMargin)
      window.scrollTo(0, scrollMargin + 150 * 42 + 21)
      await settleMeasurements()
    })
    const range = rowRange()
    const mounted = [...document.querySelectorAll<HTMLElement>("[data-testid=grid-row]")]
      .map((row) => Number(row.dataset.rowIndex))
    // Buffered rows extend outside the strictly visible range on both sides.
    expect(mounted.length).toBeGreaterThan(range.end - range.start + 1)
    expect(Math.min(...mounted)).toBeLessThan(range.start)
    expect(Math.max(...mounted)).toBeGreaterThan(range.end)
    // A non-row-aligned scroll yields a fractional negative tbody translate.
    const transform = document.querySelector<HTMLElement>("tbody")?.style.transform ?? ""
    const translateY = Number(/translateY\((-?[\d.]+)px\)/.exec(transform)?.[1] ?? "0")
    expect(translateY).toBeLessThan(0)

    root.unmount()
    host.remove()
    document.body.removeAttribute("style")
    window.scrollTo(0, 0)
  })

  it("shows a phantom horizontal scrollbar on overflow and syncs it with the clip", async () => {
    await page.viewport(1280, 800)
    document.body.style.margin = "0"
    const host = document.createElement("div")
    host.style.cssText = "margin:0 24px"
    document.body.append(host)
    const wideColumns: ColumnDef<GridFeatures, VirtualRow>[] = [
      { id: "name", accessorFn: (row) => row.name, header: "Name" },
      { id: "blob", accessorFn: () => "x".repeat(4000), header: "Blob" },
    ]
    const grid = createGrid<VirtualRow>({
      schema: virtualSchema,
      rows: Signal<VirtualRow[]>(virtualRows.slice(0, 200)),
      columnDefs: wideColumns,
      getRowId: (row) => row.id,
      mode: "server",
    })
    const root = createRoot(host)
    await act(async () => root.render(<GridTable grid={grid} rawRows />))
    await act(settleLayout)

    const track = document.querySelector<HTMLElement>("[data-scroll-axis=x]")
    expect(track).not.toBeNull()
    expect(track!.style.display).not.toBe("none")
    const gridViewport = document.querySelector<HTMLElement>("[data-testid=grid-viewport]")!
    const clip = gridViewport.firstElementChild as HTMLElement
    expect(clip.scrollWidth).toBeGreaterThan(clip.clientWidth)
    // Driving the phantom track pans the clipped container.
    track!.scrollLeft = 123
    track!.dispatchEvent(new Event("scroll"))
    await act(settleLayout)
    expect(clip.scrollLeft).toBe(123)

    root.unmount()
    host.remove()
    document.body.removeAttribute("style")
    window.scrollTo(0, 0)
  })

  it("mirrors the content's resolved scrollbar styles onto the phantom track", async () => {
    const { attachPhantomScrollbar } = await import("@hafley66/virtualizations")
    const host = document.createElement("div")
    const content = document.createElement("div")
    content.style.cssText = "width:100px; overflow:hidden; scrollbar-width:thin; scrollbar-color:rgb(1, 2, 3) rgb(4, 5, 6)"
    const wide = document.createElement("div")
    wide.style.width = "4000px"
    content.append(wide)
    document.body.append(host, content)

    const { track, dispose } = attachPhantomScrollbar({ host, content })
    expect(getComputedStyle(track).scrollbarWidth).toBe("thin")
    expect(getComputedStyle(track).scrollbarColor).toBe("rgb(1, 2, 3) rgb(4, 5, 6)")

    dispose()
    host.remove()
    content.remove()
  })

  it("smokes 1,000,000 raw rows with a bounded virtual window", async () => {
    await page.viewport(1280, 800)
    document.body.style.margin = "0"
    const host = document.createElement("div")
    host.style.cssText = "margin:0 24px"
    document.body.append(host)
    const million = new Array<VirtualRow>(1_000_000)
    for (let i = 0; i < 1_000_000; i++) {
      million[i] = { id: `r${i}`, name: `Row ${String(i).padStart(7, "0")}`, size: i }
    }
    const grid = createGrid<VirtualRow>({
      schema: virtualSchema,
      rows: Signal<VirtualRow[]>(million),
      getRowId: (row) => row.id,
      mode: "server",
    })
    const root = createRoot(host)
    await act(async () => root.render(<GridTable grid={grid} rawRows />))
    await act(settleLayout)

    await act(async () => {
      const scrollMargin = Number(document.querySelector<HTMLElement>("[data-testid=grid]")?.dataset.scrollMargin)
      window.scrollTo(0, scrollMargin + 500_000 * 42)
      await settleMeasurements()
    })
    const range = rowRange()
    const mounted = document.querySelectorAll("[data-testid=grid-row]").length
    expect(mounted).toBeLessThan(100)
    expect(range.start).toBeGreaterThan(499_000)
    expect(range.start).toBeLessThan(500_100)

    root.unmount()
    host.remove()
    document.body.removeAttribute("style")
    window.scrollTo(0, 0)
  })
})
