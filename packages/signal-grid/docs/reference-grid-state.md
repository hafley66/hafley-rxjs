# GridState

Read or write any part of a grid through one signal. `GridState` is the whole of what a grid
remembers, and it is declared in `src/0_types.ts`.

```ts
g.state.$()                       // the whole record
g.state.sort.$()                  // one key
g.state.colHidden.size.$(true)    // one key of one record
runWhenInView(g.state.colHidden.size.$.pipe(tap(handle)))
```

## Row axis

| key | type | page |
| --- | --- | --- |
| `sort` | `SortModel` | [Sort](/rows-sort) |
| `group` | `readonly ColId[]` | [Group](/rows-group) |
| `expanded` | a record of row id to boolean | [Tree data](/rows-tree) |
| `rowSelection` | a record of row id to boolean | [Select](/rows-select) |
| `rowPinning` | a record of row id to side | [Pin](/rows-pin) |
| `rowHeight` | a record of row id to pixels | [Height](/rows-height) |
| `rowOrder` | `readonly RowId[]` | declared, with no reader in `src/` |
| `detail` | which cell opened each panel | [Detail rows](/rows-detail) |
| `page` | one `Page` object | [Pagination](/page-paginate) |

## Column axis

| key | type | page |
| --- | --- | --- |
| `colOrder` | `readonly ColId[]` | [Order](/columns-order) |
| `colHidden` | a record of column id to boolean | [Visibility](/columns-visibility) |
| `colWidth` | a record of column id to pixels | [Resize and width](/columns-width) |
| `colPinning` | a record of column id to side | [Pin](/columns-pin) |

## Cross axis

| key | type | page |
| --- | --- | --- |
| `selection` | `GridSelection`, the live block plus the committed ones | [Range selection and focus](/cells-range) |
| `drag` | `DragPreview`, or nothing between gestures | [Order](/columns-order), [Resize and width](/columns-width), [Reorder](/rows-reorder) |
| `focus` | one `CellId`, or nothing | the same page |
| `editing` | one `CellId`, or nothing | read by the renderer, written by no epic |

`drag` is a live gesture rather than a stored preference: a deferred resize or move writes it on
every pointermove and clears it on the lift, which is the same seat `selection` already holds for
the live half of a range drag.

## View

| key | type | page |
| --- | --- | --- |
| `density` | compact, standard, or comfortable | [Density](/view-density) |
| `listView` | boolean | [List view and the transpose](/view-list) |
| `orientation` | rows or columns | the same page |
| `virtualize` | `{ vertical, horizontal }`, one boolean per seat | [Virtualization](/view-virtualize) |

## Why it is a type alias

The recursive proxy on `Signal<T>` gates on the parameter extending a record, and an interface
carries no implicit index signature. Declared as an interface, `g.state.sort.$()` would stop
typechecking, so the alias is the reason the proxy dots exist at all.

## Seeding

```ts
grid<Row>({
  ...config,
  state: { virtualize: { vertical: false, horizontal: false }, colHidden: { mtime: true } },
})
```

The first value is the seed. `state` is a `GridSource`, so a signal, an observable, or a thunk keeps
feeding the grid after that: each later emission lands as one `change` per key it carries, on the
same bus a click uses, and `change$` reports it.

Which keys move is the caller's declaration, because the type is `Partial<GridState>`:

| the source emits | what happens to the grid |
| --- | --- |
| a key it has never sent | written |
| a key the user has since changed by hand | written, the source wins |
| a key absent from this emission | untouched, the user's value stands |
| a key present and explicitly `undefined` | untouched, which reads as no claim rather than a reset |

Sending `{ colHidden }` on every emission therefore cannot undo a sort a user just made. Sending
`{ sort }` on every emission does overwrite their sort, so send the keys you mean to own.

## Controlled

A signal handed in is controlled in both directions, the way a controlled prop is in React, except
that one object is both halves:

```ts
const held = Signal<Partial<GridState>>({})
const g = grid<Row>({ ...config, state: held })

held.sort.$([{ field: "size", sort: "asc" }])   // the caller writes, the grid sorts
g.dispatch(headerClick("size"))                 // the user sorts, `held.$().sort` moved
```

| the grid changes a key | what the caller's signal does |
| --- | --- |
| a key the caller carries | rewritten in place |
| a key the caller never sent | added, so the object gains the keys that moved |
| a key nothing moved | absent, and `Partial` keeps meaning the keys that are theirs |

One click is one emission on that signal. The two shapes meet at a mirror inside `grid()`: the grid
keeps the full `GridState` and writes the moved keys out, because a `Partial` read behind a default
would hand a hole to `view.plan` and every other stage that reads one key and has no fallback. The
write out re-enters the reader above, which finds every key equal and dispatches nothing, so the
round trip stops one hop out rather than oscillating.

Only a signal is written back to. An observable, a thunk, and a plain object all seed a signal the
grid alone holds, so there is nowhere for a write out to land, and they behave as they always have.

`close()` releases both directions, so neither side reaches the other afterwards.

## Persisting

```ts
grid<Row>({ ...config, sync: "files" })
```

`sync` backs the state with `storageSignal(urlAdapter(key))`, so every key round-trips through the
url query string and a reload restores the grid. Passing `true` uses the grid id as the key.

That round trip is why a consumer key cannot be added to the type: the url adapter would have to
serialise a value it knows nothing about. Hold your own signal beside the grid and derive from
`g.state` instead.

## What a write does

A change reaches the derived chain, the renderer, and the url sync in the same tick. No callback is
registered and none is offered, which is argued on
[Signals instead of value and onChange](/why-signals).
