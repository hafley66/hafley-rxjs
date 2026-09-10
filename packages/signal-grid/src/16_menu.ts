// @comment-ok: the line this module refuses to cross is its whole deliverable and has no runtime home
// A context menu is UI every application wants to own: its own items, its own icons, its own
// keyboard model, its own copy. So this file ships the half only the grid can answer, and stops.
//
// That half is which cell, row, or column the pointer landed on, and which element a menu tethers
// to. No list, no item type, no popup keyboard handling, nothing that appends a node to the
// document. `anchorTo` writes properties onto two elements the caller already owns and hands back
// the teardown.
//
// The three intents this reads are produced by `bindRoot` in `8_grid.ts`, one per event, because
// `fromDelegatedRoute` compares the composed `data-route` chain against a template skeleton for
// equality: a right click on a cell composes `g/r/c` and matches the cell template alone, so no two
// of the three ever fire together.
import { conventionalParts, verticalOf, type AxisPair } from "./12_transpose.js"
import { encodeVarId, selectorFor } from "./3_paths.js"
import type { ColId, GridIntent, Modifiers, Orientation, RowId } from "./0_types.js"

// --- The intents ------------------------------------------------------------

/** Mirrors the `GridIntent` patch, so this file compiles before the grammar carries the three.
 * `x` and `y` are client coordinates: anchor positioning ignores them, a hand-placed menu needs them. */
export type MenuIntent =
  | {
      phase: "intent"
      type: "cell.contextmenu"
      row: RowId
      col: ColId
      x: number
      y: number
      mods: Modifiers
    }
  | { phase: "intent"; type: "row.contextmenu"; row: RowId; x: number; y: number; mods: Modifiers }
  | {
      phase: "intent"
      type: "header.contextmenu"
      col: ColId
      x: number
      y: number
      mods: Modifiers
    }

export type MenuIntentType = MenuIntent["type"]

const MENU_TYPES: ReadonlySet<string> = new Set<MenuIntentType>([
  "cell.contextmenu",
  "row.contextmenu",
  "header.contextmenu",
])

/** True for exactly the three above, so a consumer filters `g.intent$` in one call. */
export const isMenuIntent = (intent: GridIntent | MenuIntent): intent is MenuIntent =>
  MENU_TYPES.has(intent.type)

// --- The target -------------------------------------------------------------

export interface MenuTarget {
  readonly kind: "cell" | "row" | "header"
  readonly row: RowId | null
  readonly col: ColId | null
  readonly at: { readonly x: number; readonly y: number }
  /** The element to tether to, resolved through `selectorFor`. Null only on a hand-built target:
   * `menuTargetOf` answers an unresolvable element with a null target instead. */
  readonly anchor: HTMLElement | null
  /** A unique `anchor-name` written onto that element, for CSS anchor positioning. */
  readonly anchorName: string
}

// A counter rather than a hash of the address: two menus open on one cell at once must not share a
// name, or the first teardown strips the anchor the second is still tethered to.
let sequence = 0

const nameFor = (kind: MenuTarget["kind"], key: string): string => {
  sequence += 1
  return `--sg-menu-${sequence}-${kind}-${encodeVarId(key)}`
}

/** The empty half of a one-axis address. No axis holds `""` as a key. */
const NONE = ""

/** Conventional coming out. `rowAttrs` stamps whatever key stands vertical, so a `data-row-id`
 * under `orientation: "columns"` is a column, and a row target there names a column of the schema. */
function crossed(
  vertical: string,
  horizontal: string,
  orientation: Orientation,
): { readonly row: RowId | null; readonly col: ColId | null } {
  const pair = conventionalParts(vertical, horizontal, orientation)
  return { row: pair[0] === NONE ? null : pair[0], col: pair[1] === NONE ? null : pair[1] }
}

const found = (root: HTMLElement, selector: string): HTMLElement | null =>
  root.querySelector<HTMLElement>(selector)

/** Delegation takes each param from the closest ancestor carrying it, and the renderer stamps a
 * cell's own row id whenever it differs from the row's. The same rule read back. */
function cellIn(root: HTMLElement, vertical: string, col: ColId, row: RowId): HTMLElement | null {
  const selector = `${selectorFor("row", { rowId: vertical })} ${selectorFor("cell", { colId: col })}`
  for (const element of root.querySelectorAll<HTMLElement>(selector)) {
    const own = element.dataset.rowId
    if (own === undefined || own === row) return element
  }
  return null
}

/** The tether for a row id no row element spells, which the transpose produces. */
function cellOwnedBy(root: HTMLElement, row: RowId): HTMLElement | null {
  for (const element of root.querySelectorAll<HTMLElement>(selectorFor("cell"))) {
    if (element.dataset.rowId === row) return element
  }
  return null
}

/** The anchor and the address for one context-menu intent, or null when the element it named has
 * left the DOM, which is a menu that does not open rather than one that opens at the origin. */
export function menuTargetOf(
  intent: GridIntent | MenuIntent,
  root: HTMLElement,
  orientation: Orientation,
): MenuTarget | null {
  if (!isMenuIntent(intent)) return null
  const at = { x: intent.x, y: intent.y }
  if (intent.type === "cell.contextmenu") {
    // A cell intent arrives conventional, because the renderer stamps the conventional pair on the
    // cell itself. Only the ancestor row is keyed by the seat, so only the selector crosses.
    const seats: AxisPair<string> = [intent.row, intent.col]
    const anchor = cellIn(root, verticalOf(seats, orientation), intent.col, intent.row)
    if (anchor === null) return null
    return {
      kind: "cell",
      row: intent.row,
      col: intent.col,
      at,
      anchor,
      anchorName: nameFor("cell", `${intent.row}-${intent.col}`),
    }
  }
  if (intent.type === "row.contextmenu") {
    const anchor = found(root, selectorFor("row", { rowId: intent.row }))
    if (anchor !== null) {
      const address = crossed(intent.row, NONE, orientation)
      return {
        kind: "row",
        row: address.row,
        col: address.col,
        at,
        anchor,
        anchorName: nameFor("row", intent.row),
      }
    }
    // A glyph cell carries its own conventional row id, so `g/r` can arrive with a key the seat
    // table would cross the wrong way. No row element spells it, and the id is already conventional.
    const owned = cellOwnedBy(root, intent.row)
    if (owned === null) return null
    return {
      kind: "row",
      row: intent.row,
      col: null,
      at,
      anchor: owned,
      anchorName: nameFor("row", intent.row),
    }
  }
  const anchor = found(root, selectorFor("header", { colId: intent.col }))
  if (anchor === null) return null
  const address = crossed(NONE, intent.col, orientation)
  return {
    kind: "header",
    row: address.row,
    col: address.col,
    at,
    anchor,
    anchorName: nameFor("header", intent.col),
  }
}

// --- Tethering --------------------------------------------------------------

/** What the anchored path writes on the popover, so the teardown removes exactly its own writes. */
const ANCHORED_PROPS: readonly string[] = [
  "position",
  "margin",
  "position-anchor",
  "position-area",
  "position-try-fallbacks",
]

// Physical rather than logical: a client coordinate is measured from the viewport's physical top
// and left, so `inset-inline-start` would place the box on the wrong side under RTL.
const FIXED_PROPS: readonly string[] = ["position", "margin", "top", "left", "right", "bottom"]

/** Down and to the inline end of what it names, flipping on either dimension for room. */
const AREA = "block-end span-inline-end"
const FALLBACKS = "flip-block, flip-inline, flip-block flip-inline"

type SupportsQuery = { readonly supports: (property: string, value: string) => boolean }

/** Read off `globalThis` at call time, so a document with no `CSS` object degrades instead of
 * throwing. Both properties are asked for: the name without the placement half renders at the origin. */
export function supportsAnchorPositioning(): boolean {
  const api = (globalThis as { CSS?: Partial<SupportsQuery> }).CSS
  if (api === undefined || typeof api.supports !== "function") return false
  const supports = api.supports
  return supports("anchor-name", "--sg-menu") && supports("position-anchor", "--sg-menu")
}

const clearProps = (element: HTMLElement, props: readonly string[]): void => {
  for (const property of props) element.style.removeProperty(property)
}

/** Tethers `popover` to `target.anchor` and hands back the teardown. Nothing is appended and
 * nothing is shown: opening and light-dismiss belong to the Popover API, which is Baseline Widely. */
export function anchorTo(target: MenuTarget, popover: HTMLElement): () => void {
  const anchor = target.anchor
  // Both paths write `margin: 0`: the UA sheet gives `[popover]` a margin and `position-area`
  // measures from the margin box.
  if (anchor === null || !supportsAnchorPositioning()) {
    popover.style.setProperty("position", "fixed")
    popover.style.setProperty("margin", "0")
    popover.style.setProperty("top", `${target.at.y}px`)
    popover.style.setProperty("left", `${target.at.x}px`)
    // A popover already placed against the far edges would otherwise keep both sides pinned and
    // stretch across the viewport.
    popover.style.setProperty("right", "auto")
    popover.style.setProperty("bottom", "auto")
    return () => clearProps(popover, FIXED_PROPS)
  }
  anchor.style.setProperty("anchor-name", target.anchorName)
  popover.style.setProperty("position", "absolute")
  popover.style.setProperty("margin", "0")
  popover.style.setProperty("position-anchor", target.anchorName)
  popover.style.setProperty("position-area", AREA)
  popover.style.setProperty("position-try-fallbacks", FALLBACKS)
  return () => {
    anchor.style.removeProperty("anchor-name")
    clearProps(popover, ANCHORED_PROPS)
  }
}
