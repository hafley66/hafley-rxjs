// One declaration per grid part yields four artifacts: element id, delegated route, CSS custom
// property namespace, test selector. None is written twice, so none can drift.
import type { Observable } from "rxjs"
import { slash } from "@hafley66/path"
import type { PathPart, ValuesOf } from "@hafley66/path"
import { Dom, ROUTE_BOUNDARY_ATTR } from "@hafley66/xdom"
import type { DomTemplate } from "@hafley66/xdom"
import type { ColId, GridIntent, Modifiers, RowId } from "./0_types.js"

// --- Templates --------------------------------------------------------------

// The segment each element contributes alone. `PATHS` concatenates these, so re-parenting a part
// is one edit. A segment repeats when only its ancestor tells the two apart.
const LOCAL = {
  grid: "/g/{gridId}",
  viewport: "/vp",
  header: "/h/{colId}",
  headerResize: "/resize",
  headerMove: "/move",
  row: "/r/{rowId}",
  expander: "/expand",
  rowCheck: "/check",
  rowMove: "/move",
  cell: "/c/{colId}",
  cellExpander: "/expand",
} as const

export type PartName = keyof typeof LOCAL

const grid = slash(LOCAL.grid)
const header = grid.concatenate(slash(LOCAL.header))
const row = grid.concatenate(slash(LOCAL.row))
const cell = row.concatenate(slash(LOCAL.cell))

/** Frozen because a mutated route map is a silently mis-delegating grid. */
export const PATHS = Object.freeze({
  grid,
  viewport: grid.concatenate(slash(LOCAL.viewport)),
  header,
  headerResize: header.concatenate(slash(LOCAL.headerResize)),
  headerMove: header.concatenate(slash(LOCAL.headerMove)),
  row,
  expander: row.concatenate(slash(LOCAL.expander)),
  rowCheck: row.concatenate(slash(LOCAL.rowCheck)),
  rowMove: row.concatenate(slash(LOCAL.rowMove)),
  cell,
  // The run expander is drawn inside the first cell, because outside it, it would take track 1 and
  // shift every column against a header band that never builds one.
  cellExpander: cell.concatenate(slash(LOCAL.cellExpander)),
})

/** The same set as raw text, because `Dom()` keys its cache by the template string. */
export const TEMPLATES = Object.freeze({
  grid: PATHS.grid.template,
  viewport: PATHS.viewport.template,
  header: PATHS.header.template,
  headerResize: PATHS.headerResize.template,
  headerMove: PATHS.headerMove.template,
  row: PATHS.row.template,
  expander: PATHS.expander.template,
  rowCheck: PATHS.rowCheck.template,
  rowMove: PATHS.rowMove.template,
  cell: PATHS.cell.template,
  cellExpander: PATHS.cellExpander.template,
})

// --- Bindings ---------------------------------------------------------------

// `Dom` derives params through `@hafley66/path`'s `ValuesOf`, so its own type is already exact.
// Restating it here would only create a second definition to keep in sync.
export type GridBinding<Template extends string> = DomTemplate<Template>

const bind = <Template extends string>(template: Template): GridBinding<Template> => Dom(template)

export interface GridDom {
  readonly gridId: string
  readonly grid: GridBinding<typeof TEMPLATES.grid>
  readonly viewport: GridBinding<typeof TEMPLATES.viewport>
  readonly header: GridBinding<typeof TEMPLATES.header>
  readonly headerResize: GridBinding<typeof TEMPLATES.headerResize>
  readonly headerMove: GridBinding<typeof TEMPLATES.headerMove>
  readonly row: GridBinding<typeof TEMPLATES.row>
  readonly expander: GridBinding<typeof TEMPLATES.expander>
  readonly rowCheck: GridBinding<typeof TEMPLATES.rowCheck>
  readonly rowMove: GridBinding<typeof TEMPLATES.rowMove>
  readonly cell: GridBinding<typeof TEMPLATES.cell>
  readonly cellExpander: GridBinding<typeof TEMPLATES.cellExpander>
}

// `Dom` caches per template, so every binding is shared across calls and across grids: one
// delegated listener per event name for the page, whatever the row count. `gridId` rides along.
export function gridDom(gridId: string): GridDom {
  return {
    gridId,
    grid: bind(TEMPLATES.grid),
    viewport: bind(TEMPLATES.viewport),
    header: bind(TEMPLATES.header),
    headerResize: bind(TEMPLATES.headerResize),
    headerMove: bind(TEMPLATES.headerMove),
    row: bind(TEMPLATES.row),
    expander: bind(TEMPLATES.expander),
    rowCheck: bind(TEMPLATES.rowCheck),
    rowMove: bind(TEMPLATES.rowMove),
    cell: bind(TEMPLATES.cell),
    cellExpander: bind(TEMPLATES.cellExpander),
  }
}

// --- Attributes -------------------------------------------------------------

const kebab = (name: string): string =>
  name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()

const partsOf = (template: string): readonly PathPart[] =>
  slash(template).parts as readonly PathPart[]

/** The literal segments of a template, which is the value of its `data-route`. */
const skeletonOf = (template: string): string =>
  partsOf(template).flatMap(part => (part.kind === "literal" ? [part.value] : [])).join("/")

// `fromDelegatedRoute` joins every ancestor `data-route` and takes each param from the closest
// ancestor carrying it, so a repeated gridId on a cell is N*M attributes that can go stale.
function routeAttrs(
  template: string,
  values: Readonly<Record<string, string>>,
): Record<string, string> {
  const attrs: Record<string, string> = { "data-route": skeletonOf(template) }
  for (const part of partsOf(template)) {
    if (part.kind === "literal") continue
    const value = values[part.name]
    if (value !== undefined) attrs[`data-${kebab(part.name)}`] = value
  }
  return attrs
}

// A grid renders grids: a detail panel hosting one puts a second `g/r/c` chain under the first,
// and the composed `g/r/g/r/c` is no declared template, so neither grid saw the click.
export const gridAttrs = (gridId: string): Record<string, string> => ({
  ...routeAttrs(LOCAL.grid, { gridId }),
  [ROUTE_BOUNDARY_ATTR]: "",
})

// Never reached by delegation: `scroll` does not bubble, `resize` comes from a ResizeObserver. So
// it must not wrap the rows, or its segment lands mid-chain under them and they match nothing.
export const viewportAttrs = (): Record<string, string> =>
  routeAttrs(LOCAL.viewport, {})

export const headerAttrs = (colId: ColId): Record<string, string> =>
  routeAttrs(LOCAL.header, { colId })

export const resizeAttrs = (): Record<string, string> =>
  routeAttrs(LOCAL.headerResize, {})

/** Shared by the header and the row handle: the ancestor segment tells them apart. */
export const moveAttrs = (): Record<string, string> =>
  routeAttrs(LOCAL.headerMove, {})

export const rowAttrs = (rowId: RowId): Record<string, string> =>
  routeAttrs(LOCAL.row, { rowId })

export const expandAttrs = (): Record<string, string> =>
  routeAttrs(LOCAL.expander, {})

export const checkAttrs = (): Record<string, string> =>
  routeAttrs(LOCAL.rowCheck, {})

export const cellAttrs = (colId: ColId): Record<string, string> =>
  routeAttrs(LOCAL.cell, { colId })

// --- Selectors --------------------------------------------------------------

/** An attribute selector is a quoted string, so the two characters that can end it early go. */
const quote = (value: string): string => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')

// Built from the same `routeAttrs` the renderer stamps, so a selector cannot describe an element
// the renderer never produces.
export function selectorFor(
  part: PartName,
  values: Readonly<Record<string, string>> = {},
): string {
  return Object.entries(routeAttrs(LOCAL[part], values))
    .map(([name, value]) => `[${name}="${quote(value)}"]`)
    .join("")
}

// --- Intents ----------------------------------------------------------------

// `delegateElement` is what xdom's routing hands back, and it is the element the template matched,
// so an intent that needs geometry measures it here rather than re-querying the DOM later.
type Delegated<Values, E> = E & { readonly params: Values; readonly delegateElement?: HTMLElement }
type Intent<T extends GridIntent["type"]> = Extract<GridIntent, { type: T }>

type CellValues = ValuesOf<typeof TEMPLATES.cell>
type HeaderValues = ValuesOf<typeof TEMPLATES.header>
type RowValues = ValuesOf<typeof TEMPLATES.row>

// A keyboard event carries no button, and zero is the primary button, which is what a key
// activation means downstream, so both input kinds reduce through one branch.
export const modifiersOf = (event: MouseEvent | PointerEvent | KeyboardEvent): Modifiers => ({
  alt: event.altKey,
  ctrl: event.ctrlKey,
  meta: event.metaKey,
  shift: event.shiftKey,
  button: "button" in event ? event.button : 0,
})

// Keyed by the intent type itself, so a renamed member of `GridIntent` breaks the key rather than
// producing an intent nothing handles.
/** @feature view.scroll */
export const intentOf = Object.freeze({
  "cell.click": (event: Delegated<CellValues, MouseEvent>): Intent<"cell.click"> => ({
    phase: "intent",
    type: "cell.click",
    row: event.params.rowId,
    col: event.params.colId,
    mods: modifiersOf(event),
  }),
  "cell.dblclick": (event: Delegated<CellValues, MouseEvent>): Intent<"cell.dblclick"> => ({
    phase: "intent",
    type: "cell.dblclick",
    row: event.params.rowId,
    col: event.params.colId,
    mods: modifiersOf(event),
  }),
  "cell.pointerdown": (event: Delegated<CellValues, PointerEvent>): Intent<"cell.pointerdown"> => ({
    phase: "intent",
    type: "cell.pointerdown",
    row: event.params.rowId,
    col: event.params.colId,
    mods: modifiersOf(event),
  }),
  // Range drag reads the hovered cell while a button is already held, so the modifiers here repeat
  // what the pointerdown that opened the drag already said.
  "cell.pointerenter": (
    event: Delegated<CellValues, PointerEvent>,
  ): Intent<"cell.pointerenter"> => ({
    phase: "intent",
    type: "cell.pointerenter",
    row: event.params.rowId,
    col: event.params.colId,
  }),
  // Client coordinates: a consumer positioning by hand needs them, one using anchor positioning
  // ignores them.
  "cell.contextmenu": (event: Delegated<CellValues, MouseEvent>): Intent<"cell.contextmenu"> => ({
    phase: "intent",
    type: "cell.contextmenu",
    row: event.params.rowId,
    col: event.params.colId,
    x: event.clientX,
    y: event.clientY,
    mods: modifiersOf(event),
  }),
  "header.contextmenu": (
    event: Delegated<HeaderValues, MouseEvent>,
  ): Intent<"header.contextmenu"> => ({
    phase: "intent",
    type: "header.contextmenu",
    col: event.params.colId,
    x: event.clientX,
    y: event.clientY,
    mods: modifiersOf(event),
  }),
  "header.click": (event: Delegated<HeaderValues, MouseEvent>): Intent<"header.click"> => ({
    phase: "intent",
    type: "header.click",
    col: event.params.colId,
    mods: modifiersOf(event),
  }),
  // `part` comes from which template matched, not from the event: two handles under one header
  // bubble the same pointerdown carrying the same col.
  "header.pointerdown": (
    event: Delegated<HeaderValues, PointerEvent>,
    part: "move" | "resize" | "select",
  ): Intent<"header.pointerdown"> => ({
    phase: "intent",
    type: "header.pointerdown",
    col: event.params.colId,
    part,
    x: event.clientX,
    // The header cell, not whatever matched. A resize drag matches the 6px handle, and measuring
    // that made a 130px column resize to 126 instead of 250. The browser owns track distribution
    // now, so a flex column has no declared width and the painted header box is the only truth.
    width: headerBoxOf(event.delegateElement),
    mods: modifiersOf(event),
  }),
  "row.contextmenu": (event: Delegated<RowValues, MouseEvent>): Intent<"row.contextmenu"> => ({
    phase: "intent",
    type: "row.contextmenu",
    row: event.params.rowId,
    x: event.clientX,
    y: event.clientY,
    mods: modifiersOf(event),
  }),
  "row.pointerdown": (event: Delegated<RowValues, PointerEvent>): Intent<"row.pointerdown"> => ({
    phase: "intent",
    type: "row.pointerdown",
    row: event.params.rowId,
    part: "handle",
    y: event.clientY,
  }),
  /** Null is the leave edge, so no reducer needs a separate unhover case. */
  "row.hover": (event: Delegated<RowValues, Event> | null): Intent<"row.hover"> => ({
    phase: "intent",
    type: "row.hover",
    row: event === null ? null : event.params.rowId,
  }),
  "expander.click": (event: Delegated<RowValues, MouseEvent>): Intent<"expander.click"> => ({
    phase: "intent",
    type: "expander.click",
    row: event.params.rowId,
    mods: modifiersOf(event),
  }),
  "checkbox.click": (event: Delegated<RowValues, MouseEvent>): Intent<"checkbox.click"> => ({
    phase: "intent",
    type: "checkbox.click",
    row: event.params.rowId,
    mods: modifiersOf(event),
  }),
  key: (event: KeyboardEvent): Intent<"key"> => ({
    phase: "intent",
    type: "key",
    key: event.key,
    mods: modifiersOf(event),
  }),
  // Takes the scroll box, not the event: `scroll` does not bubble, and the numbers are on the
  // element either way, so a ResizeObserver callback can call this too.
  "viewport.scroll": (
    box: { readonly scrollTop: number; readonly scrollLeft: number },
  ): Intent<"viewport.scroll"> => ({
    phase: "intent",
    type: "viewport.scroll",
    top: box.scrollTop,
    left: box.scrollLeft,
  }),
  "viewport.resize": (
    box: { readonly width: number; readonly height: number },
  ): Intent<"viewport.resize"> => ({
    phase: "intent",
    type: "viewport.resize",
    width: box.width,
    height: box.height,
  }),
})

// --- CSS custom properties --------------------------------------------------

const HEADER_SEGMENT = skeletonOf(LOCAL.header)

/** The header cell's painted width, climbing out of whichever child the pointer actually matched. */
const headerBoxOf = (el: HTMLElement | undefined): number => {
  const header = el?.closest<HTMLElement>(`[data-route="${HEADER_SEGMENT}"]`) ?? el
  return header?.getBoundingClientRect().width ?? 0
}
const ROW_SEGMENT = skeletonOf(LOCAL.row)

const SAFE_IDENT_CHAR = /^[A-Za-z0-9-]$/

// A custom property name is an ident, so anything outside `[A-Za-z0-9-]` becomes `_<hex>-`. The
// terminator is never a hex digit, which is what makes the decode unambiguous at any hex length.
/** @feature view.theme */
export const encodeVarId = (id: string): string =>
  [...id]
    .map(char =>
      char.length === 1 && SAFE_IDENT_CHAR.test(char)
        ? char
        : `_${(char.codePointAt(0) ?? 0).toString(16)}-`,
    )
    .join("")

/** The inverse, for reading an id back out of a stylesheet or a failing assertion. */
export const decodeVarId = (encoded: string): string =>
  encoded.replace(/_([0-9a-f]+)-/g, (_match, hex: string) =>
    String.fromCodePoint(Number.parseInt(hex, 16)),
  )

// `r` is read from the same template delegation reads. The column axis has no partner to this: a
// width travels in the one `--sg-inline-tracks` string `src/9_css.ts` writes.
export const rowHeightVar = (rowId: RowId): string => `--sg-${ROW_SEGMENT}-h-${encodeVarId(rowId)}`

/** Tree indent. Written once per row, read by every cell in it. */
export const SG_DEPTH = "--sg-depth"
