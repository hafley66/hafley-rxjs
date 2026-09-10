// Synchronous throughout. Nothing here subscribes except `withEpics`, the suite's one `epics$`
// helper, and only where an epic has to be reached at all.
import { describe, expect, it } from "vitest"
import { axisOfEntries, axisOfTree, flattenAxis } from "./1_axis.js"
import { measuredSizer, renderPlan } from "./4_slice.js"
import { defaultEpics, type GridEpic } from "./7_epics.js"
import { defaultState, grid } from "./8_grid.js"
import { cellClick, withEpics } from "./test/0_kit.js"
import {
  DETAIL_PREFIX,
  closeDetail,
  detailHeights,
  detailKeyFor,
  detailOnCellClick,
  isDetailKey,
  openDetail,
  rowOfDetailKey,
  toggleDetail,
  withDetail,
  type DetailEpicOptions,
  type DetailOpen,
} from "./11_detail.js"
import type { GridState, RowCtx, Slot } from "./0_types.js"

type Row = { id: string; name: string; kids?: Row[] }

const FLAT: readonly Row[] = [{ id: "a", name: "alice" }, { id: "b", name: "bob" }]

const TREE: readonly Row[] = [
  { id: "src", name: "src", kids: [{ id: "src/a", name: "a.ts" }, { id: "src/b", name: "b.ts" }] },
  { id: "readme", name: "readme.md" },
]

const flatAxis = () => axisOfEntries(FLAT.map((row) => [row.id, row] as const))
const treeAxis = () => axisOfTree(TREE, (r) => r.id, (r) => r.kids)

const keysOf = (axis: ReturnType<typeof flatAxis>, open: (key: string) => boolean = () => true) =>
  flattenAxis(axis, open).map((n) => n.key)

const stateOf = (detail: DetailOpen): GridState => ({ ...defaultState(), detail })

describe("detail keys", () => {
  it("round-trips a row id", () => {
    expect(rowOfDetailKey(detailKeyFor("a"))).toBe("a")
    expect(isDetailKey(detailKeyFor("a"))).toBe(true)
  })

  it("cannot be reached by a RowId that looks like one", () => {
    const lookalike = "d:2"
    expect(isDetailKey(lookalike)).toBe(false)
    expect(isDetailKey(DETAIL_PREFIX.slice(1) + "x")).toBe(false)
    expect(detailKeyFor(lookalike)).not.toBe(lookalike)
    expect(rowOfDetailKey(detailKeyFor(lookalike))).toBe(lookalike)
  })

  it("answers itself when handed a key that is not one", () => {
    expect(rowOfDetailKey("a")).toBe("a")
  })

  it("keeps its namespace off a group key", () => {
    expect(isDetailKey("g:[1]")).toBe(false)
  })
})

describe("openDetail, closeDetail, toggleDetail", () => {
  it("records which cell opened the panel", () => {
    expect(openDetail(stateOf({}), "a", "name").detail).toEqual({ a: "name" })
  })

  it("closes by deleting the row, so the open set is the key set", () => {
    const next = closeDetail(stateOf({ a: "name", b: "size" }), "a").detail ?? {}
    expect(Object.keys(next)).toEqual(["b"])
  })

  it("closes when the same cell is clicked twice", () => {
    const once = toggleDetail(stateOf({}), "a", "name").detail ?? {}
    expect(once).toEqual({ a: "name" })
    expect(toggleDetail({ detail: once }, "a", "name").detail).toEqual({})
  })

  it("swaps the column rather than closing when a different cell is clicked", () => {
    const open = toggleDetail(stateOf({}), "a", "name").detail ?? {}
    const swapped = toggleDetail({ detail: open }, "a", "size").detail ?? {}
    expect(swapped).toEqual({ a: "size" })
    expect(Object.keys(swapped)).toHaveLength(1)
  })

  it("leaves other rows open while one row swaps", () => {
    const start = { a: "name", b: "size" } as const
    expect(toggleDetail({ detail: start }, "a", "size").detail).toEqual({ a: "size", b: "size" })
  })
})

describe("withDetail", () => {
  it("returns the same axis when nothing is open", () => {
    const axis = flatAxis()
    expect(withDetail(axis, {}, () => FLAT[0])).toBe(axis)
  })

  it("inserts exactly one node per open row, directly after it", () => {
    const axis = withDetail(flatAxis(), { a: "name" }, (row) => ({ id: row, name: row }))
    expect(keysOf(axis)).toEqual(["a", detailKeyFor("a"), "b"])
    expect(axis.by.size).toBe(3)
  })

  it("inserts into the sibling list that holds the row, not into roots", () => {
    const axis = withDetail(treeAxis(), { "src/a": "name" }, (row) => ({ id: row, name: row }))
    expect(keysOf(axis)).toEqual(["src", "src/a", detailKeyFor("src/a"), "src/b", "readme"])
    expect(axis.parent.get(detailKeyFor("src/a"))).toBe("src")
  })

  it("hides the panel with the row, because it is a sibling and not a root", () => {
    const axis = withDetail(treeAxis(), { "src/a": "name" }, (row) => ({ id: row, name: row }))
    expect(keysOf(axis, (key) => key !== "src")).toEqual(["src", "readme"])
  })

  it("is idempotent", () => {
    const open: DetailOpen = { a: "name" }
    const make = (row: string): Row => ({ id: row, name: row })
    const once = withDetail(flatAxis(), open, make)
    expect(withDetail(once, open, make)).toBe(once)
  })

  it("skips a row whose `make` declined the panel", () => {
    const axis = flatAxis()
    expect(withDetail(axis, { a: "name" }, () => undefined)).toBe(axis)
  })

  it("skips a row the axis does not hold", () => {
    const axis = flatAxis()
    expect(withDetail(axis, { zz: "name" }, (row) => ({ id: row, name: row }))).toBe(axis)
  })

  it("gives the panel the value `make` returned", () => {
    const axis = withDetail(flatAxis(), { a: true }, (row) => ({ id: row, name: `panel:${row}` }))
    expect(axis.by.get(detailKeyFor("a"))?.name).toBe("panel:a")
  })

  it("opens two panels at once without disturbing order", () => {
    const axis = withDetail(flatAxis(), { a: "name", b: "name" }, (row) => ({ id: row, name: row }))
    expect(keysOf(axis)).toEqual(["a", detailKeyFor("a"), "b", detailKeyFor("b")])
  })
})

describe("virtualization sees the panel", () => {
  const heights = (keys: readonly string[], panel: number) => {
    const measured = new Map<number, number>()
    keys.forEach((key, i) => measured.set(i, isDetailKey(key) ? panel : 36))
    return measuredSizer(keys.length, 36, measured)
  }

  it("counts the panel's height in the scroll spacer and in the offset", () => {
    const open: DetailOpen = { a: "name" }
    const flat = keysOf(withDetail(flatAxis(), open, (row) => ({ id: row, name: row })))
    const plan = renderPlan<string>({
      flat,
      side: () => undefined,
      page: { index: 0, size: 100 },
      paginate: false,
      virtualize: true,
      sizer: (keys) => heights(keys, 320),
      viewport: { start: 0, extent: 1000 },
      overscan: 0,
    })
    expect(plan.center).toEqual(["a", detailKeyFor("a"), "b"])
    expect(plan.centerTotal).toBe(36 + 320 + 36)
  })

  it("puts the window inside the panel while the panel fills the viewport", () => {
    const open: DetailOpen = { a: "name" }
    const flat = keysOf(withDetail(flatAxis(), open, (row) => ({ id: row, name: row })))
    const plan = renderPlan<string>({
      flat,
      side: () => undefined,
      page: { index: 0, size: 100 },
      paginate: false,
      virtualize: true,
      sizer: (keys) => heights(keys, 320),
      viewport: { start: 200, extent: 36 },
      overscan: 0,
    })
    // A uniform index space would put 200px past the end of a two-row list, which is the drift the
    // panel's own index removes.
    expect(plan.center).toEqual([detailKeyFor("a")])
    expect(plan.offsetTop).toBe(36)
  })
})

describe("detailHeights", () => {
  it("names the panel key, not the row", () => {
    expect(detailHeights({ a: "name" }, 320)).toEqual({ [detailKeyFor("a")]: 320 })
  })

  it("merges over the heights already in state", () => {
    expect(detailHeights({ a: true }, 320, { b: 48 })).toEqual({
      b: 48,
      [detailKeyFor("a")]: 320,
    })
  })
})

describe("detailOnCellClick", () => {
  // Installed alongside `defaultEpics()`, which is the only way a consumer reaches it, so the
  // panel state is read back off the grid rather than off a hand-held stream. Nothing subscribes
  // except `withEpics`, and no `ctx` has to be faked.
  const gridWith = (opts: DetailEpicOptions, detail: DetailOpen = {}) =>
    withEpics(
      grid<Row>({
        id: "d",
        rows: FLAT,
        columns: [{ id: "name" }, { id: "__detail" }],
        rowId: (row) => row.id,
        state: { detail },
        epics: [...defaultEpics<Row>(), detailOnCellClick<Row>(opts) as GridEpic<Row>],
      }),
    )

  it("toggles the row the click landed on", () => {
    const { g } = gridWith({ columns: ["__detail"] })
    g.dispatch(cellClick("a", "__detail"))
    expect(g.state.detail.$()).toEqual({ a: "__detail" })
    g.dispatch(cellClick("a", "__detail"))
    expect(g.state.detail.$()).toEqual({})
  })

  it("swaps rather than closes under `swap`", () => {
    const { g } = gridWith({ mode: "swap" }, { a: "name" })
    g.dispatch(cellClick("a", "name"))
    expect(g.state.detail.$()).toEqual({ a: "name" })
  })

  it("ignores a column it was not asked about", () => {
    const { g } = gridWith({ columns: ["__detail"] })
    g.dispatch(cellClick("a", "name"))
    expect(g.state.detail.$()).toEqual({})
    g.dispatch(cellClick("b", "__detail"))
    expect(g.state.detail.$()).toEqual({ b: "__detail" })
  })
})

describe("a detail slot may host a whole nested grid", () => {
  it("builds a second grid inside the slot and derives it", () => {
    const outer = grid<Row>({ id: "outer", rows: TREE, columns: [{ id: "name" }], rowId: (r) => r.id })
    const built: string[] = []
    const detail: Slot<RowCtx<Row>> = (ctx) => {
      const sub = grid<Row>({
        id: `sub:${ctx.row}`,
        rows: ctx.data.kids ?? [],
        columns: [{ id: "name" }],
        rowId: (r) => r.id,
      })
      built.push(...sub.view.flat.$().map((n) => n.key))
      return sub.id.$()
    }
    const node = outer.view.flat.$()[0]
    if (node === undefined) throw new Error("the outer grid must have a first row")
    const data = outer.view.sorted.$().by.get(node.key)
    if (data === undefined) throw new Error("the first row must carry data")
    const out = detail({ row: node.key, data, node, selected: false, open: true })
    expect(out).toBe("sub:src")
    expect(built).toEqual(["src/a", "src/b"])
  })
})
