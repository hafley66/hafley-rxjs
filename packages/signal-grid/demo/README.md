# signal-grid demos

Four routes over one shell. Each route mounts a grid, fills the control panel and the readout, and
hands back a teardown, so switching route stops the previous grid before the next one is built.

## Contents

- [Run it](#run-it)
- [The four routes](#the-four-routes)
- [Shape](#shape)
- [Console](#console)
- [Defects found](#defects-found)
- [Workarounds this directory carries](#workarounds-this-directory-carries)

## Run it

```
cd packages/signal-grid
npx vite -c demo/vite.config.ts          # http://localhost:5179/everything
npx vite build -c demo/vite.config.ts    # demo/dist
npx vite preview -c demo/vite.config.ts
```

Routing is `Route("/:demo")` from `@hafley66/signals` over `location.pathname`, the way
`site/main.ts` does it, so `base` is `/` and vite's SPA fallback serves every route.

No dependency is added. Every route imports `../src/index.js` and `../src/theme.css` directly, so
an edit in `src/` shows up without a package build.

## The four routes

| Route | Data | What it is stressing |
| --- | --- | --- |
| `/everything` | 50,000 leaves, or the 50,636 node tree | Every implemented feature switched on together |
| `/tree` | 6 volumes, 636 directories, 50,000 files, five levels | Tree flattening and virtualization at the same time |
| `/matrix` | 8 regions by 7 columns | `orientation: "columns"`, live, with a 2 by 3 span becoming 3 by 2 |
| `/detail` | 400 orders, lines on demand | A second `grid()` inside a detail row, and the lazy path beside it |

Each panel opens with a card naming the `FeatureId`s the route exercises, read from
`src/features.ts` through `FEATURES`, so a renamed feature fails the build rather than the prose.
The same card lists the defects the route reproduces.

## Shape

```
demo/0_shell.ts     DemoRoute, DemoHosts, DemoHandle, the about card
demo/main.ts        route, nav, theme, mount and teardown, window.__grid
demo/1_everything.ts
demo/2_tree.ts
demo/3_matrix.ts
demo/4_detail.ts
demo/nested.ts      the two delegation workarounds
demo/controls.ts    control primitives, each a lens over a signal
demo/readout.ts     relation sizes, plan numbers, DOM counts, the actions$ log
demo/data.ts        the seeded filesystem generator
demo/scenarios.ts   preset states as plain data, used by /everything
```

## Console

`window.__grid` is the active route's grid. `window.__demo` is whatever that route wanted reachable.
`window.__sg` holds `grid`, `render` and `Signal`, so a console session can build a fifth grid.

```js
__grid.state.density.$("compact")
__grid.state.sort.$([{ field: "size", sort: "desc" }])
__grid.view.plan.$().span
__demo.applyScenario("Everything")      // /everything only
__demo.nested.state.sort.$([])          // /detail only, the newest nested grid
__routes                                // slug, title, features, defects
```

## Defects found

| # | Where | Symptom |
| --- | --- | --- |
| 1 | `src/10_render.ts:340` | The run expander is prepended into the first cell, so its chain is `g/r/c/expand` and no template matches. Clicking it does nothing. |
| 2 | `packages/xdom/src/1_domTemplate.ts:76` | `fromDelegatedRoute` walks to the document, so a nested grid's cell reads `g/r/g/r/c`. A grid inside a grid receives no events. |
| 3 | `src/10_render.ts:166`, `src/10_render.ts:457` | `Frame.data` is the row axis map, and `ensureRow` looks the vertical key up in it. Under `orientation: "columns"` the vertical key is a column id, so every cell renders empty. |
| 4 | `src/10_render.ts:150` vs `src/9_css.ts:68` | Two definitions of "is this node an entry": the renderer keeps a header group as a leaf, the track writer drops it. Nine cells against eight tracks. |
| 5 | `src/5_columns.ts:48` | `pinningFor` is exported and never called, so `ColumnDef.pin` seeds nothing. |
| 6 | `src/8_grid.ts:390` | `view.vertical` does not notify on an `orientation` write, so `plan` and `cols` keep the previous seating. |
| 7 | `src/10_render.ts:67` | `ColumnDef.movable` is read by the renderer and absent from the type. |
| 8 | `src/0_types.ts:168` | Seven of the thirteen declared slots are never read by `10_render.ts`. |
| 9 | `src/11_detail.ts:26` | The documented lazy-loading recipe calls `attach()`, which the package does not export. |
| 10 | `src/3_paths.ts:251` | `header.pointerdown` measures `delegateElement`, which for a resize is the 6px handle. A 130px column dragged 120px right lands on 126px. |
| 11 | `src/7_epics.ts:548` | `selectColumnsOnDrag` opens on a header part named `"select"`, and nothing in `bindRoot` ever stamps one, so column range selection is unreachable from the DOM. |

## Workarounds this directory carries

| Workaround | For | Where |
| --- | --- | --- |
| `bindExpander` re-raises `expander.click` off `data-row-id` | 1 | `demo/nested.ts` |
| `bindNested` re-raises header, cell and glyph intents inside a nested grid | 2 | `demo/nested.ts` |
| `paintTransposed` writes cell text and row headings after each pass | 3 | `demo/3_matrix.ts` |
| The header group toggle is off by default | 4 | `demo/1_everything.ts` |
| `state.colPinning` seeded from `pinningFor(schema)` | 5 | `demo/1_everything.ts` |
| `settleTranspose` writes `density` and `listView` twice after an orientation write | 6 | `demo/3_matrix.ts` |
| The move grip is stamped by a header slot rather than by `movable: true` | 7 | `demo/1_everything.ts` |
| Nested render handles are held in a Map and stopped from outside the slot | 8 | `demo/4_detail.ts` |
| A local `attach` | 9 | `demo/4_detail.ts` |
