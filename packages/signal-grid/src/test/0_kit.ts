// The one fixture and the one set of helpers every grid test builds on. `docs/0_api.md` has
// listed a test kit since the first day and it was never a file: the helpers lived inside
// whichever test wrote them first, so `keys(nodes)` existed four times and the same tree literal
// three times.
//
// Two rules hold for everything exported here.
//
// Nothing subscribes. Reading `.$()` is synchronous, because a computed signal recomputes on read,
// so a pipeline stage is asserted by looking at it. `withEpics` is the single exception: an epic
// is cold, and an effect leaves through `effect$` without ever landing in state, so those two
// observers are opened together and torn down together. It is the only `subscribe` a test may use.
//
// Nothing here reaches a document. Every helper imports clean into a node environment, so a file
// moves to the chromium runner in `DOM_TESTS` only when its own subject needs one.
import { Subject, Subscription } from "rxjs"
import { onTestFinished } from "vitest"
import { Signal } from "@hafley66/signals"
import { setDragStreams } from "../6_gestures.js"
import { grid, type Grid } from "../8_grid.js"
import type { ColumnDef, GridEffect, GridIntent, GridState, Modifiers } from "../0_types.js"

// --- The fixture ------------------------------------------------------------

export type Row = { id: string; name: string; size: number; kids?: Row[] }

/**
 * `name` carries the resize bounds so a drag test has something to clamp against, and `size` is
 * bare so a sort test has a second field that is not the first. Both were separately invented by
 * two lanes; this is the union, and the extra keys change no existing assertion.
 */
export const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", width: 120, minWidth: 80, maxWidth: 200, resizable: true },
  { id: "size", width: 80 },
]

/** Deliberately out of both alphabetical and numeric order, so a sort has work to do. */
export const FLAT: readonly Row[] = [
  { id: "c", name: "carol", size: 30 },
  { id: "a", name: "alice", size: 10 },
  { id: "b", name: "bob", size: 20 },
]

/** Three levels on the first root and a leaf beside it, so a subtree walk has a bottom and a peer. */
export const TREE: readonly Row[] = [
  {
    id: "src",
    name: "src",
    size: 0,
    kids: [
      { id: "src/a", name: "a.ts", size: 10 },
      { id: "src/b", name: "b.ts", size: 20, kids: [{ id: "src/b/x", name: "x.ts", size: 5 }] },
    ],
  },
  { id: "readme", name: "readme.md", size: 3 },
]

// --- Reading a run ----------------------------------------------------------

/** The flat-node list as bare keys. Written four separate times before this file existed. */
export const keysOf = (nodes: readonly { readonly key: string }[]): string[] =>
  nodes.map((node) => node.key)

// --- Building a grid --------------------------------------------------------

/**
 * `over` goes through a signal rather than a plain object because that is the path a consumer
 * takes, and the plain-object path is asserted on its own in `8_grid.test.ts`.
 */
export const flatGrid = (over: Partial<GridState> = {}, overscan?: number): Grid<Row> =>
  grid<Row>({
    id: "t",
    rows: FLAT,
    columns: COLUMNS,
    rowId: (row) => row.id,
    state: Signal<Partial<GridState>>(over),
    overscan,
  })

/** Supplying `subRows` is the whole of tree mode, so this differs from `flatGrid` by one key. */
export const treeGrid = (over: Partial<GridState> = {}): Grid<Row> =>
  grid<Row>({
    id: "t",
    rows: TREE,
    columns: COLUMNS,
    rowId: (row) => row.id,
    subRows: (row) => row.kids,
    state: Signal<Partial<GridState>>(over),
  })

// --- The one subscription ---------------------------------------------------

/**
 * The single `epics$` helper in the suite. Epics are cold, so nothing reduces until something
 * subscribes, and an effect never lands in state, so `effect$` is collected here rather than
 * observed per test. Both close through `onTestFinished`.
 */
export function withEpics<TRow>(
  g: Grid<TRow>,
): { readonly g: Grid<TRow>; readonly effects: GridEffect<TRow>[] } {
  const effects: GridEffect<TRow>[] = []
  const subs = new Subscription()
  subs.add(g.epics$.subscribe())
  subs.add(g.effect$.subscribe((effect) => effects.push(effect)))
  onTestFinished(() => subs.unsubscribe())
  return { g, effects }
}

/** Swaps the drag source for Subjects, so no test needs a real pointer or a real window. */
export function pointerStreams(): {
  readonly move$: Subject<PointerEvent>
  readonly up$: Subject<PointerEvent>
} {
  const move$ = new Subject<PointerEvent>()
  const up$ = new Subject<PointerEvent>()
  onTestFinished(setDragStreams({ move$, up$ }))
  return { move$, up$ }
}

/** A pointer event as the epics read it: two coordinates and nothing else. */
export const at = (coords: { clientX?: number; clientY?: number }): PointerEvent =>
  ({ clientX: 0, clientY: 0, ...coords }) as unknown as PointerEvent

// --- Intents ----------------------------------------------------------------

export const NO_MODS: Modifiers = { alt: false, ctrl: false, meta: false, shift: false, button: 0 }

export const mods = (over: Partial<Modifiers> = {}): Modifiers => ({ ...NO_MODS, ...over })

export const headerClick = (col: string, over: Partial<Modifiers> = {}): GridIntent => ({
  phase: "intent",
  type: "header.click",
  col,
  mods: mods(over),
})

export const headerDown = (col: string, part: "move" | "resize" | "select", x: number): GridIntent => ({
  phase: "intent",
  type: "header.pointerdown",
  width: 0,
  col,
  part,
  x,
  mods: NO_MODS,
})

export const rowDown = (row: string, y: number): GridIntent => ({
  phase: "intent",
  type: "row.pointerdown",
  row,
  part: "handle",
  y,
})

export const expanderClick = (row: string, over: Partial<Modifiers> = {}): GridIntent => ({
  phase: "intent",
  type: "expander.click",
  row,
  mods: mods(over),
})

export const checkboxClick = (row: string, over: Partial<Modifiers> = {}): GridIntent => ({
  phase: "intent",
  type: "checkbox.click",
  row,
  mods: mods(over),
})

/** `interactive` is the fourth argument rather than a modifier: it is what the click landed on,
 * which no keyboard chord can say. */
export const cellClick = (
  row: string,
  col: string,
  over: Partial<Modifiers> = {},
  interactive = false,
): GridIntent => ({
  phase: "intent",
  type: "cell.click",
  row,
  col,
  mods: mods(over),
  interactive,
})

export const keyPress = (name: string): GridIntent => ({
  phase: "intent",
  type: "key",
  key: name,
  mods: NO_MODS,
})

export const scrollTo = (top: number): GridIntent => ({
  phase: "intent",
  type: "viewport.scroll",
  top,
  left: 0,
})
