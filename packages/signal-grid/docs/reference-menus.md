# Context menus

Open your own menu on a right click, anchored to the exact cell, row, or header the reader hit. The
library ships the target and the anchor, and ships no menu widget.

`src/16_menu.ts` is the whole of it.

## The three intents

| intent | raised by a right click on | fields |
| --- | --- | --- |
| `cell.contextmenu` | a data cell | `row`, `col`, `x`, `y`, `mods` |
| `header.contextmenu` | a header cell, its label, or its resize handle | `col`, `x`, `y`, `mods` |
| `row.contextmenu` | a row, a routeless glyph cell, or an open detail panel | `row`, `x`, `y`, `mods` |

Which one fires is decided by where the pointer landed rather than by three listeners racing.
Delegation compares the whole composed route chain for equality, so a cell right click matches the
cell template and the row template never sees it.

The native menu is suppressed only where an intent was produced. A right click on the scroll bar, on
the header strip past the last column, or on the box below the last row composes a chain no menu
template declares, so the browser menu opens as usual.

## Resolving the target

```ts
menuTargetOf(intent: GridIntent, root: HTMLElement, orientation: Orientation): MenuTarget | null
anchorTo(target: MenuTarget, popover: HTMLElement): () => void
```

`menuTargetOf` in `src/16_menu.ts` resolves the element through `selectorFor` and crosses the seats
through `conventionalParts` in `src/12_transpose.ts`, so `target.row` and `target.col` are in the
reader's vocabulary under either orientation.

| part | what its own attributes hold | crossed |
| --- | --- | --- |
| cell | the conventional pair, stamped on the cell itself | no |
| row | the vertical key, which is a column under a transposed orientation | yes |
| header cell | the horizontal key, which is a data row under a transposed orientation | yes |

A target whose element has left the document answers with nothing, which is a menu that does not
open rather than a menu that opens at the origin.

## The shortest thing that opens a real menu

```ts
import { anchorTo, isMenuIntent, menuTargetOf } from "@hafley66/signal-grid"

const menu = document.createElement("div")
menu.popover = "auto"
document.body.append(menu)

let release = () => {}

runWhenInView(g.intent$.pipe(filter(isMenuIntent)), (it) => {
  const target = menuTargetOf(it, root, g.state.orientation.$())
  if (target === null) return
  menu.replaceChildren(...itemsFor(target).map(button))
  release()
  release = anchorTo(target, menu)
  menu.showPopover()
})

menu.addEventListener("toggle", (event) => {
  if ((event as ToggleEvent).newState === "closed") release()
})
```

The popover API gives the top layer and light dismiss for free. `itemsFor` is where your app decides
that a header target offers a sort and a cell target offers a copy, reading `target.kind`,
`target.row`, and `target.col`.

## Anchoring

`anchorTo` writes an anchor name on the target and the position properties on the popover, and hands
back the teardown that removes both. Anchor positioning is not everywhere yet, so the function asks
`CSS.supports` for the two property names and falls back to fixed positioning at the recorded
coordinates when the answer is no. Both paths zero the margin, because the user agent sheet gives a
popover one and the position area measures from the margin box.

`x` and `y` are client coordinates, carried because a consumer positioning by hand needs them and a
consumer using anchor positioning ignores them.

## Keeping the native menu inside a panel

A detail panel composes the row chain, so a right click inside it raises a row menu intent. A panel
holding text a reader should be able to copy through the browser menu stops the event before it
reaches the delegated listener.

```ts
const slots: Slots<Row> = {
  detail: (it) => {
    const panel = document.createElement("div")
    panel.addEventListener("contextmenu", (event) => event.stopPropagation())
    panel.textContent = it.data.notes
    return panel
  },
}
```

## A right click never disturbs a live range

Every range gesture gates on the primary button, so a right click inside a selected block raises the
menu intent and leaves `state.selection` untouched. A menu acting on the selection therefore gets
the block the reader can still see.
