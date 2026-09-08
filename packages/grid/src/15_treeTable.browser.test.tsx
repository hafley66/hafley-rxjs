import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { page } from "vitest/browser"
import { Signal } from "@hafley66/signals"
import { z } from "zod"
import { createGrid } from "./2_createGrid"
import { TreeTable } from "./12_treeTable"
import { ColumnVisibilityToolbar } from "./13_columnVisibilityToolbar"
import { treeColumnDefs, type TreeColumn } from "./10_treeColumn"

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
const settleSignals = () => new Promise<void>((resolve) => setTimeout(resolve, 40))

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

  it("drags a header handle into columnSizing without toggling the sort", async () => {
    const { host, grid, root } = mountTree(tree)
    await act(async () => root.render(<TreeTable grid={grid} columns={columns} scrollMode="internal" />))
    await act(settleLayout)

    const handle = document.querySelector<HTMLElement>("[data-testid=resize-name]")!
    const startSize = grid.state.$().columnSizing.name ?? 150
    const mouse = (type: string, clientX: number) => new MouseEvent(type, { bubbles: true, clientX, clientY: 5, button: 0 })
    await act(async () => {
      handle.dispatchEvent(mouse("mousedown", 100))
      document.dispatchEvent(mouse("mousemove", 160))
      document.dispatchEvent(mouse("mouseup", 160))
      handle.dispatchEvent(mouse("click", 160))
      await settleLayout()
    })

    expect(grid.state.$().columnSizing).toEqual({ name: startSize + 60 })
    expect(grid.state.$().sorting).toEqual([])
    const col = document.querySelector<HTMLTableColElement>("colgroup col")!
    expect(col.style.width).toBe(`${startSize + 60}px`)
    expect(document.querySelector("table")!.style.tableLayout).toBe("fixed")

    root.unmount()
    host.remove()
  })

  it("two TreeTables over one grid emit one select effect per click, none after unmount", async () => {
    const { host, grid, root } = mountTree(tree, columns)
    const gridOwned = createGrid<Node>({
      schema: NodeSchema,
      rows: grid.rows,
      columnDefs: treeColumnDefs(columns),
      getRowId: (n) => n.id,
      getSubRows: (n) => n.children,
      mode: "client",
    })
    const selects: string[] = []
    const seen = gridOwned.epicCtx.phase$.effect.subscribe((a) => selects.push(`${a.type}:${a.row.id}`))
    await act(async () => root.render(<><TreeTable grid={gridOwned} scrollMode="internal" /><TreeTable grid={gridOwned} scrollMode="internal" /></>))
    await act(settleLayout)

    await act(async () => document.querySelector<HTMLElement>("[data-row-id=pkg] td[data-column=name]")!.click())
    expect(selects).toEqual(["select:pkg"])

    root.unmount()
    await act(async () => gridOwned.dispatch({ phase: "intent", type: "cell.click", column: "name", rowId: "pkg", row: tree[1]!, mods: { alt: false, ctrl: false, meta: false, shift: false, button: 0 } }))
    expect(selects).toEqual(["select:pkg"])
    seen.unsubscribe()
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

  it("sorts a numeric column both ways at every depth", async () => {
    const nodes: Node[] = [
      { id: "p", name: "p", kind: "folder", size: 0, children: [
        { id: "f", name: "f", kind: "folder", size: 5, children: [
          { id: "a", name: "a", kind: "file", size: 1 }, { id: "b", name: "b", kind: "file", size: 3 }, { id: "c", name: "c", kind: "file", size: 2 },
        ] },
        { id: "g", name: "g", kind: "file", size: 9 },
      ] },
    ]
    const numeric: TreeColumn<Node>[] = [
      { id: "name", header: "Name", tree: true, cell: (n) => n.name },
      { id: "size", header: "Size", cell: (n) => String(n.size), value: (n) => n.size },
    ]
    const { host, grid, root } = mountTree(nodes, numeric)
    grid.onExpandedChange(true)
    await act(async () => root.render(<TreeTable grid={grid} columns={numeric} scrollMode="internal" />))
    const order = () => [...document.querySelectorAll("[data-testid=tree-row]")].map((r) => r.getAttribute("data-row-id")).join(",")
    expect(order()).toBe("p,f,a,b,c,g")
    // useSignal throttles on animation frames; give the sort change one throttle window to land
    const clickSize = async () => {
      await act(async () => document.querySelector<HTMLElement>("th[data-column=size]")!.click())
      await act(settleSignals)
    }
    await clickSize()
    const first = grid.state.$().sorting
    expect(first).toHaveLength(1)
    expect(order()).toBe(first[0]!.desc ? "p,g,f,b,c,a" : "p,f,a,c,b,g")
    await clickSize()
    expect(grid.state.$().sorting[0]!.desc).toBe(!first[0]!.desc)
    expect(order()).toBe(first[0]!.desc ? "p,f,a,c,b,g" : "p,g,f,b,c,a")

    root.unmount()
    host.remove()
  })

  it("follows an overflow:auto ancestor's scroll when virtualized", async () => {
    await page.viewport(1280, 800)
    const large: Node[] = Array.from({ length: 2000 }, (_, i) => ({ id: `r${i}`, name: `row-${i}`, kind: "file", size: i }))
    const { host, grid, root } = mountTree(large)
    host.style.cssText = "height: 400px; overflow: auto; border: 1px solid red"
    await act(async () => root.render(<TreeTable grid={grid} columns={columns} />))
    await act(settleLayout)

    expect(document.querySelector("[data-testid=tree-table]")!.getAttribute("data-scroll-mode")).toBe("external")
    const rowAt = (y: number) => document.elementFromPoint(300, y)?.closest("[data-testid=tree-row]")?.getAttribute("data-row-index")
    const top = host.getBoundingClientRect().top
    expect(rowAt(top + 100)).toBe("2")
    await act(async () => {
      host.scrollTop = 3000
      host.dispatchEvent(new Event("scroll"))
      await settleLayout()
      await settleLayout()
    })
    const index = Number(rowAt(top + 100))
    // 3000px into 34px rows lands near row 88; the viewport must show that neighborhood, not the top of the list
    expect(index).toBeGreaterThan(80)
    expect(index).toBeLessThan(100)

    root.unmount()
    host.remove()
  })

  it("keeps following the ancestor's scroll when measured rows are taller than the estimate", async () => {
    await page.viewport(1280, 800)
    const large: Node[] = Array.from({ length: 2000 }, (_, i) => ({ id: `r${i}`, name: `row-${i}`, kind: "file", size: i }))
    const twoLine: TreeColumn<Node>[] = [
      { id: "name", header: "Name", tree: true, cell: (n) => (n.size % 3 === 0 ? <span style={{ display: "block", lineHeight: "16px" }}>{n.name}<br />second line</span> : n.name) },
      { id: "size", header: "Size", cell: (n) => String(n.size) },
    ]
    const { host, grid, root } = mountTree(large, twoLine)
    host.style.cssText = "height: 400px; overflow: auto"
    const spacer = document.createElement("div")
    spacer.style.height = "22px"
    host.prepend(spacer)
    await act(async () => root.render(<TreeTable grid={grid} columns={twoLine} density="compact" />))
    await act(settleLayout)
    const rowAt = (y: number) => Number(document.elementFromPoint(300, y)?.closest("[data-testid=tree-row]")?.getAttribute("data-row-index"))
    const top = host.getBoundingClientRect().top
    const scrollTo = async (px: number) => {
      await act(async () => {
        host.scrollTop = px
        host.dispatchEvent(new Event("scroll"))
        await settleLayout()
        await settleLayout()
        await settleSignals()
      })
    }
    await scrollTo(1000)
    const at1000 = rowAt(top + 100)
    await scrollTo(3000)
    const at3000 = rowAt(top + 100)
    await scrollTo(6000)
    const at6000 = rowAt(top + 100)
    // ~30px average rows: each step of 2000-3000px must move the viewport by dozens of rows
    expect(at3000 - at1000).toBeGreaterThan(40)
    expect(at6000 - at3000).toBeGreaterThan(60)

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
