# GridState

Read or write any part of a grid through one signal. `GridState` is the whole of what a grid
remembers, and it is declared in `src/0_types.ts`.

```ts
g.state.$()                       // the whole record
g.state.sort.$()                  // one key
g.state.colHidden.size.$(true)    // one key of one record
g.state.colHidden.size.$.subscribe(handle)
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
| `focus` | one `CellId`, or nothing | the same page |
| `editing` | one `CellId`, or nothing | read by the renderer, written by no epic |

## View

| key | type | page |
| --- | --- | --- |
| `density` | compact, standard, or comfortable | [Density](/view-density) |
| `listView` | boolean | [List view and the transpose](/view-list) |
| `orientation` | rows or columns | the same page |
| `virtualize` | boolean | [Virtualization](/view-virtualize) |

## Why it is a type alias

The recursive proxy on `Signal<T>` gates on the parameter extending a record, and an interface
carries no implicit index signature. Declared as an interface, `g.state.sort.$()` would stop
typechecking, so the alias is the reason the proxy dots exist at all.

## Seeding

```ts
grid<Row>({ ...config, state: { virtualize: false, colHidden: { mtime: true } } })
```

The seed is read once. Handing in your own signal instead makes that signal the grid's state, which
is how two grids share one state or a caller keeps sole ownership of it.

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
