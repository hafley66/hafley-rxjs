import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { page } from "vitest/browser"
import { Signal } from "@hafley66/signals"
import { z } from "zod"
import { createGrid } from "./2_createGrid"
import { TreeTable } from "./12_treeTable"
import { ColumnVisibilityToolbar } from "./13_columnVisibilityToolbar"
import type { TreeColumn } from "./10_treeColumn"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  document.body.replaceChildren()
  document.body.removeAttribute("style")
  document.documentElement.removeAttribute("style")
  window.scrollTo(0, 0)
})

type Node = { id: string; name: string; kind: "folder" | "file"; size: number; children?: Node[] }

const NodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["folder", "file"]),
  size: z.number(),
})

const tree: Node[] = [
  {
    id: "src", name: "src", kind: "folder", size: 0, children: [
      { id: "idx", name: "index.ts", kind: "file", size: 120 },
      { id: "utl", name: "utils.ts", kind: "file", size: 80 },
    ],
  },
  { id: "pkg", name: "package.json", kind: "file", size: 40 },
]

const columns: TreeColumn<Node>[] = [
  { id: "name", header: "Name", tree: true, toggleExpand: true, cell: (n) => n.name, sortValue: (n) => n.name },
  { id: "size", header: "Size", cell: (n) => String(n.size) },
]

const settleLayout = () => new Promise<void>((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
})

function mountTree(nodes: Node[], extraCols: TreeColumn<Node>[] = columns) {
  const host = document.createElement("div")
  document.body.append(host)
  const grid = createGrid<Node>({
    schema: NodeSchema,
    rows: Signal<Node[]>(nodes),
    getRowId: (n) => n.id,
    getSubRows: (n) => n.children,
    mode: "client",
  })
  const root = createRoot(host)
  return { host, grid, root, columns: extraCols }
}

describe("TreeTable", () => {
  it("renders the tree with a twisty on expandable rows", async () => {
    const { host, grid, root } = mountTree(tree)
    await act(async () => root.render(<TreeTable grid={grid} columns={columns} scrollMode="internal" />))

    expect(document.querySelectorAll("[data-testid=tree-row]").length).toBe(2)
    expect(page.getByTestId("toggle-src")).toBeInTheDocument()
    expect(document.querySelector("[data-testid=toggle-pkg]")).toBeNull()

    root.unmount()
    host.remove()
  })

  it("expands and collapses via the toggleExpand column and the twisty", async () => {
    const { host, grid, root } = mountTree(tree)
    await act(async () => root.render(<TreeTable grid={grid} columns={columns} scrollMode="internal" />))

    await act(async () => { await page.getByText("src").click() })
    expect(document.querySelectorAll("[data-testid=tree-row]").length).toBe(4)
    expect(grid.state.$().expanded).toEqual({ src: true })

    await act(async () => { await page.getByTestId("toggle-src").click() })
    expect(document.querySelectorAll("[data-testid=tree-row]").length).toBe(2)

    root.unmount()
    host.remove()
  })

  it("keeps the sticky header pinned to the scroll container after scrolling", async () => {
    const many: Node[] = Array.from({ length: 60 }, (_, i) => ({
      id: `f${i}`, name: `file-${i}.ts`, kind: "file", size: i,
    }))
    const { host, grid, root } = mountTree(many)
    await act(async () => root.render(<TreeTable grid={grid} columns={columns} scrollMode="internal" maxHeight={200} />))
    await act(settleLayout)

    const container = document.querySelector<HTMLElement>("[data-testid=tree-table]")!
    expect(container.scrollHeight).toBeGreaterThan(container.clientHeight)
    await act(async () => {
      container.scrollTop = 300
      container.dispatchEvent(new Event("scroll"))
      await settleLayout()
    })
    const theadTop = document.querySelector("[data-testid=tree-table-header]")!.getBoundingClientRect().top
    const containerTop = container.getBoundingClientRect().top
    expect(Math.abs(theadTop - containerTop)).toBeLessThanOrEqual(1)

    root.unmount()
    host.remove()
  })

  it("renders a full-width detail region under an expanded row", async () => {
    const { host, grid, root } = mountTree(tree)
    const renderDetail = (n: Node) => <div data-testid="detail-content">{n.name} detail</div>
    await act(async () => root.render(<TreeTable grid={grid} columns={columns} scrollMode="internal" renderDetail={renderDetail} />))

    expect(document.querySelector("[data-testid=tree-detail-row]")).toBeNull()
    await act(async () => { await page.getByTestId("toggle-src").click() })

    const detailRow = document.querySelector<HTMLElement>("[data-testid=tree-detail-row]")!
    expect(detailRow).not.toBeNull()
    expect(detailRow.textContent).toContain("src detail")
    const cell = detailRow.querySelector("td")!
    expect(cell.style.getPropertyValue("--depth")).toBe("0")
    expect(getComputedStyle(cell).borderInlineStartWidth).not.toBe("0px")
    expect(parseFloat(getComputedStyle(cell).paddingInlineStart)).toBeGreaterThanOrEqual(12)

    root.unmount()
    host.remove()
  })

  it("hides a column from the visibility toolbar", async () => {
    const { host, grid, root } = mountTree(tree)
    await act(async () => root.render(
      <div>
        <ColumnVisibilityToolbar grid={grid} columns={columns} />
        <TreeTable grid={grid} columns={columns} scrollMode="internal" />
      </div>,
    ))

    expect(document.querySelectorAll("thead th").length).toBe(2)
    await act(async () => { await page.getByTestId("tree-visibility-item-size").getByRole("checkbox").click() })
    expect(document.querySelectorAll("thead th").length).toBe(1)
    expect(document.querySelectorAll("[data-testid=tree-row] td").length).toBe(2)

    root.unmount()
    host.remove()
  })

  it("keeps the twisty inside a narrow tree column at depth 12", async () => {
    let node: Node = { id: "leaf", name: "leaf.ts", kind: "file", size: 1 }
    for (let depth = 12; depth > 0; depth--) node = { id: `d${depth}`, name: `dir-${depth}`, kind: "folder", size: 0, children: [node] }
    const narrow: TreeColumn<Node>[] = [
      { id: "name", header: "Name", tree: true, cell: (n) => n.name, size: 120 },
      { id: "size", header: "Size", cell: (n) => String(n.size), size: 60 },
    ]
    const { host, grid, root } = mountTree([node], narrow)
    grid.onExpandedChange(true)
    await act(async () => root.render(<TreeTable grid={grid} columns={narrow} indentGuides />))
    await act(settleLayout)

    const deepest = document.querySelector<HTMLElement>("[data-testid=toggle-d12]")!
    const cell = deepest.closest("td")!
    expect(deepest.getBoundingClientRect().right).toBeLessThanOrEqual(cell.getBoundingClientRect().right)
    expect(document.querySelectorAll("[data-testid=tree-row]").length).toBe(13)

    root.unmount()
    host.remove()
  })

  it("virtualizes when the estimated extent exceeds the viewport, with 5000 rows", async () => {
    await page.viewport(1280, 800)
    document.body.style.margin = "0"
    const large: Node[] = Array.from({ length: 5000 }, (_, i) => ({
      id: `r${i}`, name: `row-${String(i).padStart(4, "0")}.ts`, kind: "file", size: i,
    }))
    const { host, grid, root } = mountTree(large)
    await act(async () => root.render(<TreeTable grid={grid} columns={columns} />))
    await act(settleLayout)

    const gridRoot = document.querySelector<HTMLElement>("[data-testid=tree-table]")!
    expect(gridRoot.getAttribute("data-scroll-mode")).toBe("external")
    expect(document.querySelector("[data-testid=tree-table-viewport]")).not.toBeNull()
    const mounted = document.querySelectorAll("[data-testid=tree-row]").length
    expect(mounted).toBeLessThan(100)
    expect(mounted).toBeGreaterThan(0)

    root.unmount()
    host.remove()
    document.body.removeAttribute("style")
  })
})
