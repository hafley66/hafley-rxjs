// Chromium under `vitest.browser.config.ts`, because `sync` opens a window listener and the leak
// this file guards against is exactly that listener outliving the grid, and because the last
// describe clicks a glyph through a real delegation chain. Every other assertion here is
// environment-free.
//
// This file owns the shape of the default orientation for the whole suite: what a sort write, a
// page write, a pin, a hide, and server mode each do to the view chain. `12_transpose.test.ts`
// used to restate all of it before asserting the transpose, and now asserts only what moves.
//
// Every assertion is a synchronous `.$()` read. Computed signals recompute lazily on read, so a
// pipeline stage is asserted without observing it, which is why nothing here subscribes.
import { describe, expect, it } from "vitest"
import { Subscription, skip, type Observable } from "rxjs"
import { Signal } from "@hafley66/signals"
import { defaultState, grid, type Grid } from "./8_grid.js"
import { headerGroup } from "./18_bands.js"
import {
  COLUMNS,
  FLAT,
  TREE,
  at,
  flatGrid,
  headerClick,
  headerDown,
  keysOf,
  pointerStreams,
  treeGrid,
  withEpics,
  type Row,
} from "./test/0_kit.js"
import { cellAttrs, expandAttrs, gridAttrs, rowAttrs } from "./3_paths.js"
import type { GridState, Orientation } from "./0_types.js"

// `urlAdapter` reaches the window through `fromEvent`, so the leak is a listener count and the
// only way to assert it is to count them. No engine publishes that tally, so the pair is wrapped
// and the assertions read a delta across one construction rather than an absolute.
let live = 0
const realAdd = window.addEventListener.bind(window)
const realRemove = window.removeEventListener.bind(window)
window.addEventListener = ((...args: Parameters<typeof realAdd>) => {
  live++
  return realAdd(...args)
}) as typeof window.addEventListener
window.removeEventListener = ((...args: Parameters<typeof realRemove>) => {
  live--
  return realRemove(...args)
}) as typeof window.removeEventListener
const listenerCount = (): number => live

describe("inputs accept any source shape", () => {
  it("a plain array becomes a writable signal", () => {
    const g = flatGrid()
    expect(g.rows.$().length).toBe(3)
  })

  it("an adopted signal stays the same instance, so the caller can still write it", () => {
    const rows = Signal<readonly Row[]>(FLAT)
    const g = grid<Row>({ id: "t", rows, columns: COLUMNS, rowId: (r) => r.id })
    expect(g.rows).toBe(rows)
    rows.$([])
    expect(keysOf(g.view.flat.$())).toEqual([])
  })

  it("a thunk becomes a computed that re-derives from what it read", () => {
    const source = Signal<readonly Row[]>(FLAT)
    const g = grid<Row>({
      id: "t",
      rows: () => source.$().filter((r) => r.size > 15),
      columns: COLUMNS,
      rowId: (r) => r.id,
    })
    expect(keysOf(g.view.flat.$())).toEqual(["c", "b"])
    source.$([{ id: "z", name: "z", size: 99 }])
    expect(keysOf(g.view.flat.$())).toEqual(["z"])
  })
})

describe("state is one signal reached by proxy dots", () => {
  it("a nested write lands and the view recomputes without any subscription", () => {
    const g = flatGrid()
    expect(keysOf(g.view.flat.$())).toEqual(["c", "a", "b"])
    g.state.sort.$([{ field: "size", sort: "asc" }])
    expect(keysOf(g.view.flat.$())).toEqual(["a", "b", "c"])
    // Descending is a negation of the same comparator, not a second one, so it belongs to the
    // same case as the write that reaches it.
    g.state.sort.$([{ field: "name", sort: "desc" }])
    expect(keysOf(g.view.flat.$())).toEqual(["c", "b", "a"])
  })

  it("there are no onChange pairs: writing the signal is the whole api", () => {
    const g = flatGrid()
    g.state.colHidden.size.$(true)
    expect(keysOf(g.view.cols.$())).toEqual(["name"])
  })
})

describe("a state signal is controlled in both directions", () => {
  const withState = (state: Partial<GridState> | Signal<Partial<GridState>>): Grid<Row> =>
    grid<Row>({ id: "t", rows: FLAT, columns: COLUMNS, rowId: (r) => r.id, state })

  it("seeds from the first value, as it always did", () => {
    const g = withState({ density: "compact" })
    expect(g.state.density.$()).toBe("compact")
  })

  it("a later emission reaches the grid's own state", () => {
    const source = Signal<Partial<GridState>>({ density: "compact" })
    const g = withState(source)
    source.$({ density: "comfortable" })
    expect(g.state.density.$()).toBe("comfortable")
  })

  it("an emission arrives as a change, so `change$` reports it", () => {
    const source = Signal<Partial<GridState>>({})
    const g = withState(source)
    const seen: string[] = []
    const sub = g.change$.subscribe((it) => seen.push(it.type))
    source.$({ listView: true })
    sub.unsubscribe()
    expect(seen).toEqual(["listView"])
  })

  it("leaves a key the source never sends, so a sort the user made survives", () => {
    const source = Signal<Partial<GridState>>({})
    const g = withState(source)
    g.state.sort.$([{ field: "size", sort: "asc" }])
    source.$({ colHidden: { size: true } })
    expect(g.state.sort.$()).toEqual([{ field: "size", sort: "asc" }])
    expect(keysOf(g.view.cols.$())).toEqual(["name"])
  })

  it("wins on a key it does send, even one the user just changed", () => {
    const source = Signal<Partial<GridState>>({})
    const g = withState(source)
    g.state.sort.$([{ field: "size", sort: "asc" }])
    source.$({ sort: [{ field: "name", sort: "desc" }] })
    expect(keysOf(g.view.flat.$())).toEqual(["c", "b", "a"])
  })

  it("takes an explicit undefined as no claim on the key rather than a reset", () => {
    const source = Signal<Partial<GridState>>({})
    const g = withState(source)
    g.state.density.$("compact")
    source.$({ density: undefined })
    expect(g.state.density.$()).toBe("compact")
  })

  it("a user's sort reaches the caller's signal", () => {
    const held = Signal<Partial<GridState>>({})
    const { g } = withEpics(withState(held))
    g.dispatch(headerClick("size"))
    expect(held.$().sort).toEqual([{ field: "size", sort: "asc" }])
  })

  it("a user's resize reaches the caller's signal on the lift, and the preview does too", () => {
    const held = Signal<Partial<GridState>>({})
    const { move$, up$ } = pointerStreams()
    const { g } = withEpics(withState(held))
    g.dispatch(headerDown("name", "resize", 0))
    move$.next(at({ clientX: 30 }))
    expect(held.$().drag).toEqual({ kind: "colSize", col: "name", width: 150 })
    expect(held.$().colWidth).toBeUndefined()
    up$.next(at({ clientX: 30 }))
    expect(held.$().colWidth).toEqual({ name: 150 })
    expect(held.$().drag).toBe(null)
  })

  it("one header click is one emission, because the write back cannot come round again", () => {
    const held = Signal<Partial<GridState>>({})
    const { g } = withEpics(withState(held))
    const seen: Partial<GridState>[] = []
    // `skip(1)` drops the replay every subscriber of a state signal receives on arrival.
    const sub = held.$.pipe(skip(1)).subscribe((it: Partial<GridState>) => seen.push(it))
    g.dispatch(headerClick("size"))
    sub.unsubscribe()
    expect(seen.length).toBe(1)
    expect(seen[0]?.sort).toEqual([{ field: "size", sort: "asc" }])
  })

  it("stops both directions at close, so neither side reaches the other", () => {
    const held = Signal<Partial<GridState>>({})
    const { g } = withEpics(withState(held))
    g.close()
    held.$({ listView: true })
    expect(g.state.listView.$()).toBe(false)
    g.dispatch(headerClick("size"))
    expect(g.state.sort.$()).toEqual([{ field: "size", sort: "asc" }])
    expect(held.$().sort).toBeUndefined()
  })

  it("a plain object is still a seed and nothing more", () => {
    const seed: Partial<GridState> = { density: "compact" }
    const g = withState(seed)
    g.state.density.$("comfortable")
    expect(g.state.density.$()).toBe("comfortable")
    expect(seed).toEqual({ density: "compact" })
  })
})

describe("tree mode is one config key", () => {
  it("closed nodes hide their subtree, so the flat list shrinks", () => {
    const g = treeGrid()
    expect(keysOf(g.view.flat.$())).toEqual(["src", "readme"])
  })

  it("opening a node reveals exactly its children, with depth and hasChildren off the forest", () => {
    const g = treeGrid()
    g.state.expanded.src.$(true)
    const nodes = g.view.flat.$()
    expect(nodes.map((n) => [n.key, n.depth, n.hasChildren])).toEqual([
      ["src", 0, true],
      ["src/a", 1, false],
      ["src/b", 1, true],
      ["readme", 0, false],
    ])
  })
})

describe("paging is one operator with three retention rules", () => {
  it("paging narrows the rendered plan", () => {
    const g = flatGrid()
    // virtualize off: this asserts the paging window, and a zero-height viewport would
    // otherwise empty the render window for reasons that have nothing to do with paging.
    g.state.virtualize.vertical.$(false)
    g.state.page.$({ mode: "pages", index: 1, size: 2, total: null })
    expect(g.view.plan.$().center).toEqual(["b"])
  })
})

describe("virtualization is a toggle over the same kernel", () => {
  it("off renders every row in the page", () => {
    const g = flatGrid()
    g.state.virtualize.vertical.$(false)
    expect(g.view.plan.$().center).toEqual(["c", "a", "b"])
  })

  it("on with an unmeasured viewport renders nothing rather than everything", () => {
    // A zero extent is a viewport nobody has measured yet, so the window is empty at the scroll
    // anchor. The spacer still measures the whole run, which is what lets the first scroll happen.
    const g = flatGrid()
    const plan = g.view.plan.$()
    expect(plan.center).toEqual([])
    expect(plan.span).toEqual({ start: 0, end: 0 })
    expect(plan.centerTotal).toBe(3 * 36)
  })

  it("the toggle changes nothing else in the chain", () => {
    const g = flatGrid()
    const before = keysOf(g.view.flat.$())
    g.state.virtualize.vertical.$(false)
    expect(keysOf(g.view.flat.$())).toEqual(before)
  })
})

describe("pinning survives paging", () => {
  it("a pinned row stays pinned on a page it does not belong to", () => {
    const g = flatGrid()
    g.state.virtualize.vertical.$(false)
    // rows are c, a, b. Pin `b`, then ask for the first page of one row.
    g.state.rowPinning.b.$("end")
    g.state.page.$({ mode: "pages", index: 0, size: 1, total: null })
    const plan = g.view.plan.$()
    expect(plan.end).toEqual(["b"])
    expect(plan.center).toEqual(["c"])
  })

  it("pinning is lifted out before paging, so the page still holds `size` unpinned rows", () => {
    const g = flatGrid()
    g.state.virtualize.vertical.$(false)
    g.state.rowPinning.c.$("start")
    g.state.page.$({ mode: "pages", index: 0, size: 2, total: null })
    const plan = g.view.plan.$()
    expect(plan.start).toEqual(["c"])
    expect(plan.center).toEqual(["a", "b"])
  })
})

describe("server mode skips the stages the server already ran", () => {
  it("sorting is not re-applied locally, so the page keeps server order", () => {
    const g = grid<Row>({ id: "t", mode: "server", rows: FLAT, columns: COLUMNS, rowId: (r) => r.id })
    g.state.sort.$([{ field: "size", sort: "asc" }])
    expect(keysOf(g.view.flat.$())).toEqual(["c", "a", "b"])
  })

  it("the query descriptor carries what the caller must send upstream", () => {
    const g = grid<Row>({ id: "t", mode: "server", rows: FLAT, columns: COLUMNS, rowId: (r) => r.id, rowCount: 400 })
    g.state.sort.$([{ field: "size", sort: "asc" }])
    g.state.page.$({ mode: "infinite", index: 1, size: 50, total: null })
    expect(g.query.$()).toEqual({
      sort: [{ field: "size", sort: "asc" }],
      group: [],
      page: { mode: "infinite", index: 1, size: 50, total: 400 },
      expand: null,
    })
  })

  it("the page is not cut twice: server mode renders the rows it was handed", () => {
    const g = grid<Row>({
      id: "t",
      mode: "server",
      rows: FLAT,
      columns: COLUMNS,
      rowId: (r) => r.id,
      state: { virtualize: { vertical: false, horizontal: false } },
    })
    // The caller asked upstream for page 1 of size 2 and appended what came back. Paginating that
    // answer again takes `[2, 4)` of a three-row response, which used to render nothing.
    g.state.page.$({ mode: "pages", index: 1, size: 2, total: null })
    expect(g.view.plan.$().center).toEqual(["c", "a", "b"])
  })

  it("pinning and virtualization still apply in server mode, because both are client concerns", () => {
    const g = grid<Row>({
      id: "t",
      mode: "server",
      rows: FLAT,
      columns: COLUMNS,
      rowId: (r) => r.id,
      state: { virtualize: { vertical: false, horizontal: false } },
    })
    g.state.page.$({ mode: "pages", index: 1, size: 2, total: null })
    g.state.rowPinning.a.$("start")
    const plan = g.view.plan.$()
    expect(plan.start).toEqual(["a"])
    expect(plan.center).toEqual(["c", "b"])
  })

  it("client mode does apply the same sort", () => {
    const g = flatGrid()
    g.state.sort.$([{ field: "size", sort: "asc" }])
    expect(keysOf(g.view.flat.$())).toEqual(["a", "b", "c"])
  })
})

describe("columns are the same five operators on the other axis", () => {
  it("explicit order wins over declaration order", () => {
    const g = flatGrid()
    g.state.colOrder.$(["size", "name"])
    expect(keysOf(g.view.cols.$())).toEqual(["size", "name"])
  })

  it("a header group becomes a parent edge in the column forest", () => {
    const g = grid<Row>({
      id: "t",
      rows: FLAT,
      rowId: (r) => r.id,
      columns: [
        headerGroup<Row>({ id: "meta" }),
        { id: "name", group: "meta" },
        { id: "size", group: "meta" },
      ],
    })
    const nodes = g.view.cols.$()
    expect(nodes.map((n) => [n.key, n.depth])).toEqual([["meta", 0], ["name", 1], ["size", 1]])
  })

  // The scroll frame is where the sheet demo spent 440 ms of the 16 it had: the pinning cut, the
  // page cut and the sizer all walk the relation, and they sat in the same memo as the window.
  // The sizer is the one of the three the plan hands back, so its identity is the probe.
  it("a scroll windows the same base rather than rebuilding it", () => {
    const g = flatGrid()
    g.state.virtualize.$({ vertical: true, horizontal: false })
    g.viewport.$({ top: 0, left: 0, width: 400, height: 200 })
    const first = g.view.plan.$()
    g.viewport.$({ top: 180, left: 0, width: 400, height: 200 })
    const second = g.view.plan.$()
    expect(second.span).not.toEqual(first.span)
    expect(second.sizer).toBe(first.sizer)
  })

  it("a row height write does rebuild the base", () => {
    const g = flatGrid()
    g.state.virtualize.$({ vertical: true, horizontal: false })
    g.viewport.$({ top: 0, left: 0, width: 400, height: 200 })
    const first = g.view.plan.$()
    g.state.rowHeight.$({ ...g.state.rowHeight.$(), [FLAT[1]!.id]: 90 })
    expect(g.view.plan.$().sizer).not.toBe(first.sizer)
  })

  it("width overrides beat the column definition", () => {
    const g = flatGrid()
    g.viewport.$({ top: 0, left: 0, width: 400, height: 200 })
    g.state.colWidth.name.$(300)
    expect(g.view.widths.$().get("name")).toBe(300)
  })
})

describe("the constructor hands back what it opened", () => {
  it("a grid with no sync still closes, and closing twice is safe", () => {
    const g = flatGrid()
    expect(() => {
      g.close()
      g.close()
    }).not.toThrow()
  })

  it("closing a synced grid releases the listener its url adapter opened", () => {
    const before = listenerCount()
    const g = grid<Row>({ id: "t", rows: FLAT, columns: COLUMNS, rowId: (r) => r.id, sync: "sg" })
    expect(listenerCount()).toBeGreaterThan(before)
    g.close()
    expect(listenerCount()).toBe(before)
    // Idempotent, because a consumer unmounting twice is a framework detail, not a bug report.
    g.close()
    expect(listenerCount()).toBe(before)
  })

  it("a closed grid still reads and writes its own state", () => {
    const g = grid<Row>({ id: "t", rows: FLAT, columns: COLUMNS, rowId: (r) => r.id, sync: "sg2" })
    g.close()
    g.state.sort.$([{ field: "size", sort: "asc" }])
    expect(keysOf(g.view.flat.$())).toEqual(["a", "b", "c"])
  })
})

describe("defaults", () => {
  it("a fresh state is inert: no sort, no group, everything visible", () => {
    const s = defaultState()
    expect([s.sort.length, s.group.length, s.page.mode, s.virtualize.vertical]).toEqual([0, 0, "all", true])
  })
})

// The one describe in this file that subscribes. A missing notification is the absence of an
// emission, and no synchronous read can see one.
describe("an orientation write reaches every stage that seats an axis", () => {
  type Stage = "vertical" | "horizontal" | "plan" | "cols"

  const STAGES: readonly Stage[] = ["vertical", "horizontal", "plan", "cols"]

  const streamsOf = (target: Grid<Row>): Record<Stage, Observable<unknown>> => ({
    vertical: target.view.vertical.$,
    horizontal: target.view.horizontal.$,
    plan: target.view.plan.$,
    cols: target.view.cols.$,
  })

  // `10_render.ts` folds the whole view into one computed and subscribes it before any consumer
  // reaches a stage directly, so the renderer pulls each stage on the way past.
  const renderShaped = (target: Grid<Row>): Observable<unknown> =>
    Signal(() => [
      target.view.cols.$(),
      target.view.horizontal.$(),
      target.view.vertical.$(),
      target.view.plan.$(),
    ]).$

  const CASES: readonly { name: string; from: Orientation; to: Orientation; renderer: boolean }[] = [
    { name: "rows to columns, nothing else observing", from: "rows", to: "columns", renderer: false },
    { name: "columns to rows, nothing else observing", from: "columns", to: "rows", renderer: false },
    { name: "rows to columns, a renderer observing first", from: "rows", to: "columns", renderer: true },
    { name: "columns to rows, a renderer observing first", from: "columns", to: "rows", renderer: true },
  ]

  for (const testCase of CASES) {
    it(testCase.name, () => {
      const target = flatGrid({ orientation: testCase.from })
      const subs = new Subscription()
      if (testCase.renderer) subs.add(renderShaped(target).subscribe(() => {}))
      const counts: Record<Stage, number> = { vertical: 0, horizontal: 0, plan: 0, cols: 0 }
      const streams = streamsOf(target)
      for (const stage of STAGES) subs.add(streams[stage].subscribe(() => { counts[stage] += 1 }))
      const seeded = { ...counts }
      target.state.orientation.$(testCase.to)
      subs.unsubscribe()
      expect(STAGES.filter(stage => counts[stage] === seeded[stage])).toEqual([])
    })
  }
})


// Delegation is the only door into a grid, so a part the router cannot address is a feature no
// consumer can reach. Both cases below were found by clicking, not by reading.
describe("binding reaches every part the renderer draws", () => {
  const withAttrs = (
    tag: string,
    attrs: Readonly<Record<string, string>>,
    ...children: readonly HTMLElement[]
  ): HTMLElement => {
    const element = document.createElement(tag)
    for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value)
    element.append(...children)
    return element
  }

  const click = (element: HTMLElement): void => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  }

  it("opens a row from the glyph the run expander draws inside the first cell", () => {
    const target = treeGrid()
    const glyph = withAttrs("span", expandAttrs())
    const root = withAttrs(
      "div",
      gridAttrs("t"),
      withAttrs("div", rowAttrs("src"), withAttrs("div", cellAttrs("name"), glyph)),
    )
    document.body.append(root)
    const release = target.bind(root)
    click(glyph)
    release()
    root.remove()
    expect(target.state.expanded.$()).toEqual({ src: true })
  })

  it("still opens a row from the routeless cell an expandColumn renders", () => {
    const target = treeGrid()
    const glyph = withAttrs("span", expandAttrs())
    const root = withAttrs("div", gridAttrs("t"), withAttrs("div", rowAttrs("src"), glyph))
    document.body.append(root)
    const release = target.bind(root)
    click(glyph)
    release()
    root.remove()
    expect(target.state.expanded.$()).toEqual({ src: true })
  })

  it("keeps a grid inside a grid on its own chain", () => {
    const outer = treeGrid()
    const inner = grid<Row>({
      id: "inner",
      rows: TREE,
      columns: COLUMNS,
      rowId: (row) => row.id,
      subRows: (row) => row.kids,
    })
    const glyph = withAttrs("span", expandAttrs())
    const innerRoot = withAttrs(
      "div",
      gridAttrs("inner"),
      withAttrs("div", rowAttrs("readme"), withAttrs("div", cellAttrs("name"), glyph)),
    )
    const outerRoot = withAttrs(
      "div",
      gridAttrs("t"),
      withAttrs("div", rowAttrs("src"), withAttrs("div", cellAttrs("name"), innerRoot)),
    )
    document.body.append(outerRoot)
    const release = [outer.bind(outerRoot), inner.bind(innerRoot)]
    click(glyph)
    for (const stop of release) stop()
    outerRoot.remove()
    expect([inner.state.expanded.$(), outer.state.expanded.$()]).toEqual([{ readme: true }, {}])
  })
})
