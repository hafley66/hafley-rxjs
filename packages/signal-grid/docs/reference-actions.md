# Intents, changes, effects

One bus carries everything that happens in a grid, in three phases. Subscribe to a phase and you
have a hook the library never had to declare.

```ts
g.actions$.subscribe(log)      // everything
g.intent$.subscribe(handle)    // the DOM saw something
g.change$.subscribe(handle)    // one state key was written
g.effect$.subscribe(handle)    // it left the grid
```

## The three phases

| phase | meaning | shape |
| --- | --- | --- |
| `intent` | the DOM saw something and no state has moved | one member per path template |
| `change` | exactly one key of `GridState` was written | the key name plus its new value, reduced synchronously |
| `effect` | it leaves the grid and the consumer decides what it means | a named payload |

`GridIntent`, `GridChange`, and `GridEffect` are declared in `src/0_types.ts`, and `GridAction` is
their union.

## The intents

| type | fields |
| --- | --- |
| `cell.click`, `cell.dblclick`, `cell.pointerdown` | `row`, `col`, `mods` |
| `cell.pointerenter` | `row`, `col` |
| `cell.contextmenu` | `row`, `col`, `x`, `y`, `mods` |
| `header.click` | `col`, `mods` |
| `header.pointerdown` | `col`, `part`, `x`, `width`, `mods` |
| `header.contextmenu` | `col`, `x`, `y`, `mods` |
| `row.pointerdown` | `row`, `part`, `y` |
| `row.contextmenu` | `row`, `x`, `y`, `mods` |
| `row.hover` | `row`, or nothing |
| `expander.click`, `checkbox.click` | `row`, `mods` |
| `key` | `key`, `mods` |
| `viewport.scroll` | the scroll position |

Every member is minted by `intentOf` in `src/3_paths.ts`. One of them, `row.hover`, has a
constructor that `bind` never wires, so nothing produces it today.

## The effects

| type | payload |
| --- | --- |
| `activate` | `row`, `col`, and the row's data |
| `editCommit` | `row`, `col`, the value |
| `editCancel` | `row`, `col` |
| `reorderRow` | `row`, and the key it landed before |
| `copy` | the text |
| `paste` | the text, `row`, `col` |
| `custom` | a name and a payload |

## Where an intent comes from

Every intent is a delegated DOM event resolved by walking the `data-route` chain up the ancestors,
and the match is equality against the whole composed chain. A pointer over a cell composes the cell
chain and matches the cell template alone, so two templates never both fire for one event.

| chain | element | params |
| --- | --- | --- |
| `g` | the grid root | the grid id |
| `g/vp` | the viewport box | the grid id |
| `g/h` | a header cell | plus the column id |
| `g/h/move` | the header label, when the column is movable | plus the column id |
| `g/h/resize` | the resize handle | plus the column id |
| `g/r` | a row, a routeless glyph cell, an open detail panel | plus the row id |
| `g/r/expand` | the expander glyph | plus the row id |
| `g/r/check` | the checkbox or radio glyph | plus the row id |
| `g/r/move` | the row drag handle | plus the row id |
| `g/r/c` | a data cell | plus the row id and the column id |

One delegated listener serves the page whatever the row count, because the templates are cached per
string rather than per element.

## Your own delegated event

You do not need an epic or a state key to act on a gesture the kernel has no opinion about.

```ts
import { Dom } from "@hafley66/xdom"
import { TEMPLATES } from "@hafley66/signal-grid"

Dom(TEMPLATES.cell).route.auxclick
  .pipe(filter((it) => it.params.gridId === g.id.$() && it.button === 1))
  .subscribe((it) => open(`/rows/${it.params.rowId}`))
```

`event.params` is typed from the template, so a missing parameter is a compile error rather than a
silent undefined.

## Lazy loading off the raw stream

`g.intent$` is every intent after the grid id filter and before any epic ran, which makes it the
door for behaviour with no state key.

```ts
const source = Signal<readonly Row[]>(ROWS)
const g = grid<Row>({ id: "tree", rows: source, columns, rowId: (it) => it.id, subRows })
const loaded = new Set<RowId>()

g.intent$
  .pipe(
    filter((it) => it.type === "cell.click" && it.col === "name"),
    filter((it) => loaded.has(it.row) === false),
    mergeMap((it) => fetchChildren(it.row).then((kids) => ({ row: it.row, kids }))),
  )
  .subscribe(({ row, kids }) => {
    loaded.add(row)
    source.$(withChildren(source.$(), row, kids))
    g.state.expanded[row].$(true)
  })
```

Grafting children is an edit to your own array, because `axisOfTree` in `src/1_axis.ts` re-derives
the whole forest from it.

## What cannot be extended

| closed | why | the nearest door |
| --- | --- | --- |
| the intent grammar | `GridIntent` is a closed union and `intentOf` is keyed by member name, so a rename breaks the key rather than orphaning a handler | a delegated event of your own, as above |
| the route templates | the template map is frozen, because a mutated route map is a silently mis-delegating grid | compose your own template over your own attributes inside a slot |
| the reducer | `reduce` in `src/8_grid.ts` writes exactly one state key per change | dispatch two changes, or write the second key directly |
| `GridState` keys | the type is the url contract | hold your own signal beside the grid |
| slot ctx fields | the three shapes are fixed | close over what you need |
| the three pinning runs | `Side` has three members and the renderer builds three run boxes | none |
| orientation beyond two | `SEATS` in `src/12_transpose.ts` is a two-row table | add a row to the table |
| async epics | epics are synchronous and the slice reduces in the same tick | subscribe `g.intent$` and dispatch when the answer arrives |
