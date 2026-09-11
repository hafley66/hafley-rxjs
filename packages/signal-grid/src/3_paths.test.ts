// Node environment on purpose. Everything delegation needs a document for lives in
// tests/0_delegation.e2e.test.ts, against chromium; nothing here touches a DOM.
import { describe, expect, it } from "vitest"
import type { AnyPath } from "@hafley66/path"
import { Dom } from "@hafley66/xdom"
import {
  PATHS,
  SG_DEPTH,
  TEMPLATES,
  cellAttrs,
  checkAttrs,
  decodeVarId,
  encodeVarId,
  expandAttrs,
  gridAttrs,
  gridDom,
  headerAttrs,
  intentOf,
  modifiersOf,
  moveAttrs,
  resizeAttrs,
  rowAttrs,
  rowHeightVar,
  selectorFor,
  viewportAttrs,
} from "./3_paths.js"

const GRID = "files"
const ROW = "src/a.ts"
const COL = "size"

// `modifiersOf` and every `intentOf` member read named fields off their argument and never call a
// method on it, so a literal carrying those fields is the whole contract. Constructing a real
// MouseEvent would need a DOM, and a DOM here would be a second, weaker copy of the e2e suite.
type EventFields = {
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  button?: number
  clientX?: number
  clientY?: number
  key?: string
}

const NO_KEYS: EventFields = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false }

const fake = <T>(fields: Partial<EventFields> = {}): T =>
  ({ ...NO_KEYS, button: 0, ...fields }) as unknown as T

const withParams = <E, P>(event: E, params: P): E & { readonly params: P } =>
  Object.assign(event as object, { params }) as E & { readonly params: P }

describe("templates", () => {
  it("concatenates each child so it contains its parent", () => {
    expect(TEMPLATES).toEqual({
      grid: "/g/{gridId}",
      viewport: "/g/{gridId}/vp",
      header: "/g/{gridId}/h/{colId}",
      headerResize: "/g/{gridId}/h/{colId}/resize",
      headerMove: "/g/{gridId}/h/{colId}/move",
      row: "/g/{gridId}/r/{rowId}",
      expander: "/g/{gridId}/r/{rowId}/expand",
      rowCheck: "/g/{gridId}/r/{rowId}/check",
      rowMove: "/g/{gridId}/r/{rowId}/move",
      cell: "/g/{gridId}/r/{rowId}/c/{colId}",
      cellExpander: "/g/{gridId}/r/{rowId}/c/{colId}/expand",
    })
  })

  it("keeps every child template prefixed by its parent", () => {
    expect(TEMPLATES.cell.startsWith(TEMPLATES.row)).toBe(true)
    expect(TEMPLATES.row.startsWith(TEMPLATES.grid)).toBe(true)
    expect(TEMPLATES.headerResize.startsWith(TEMPLATES.header)).toBe(true)
    expect(TEMPLATES.cellExpander.startsWith(TEMPLATES.cell)).toBe(true)
  })
})

describe("print / match round trip", () => {
  const plain = { gridId: GRID, rowId: "r1", colId: COL }
  const awkward = { gridId: "a b", rowId: "src/a.ts", colId: "size ✓/x" }

  const cases: readonly (readonly [string, AnyPath, readonly string[]])[] = [
    ["grid", PATHS.grid, ["gridId"]],
    ["viewport", PATHS.viewport, ["gridId"]],
    ["header", PATHS.header, ["gridId", "colId"]],
    ["headerResize", PATHS.headerResize, ["gridId", "colId"]],
    ["headerMove", PATHS.headerMove, ["gridId", "colId"]],
    ["row", PATHS.row, ["gridId", "rowId"]],
    ["expander", PATHS.expander, ["gridId", "rowId"]],
    ["rowCheck", PATHS.rowCheck, ["gridId", "rowId"]],
    ["rowMove", PATHS.rowMove, ["gridId", "rowId"]],
    ["cell", PATHS.cell, ["gridId", "rowId", "colId"]],
    ["cellExpander", PATHS.cellExpander, ["gridId", "rowId", "colId"]],
  ]

  const pick = (source: Record<string, string>, names: readonly string[]) =>
    Object.fromEntries(names.map(name => [name, source[name] ?? ""]))

  // One case per path used to be one `it` per path, twenty of them. The loop moved inside, because
  // the table is the assertion and a failure names the path either way.
  const roundTrip = (source: Record<string, string>): void => {
    for (const [name, path, names] of cases) {
      const values = pick(source, names)
      expect({ name, ...path.match(path.print(values)) }).toEqual({ name, matched: true, values })
    }
  }

  it("prints and matches every template back to the values it was given", () => {
    roundTrip(plain)
  })

  it("survives a space, a slash, and a unicode character in every id", () => {
    roundTrip(awkward)
  })

  it("encodes a slash inside an id instead of adding a segment", () => {
    expect(PATHS.row.print({ gridId: GRID, rowId: ROW })).toBe("/g/files/r/src%2Fa.ts")
  })
})

describe("gridDom", () => {
  // The matching stream-identity claim (`.route.click` is one shared observable) needs a document
  // to build the listener, so it is asserted in tests/0_delegation.e2e.test.ts.
  it("hands back the cached Dom binding, so no second stream is built", () => {
    expect(gridDom(GRID).cell).toBe(Dom(TEMPLATES.cell))
    expect(gridDom(GRID).cell).toBe(gridDom(GRID).cell)
    expect(gridDom("other").cell).toBe(gridDom(GRID).cell)
  })

  it("carries the grid it was asked for", () => {
    expect(gridDom(GRID).gridId).toBe(GRID)
  })
})

describe("attrs", () => {
  it("puts the outer ids on the ancestors and nothing else on the inner elements", () => {
    expect(gridAttrs(GRID)).toEqual({
      "data-route": "g",
      "data-grid-id": GRID,
      "data-route-boundary": "",
    })
    expect(viewportAttrs()).toEqual({ "data-route": "vp" })
    expect(headerAttrs(COL)).toEqual({ "data-route": "h", "data-col-id": COL })
    expect(resizeAttrs()).toEqual({ "data-route": "resize" })
    expect(moveAttrs()).toEqual({ "data-route": "move" })
    expect(rowAttrs(ROW)).toEqual({ "data-route": "r", "data-row-id": ROW })
    expect(expandAttrs()).toEqual({ "data-route": "expand" })
    expect(checkAttrs()).toEqual({ "data-route": "check" })
    expect(cellAttrs(COL)).toEqual({ "data-route": "c", "data-col-id": COL })
  })

  it("derives a selector from the same bag", () => {
    expect(selectorFor("cell", { colId: COL })).toBe('[data-route="c"][data-col-id="size"]')
    expect(selectorFor("row", { rowId: ROW })).toBe('[data-route="r"][data-row-id="src/a.ts"]')
    expect(selectorFor("expander")).toBe('[data-route="expand"]')
    expect(selectorFor("header", { colId: 'a"b' })).toBe('[data-route="h"][data-col-id="a\\"b"]')
  })
})

describe("modifiersOf", () => {
  it("reads the four keys and the button off a mouse event", () => {
    const event = fake<MouseEvent>({ altKey: true, metaKey: true, button: 2 })
    expect(modifiersOf(event)).toEqual({
      alt: true,
      ctrl: false,
      meta: true,
      shift: false,
      button: 2,
    })
  })

  it("reports the primary button for a keyboard event, which has none", () => {
    // No `button` key at all, the way a KeyboardEvent has none: the `in` check is what is tested.
    const event = { ...NO_KEYS, ctrlKey: true, key: "ArrowDown" } as unknown as KeyboardEvent
    expect(modifiersOf(event)).toEqual({
      alt: false,
      ctrl: true,
      meta: false,
      shift: false,
      button: 0,
    })
  })
})

describe("intentOf", () => {
  const NO_MODS = { alt: false, ctrl: false, meta: false, shift: false, button: 0 }
  const cellParams = { gridId: GRID, rowId: ROW, colId: COL }
  const rowParams = { gridId: GRID, rowId: ROW }
  const colParams = { gridId: GRID, colId: COL }

  const pointer = (fields: Partial<EventFields> = {}) => fake<PointerEvent>(fields)

  const cellEvent = () => withParams(fake<MouseEvent>(), cellParams)
  const cellPointer = () => withParams(pointer(), cellParams)
  const rowEvent = () => withParams(fake<MouseEvent>(), rowParams)
  const colEvent = () => withParams(fake<MouseEvent>(), colParams)

  // Six members do one thing: copy the route params through and read the modifiers off the event.
  // One table asserts all six, and the seven below it each carry a rule of their own.
  it("copies the route params straight through and reads the modifiers off the event", () => {
    expect([
      intentOf["cell.click"](cellEvent()),
      intentOf["cell.dblclick"](cellEvent()),
      intentOf["cell.pointerdown"](cellPointer()),
      intentOf["header.click"](colEvent()),
      intentOf["expander.click"](rowEvent()),
      intentOf["checkbox.click"](rowEvent()),
    ]).toEqual([
      { phase: "intent", type: "cell.click", row: ROW, col: COL, mods: NO_MODS },
      { phase: "intent", type: "cell.dblclick", row: ROW, col: COL, mods: NO_MODS },
      { phase: "intent", type: "cell.pointerdown", row: ROW, col: COL, mods: NO_MODS },
      { phase: "intent", type: "header.click", col: COL, mods: NO_MODS },
      { phase: "intent", type: "expander.click", row: ROW, mods: NO_MODS },
      { phase: "intent", type: "checkbox.click", row: ROW, mods: NO_MODS },
    ])
  })

  it("drops the modifiers from a range-drag hover, which the pointerdown already stated", () => {
    expect(intentOf["cell.pointerenter"](cellPointer())).toEqual({
      phase: "intent", type: "cell.pointerenter", row: ROW, col: COL,
    })
  })

  it("takes the drag part from the template that matched, not from the event", () => {
    const event = withParams(pointer({ clientX: 42 }), colParams)
    expect(intentOf["header.pointerdown"](event, "resize")).toEqual({
      phase: "intent",
      type: "header.pointerdown",
      col: COL,
      part: "resize",
      x: 42,
      // Measured off `delegateElement`, which a hand-built event does not carry, so a fake yields 0
      // and the resize epic falls back to the declared width.
      width: 0,
      mods: NO_MODS,
    })
    expect(intentOf["header.pointerdown"](event, "move").part).toBe("move")
  })

  it("names the row handle as the part, because a row has only the one", () => {
    const event = withParams(pointer({ clientY: 7 }), rowParams)
    expect(intentOf["row.pointerdown"](event)).toEqual({
      phase: "intent", type: "row.pointerdown", row: ROW, part: "handle", y: 7,
    })
  })

  it("reports null for the leave edge, so no reducer needs an unhover case", () => {
    expect(intentOf["row.hover"](rowEvent())).toEqual({
      phase: "intent", type: "row.hover", row: ROW,
    })
    expect(intentOf["row.hover"](null)).toEqual({
      phase: "intent", type: "row.hover", row: null,
    })
  })

  it("reports the primary button for a key activation, which carries none", () => {
    const event = fake<KeyboardEvent>({ key: "Enter", shiftKey: true })
    expect(intentOf.key(event)).toEqual({
      phase: "intent",
      type: "key",
      key: "Enter",
      mods: { alt: false, ctrl: false, meta: false, shift: true, button: 0 },
    })
  })

  it("reads scroll off the box rather than the event, which does not bubble", () => {
    expect(intentOf["viewport.scroll"]({ scrollTop: 120, scrollLeft: 30 })).toEqual({
      phase: "intent", type: "viewport.scroll", top: 120, left: 30,
    })
  })

  it("reads a resize off a content rect, so a ResizeObserver can call it too", () => {
    expect(intentOf["viewport.resize"]({ width: 800, height: 600 })).toEqual({
      phase: "intent", type: "viewport.resize", width: 800, height: 600,
    })
  })
})

describe("css custom properties", () => {
  it("names a variable off the same segment the route uses", () => {
    expect(rowHeightVar("r1")).toBe("--sg-r-h-r1")
    expect(SG_DEPTH).toBe("--sg-depth")
  })

  it("escapes a slash, a space, and a unicode character", () => {
    expect(encodeVarId("src/a.ts")).toBe("src_2f-a_2e-ts")
    expect(encodeVarId("first name")).toBe("first_20-name")
    expect(encodeVarId("size ✓")).toBe("size_20-_2713-")
    expect(encodeVarId("a_b")).toBe("a_5f-b")
  })

  it("reads every escaped id back", () => {
    for (const id of ["src/a.ts", "first name", "size ✓", "a_b", "🚀 col", "plain-1", "/ab/"]) {
      expect(decodeVarId(encodeVarId(id))).toBe(id)
    }
  })

  it("keeps an astral character in one escape", () => {
    expect(encodeVarId("🚀")).toBe("_1f680-")
  })

  it("produces a var name a stylesheet can hold", () => {
    for (const id of ["src/a.ts", "first name", "size ✓"]) {
      expect(rowHeightVar(id)).toMatch(/^--sg-r-h-[A-Za-z0-9_-]+$/)
    }
  })
})
