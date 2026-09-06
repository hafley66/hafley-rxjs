import { describe, expect, it } from "vitest"
import {
  treeColumnDefs,
  treeColumnMeta,
  visibilityEntries,
  toggleColumnVisibility,
  type TreeColumn,
} from "./10_treeColumn"

type Node = { id: string; name: string; size: number }

const columns: TreeColumn<Node>[] = [
  { id: "name", header: "Name", tree: true, toggleExpand: true, cell: (n) => n.name, sortValue: (n) => n.name },
  { id: "size", header: "Size", cell: (n) => String(n.size), size: 80, minSize: 40, maxSize: 200 },
  { id: "actions", header: "", cell: () => null, noRowClick: true },
]

describe("treeColumnDefs", () => {
  it("carries id, header, and size bounds through to the ColumnDef", () => {
    const defs = treeColumnDefs(columns)
    expect(defs.map((d) => d.id)).toEqual(["name", "size", "actions"])
    const sizeDef = defs.find((d) => d.id === "size")!
    expect(sizeDef.size).toBe(80)
    expect(sizeDef.minSize).toBe(40)
    expect(sizeDef.maxSize).toBe(200)
  })

  it("enables sorting only for columns with a sortValue, and sinks undefined last", () => {
    const defs = treeColumnDefs(columns)
    expect(defs.find((d) => d.id === "name")!.enableSorting).toBe(true)
    expect(defs.find((d) => d.id === "size")!.enableSorting).toBe(false)
    expect(defs.find((d) => d.id === "name")!.sortUndefined).toBe("last")
  })

  it("round-trips the original TreeColumn through columnDef.meta", () => {
    const defs = treeColumnDefs(columns)
    const meta = treeColumnMeta<Node>(defs.find((d) => d.id === "name"))
    expect(meta?.id).toBe("name")
    expect(meta?.tree).toBe(true)
  })

  it("returns undefined meta for a bare column def", () => {
    expect(treeColumnMeta(undefined)).toBeUndefined()
    expect(treeColumnMeta({})).toBeUndefined()
  })
})

describe("visibilityEntries", () => {
  it("defaults every column to visible when the visibility map is empty", () => {
    const entries = visibilityEntries(columns, {})
    expect(entries.every((e) => e.visible)).toBe(true)
  })

  it("marks a column hidden only when its visibility entry is explicitly false", () => {
    const entries = visibilityEntries(columns, { size: false })
    expect(entries.find((e) => e.id === "size")?.visible).toBe(false)
    expect(entries.find((e) => e.id === "name")?.visible).toBe(true)
  })

  it("marks the tree column as not hideable, and others as hideable", () => {
    const entries = visibilityEntries(columns, {})
    expect(entries.find((e) => e.id === "name")?.canHide).toBe(false)
    expect(entries.find((e) => e.id === "size")?.canHide).toBe(true)
  })
})

describe("toggleColumnVisibility", () => {
  it("flips a visible column to hidden", () => {
    expect(toggleColumnVisibility({}, "size")).toEqual({ size: false })
  })

  it("flips a hidden column back to visible", () => {
    expect(toggleColumnVisibility({ size: false }, "size")).toEqual({ size: true })
  })

  it("honors an explicit next value over the toggle", () => {
    expect(toggleColumnVisibility({}, "size", false)).toEqual({ size: false })
  })

  it("leaves other columns' visibility untouched", () => {
    expect(toggleColumnVisibility({ name: false }, "size")).toEqual({ name: false, size: false })
  })
})
