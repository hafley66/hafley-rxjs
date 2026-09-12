# signal-grid demos

Five routes over one shell. Each route mounts a grid, fills the control panel and the readout, and
hands back a teardown, so switching route stops the previous grid before the next one is built.

## Contents

- [Run it](#run-it)
- [The five routes](#the-five-routes)
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

Routing is `Route("/:demo")` from `@hafley66/signals` over `location.pathname`, so `base` is `/`
and vite's SPA fallback serves every route.

No dependency is added. Every route imports `../src/index.js` and `../src/theme.css` directly, so
an edit in `src/` shows up without a package build.

## The five routes

| Route | Data | What it is stressing |
| --- | --- | --- |
| `/everything` | 50,000 leaves, or the 50,636 node tree | Every implemented feature switched on together |
| `/tree` | 6 volumes, 636 directories, 50,000 files, five levels | Tree flattening and virtualization at the same time |
| `/matrix` | 8 regions by 7 columns | `orientation: "columns"`, live, with a 2 by 3 span becoming 3 by 2 |
| `/detail` | 400 orders, lines on demand | A second `grid()` inside a detail row, and the lazy path beside it |
| `/sheet` | 1,000,000 rows by 240 columns, minted from the index | Both seats of the window at once, and the ratio between the model and the document |

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
demo/5_sheet.ts
demo/5_sheet.test.ts  the chromium test behind /sheet, listed in DOM_TESTS
demo/controls.ts    control primitives, each a lens over a signal
demo/readout.ts     relation sizes, plan numbers, DOM counts, the frame meter, the actions$ log
demo/data.ts        the seeded filesystem generator
demo/scenarios.ts   preset states as plain data, used by /everything
```

## Frames

Every route's readout carries a **Frames** group under the DOM counts. One `requestAnimationFrame`
loop per mounted readout, sampling the gap between paints, throttled to a text write every 250 ms.

| stat | reads | why it is there |
| --- | --- | --- |
| `fps` | 1000 / mean gap over the last 90 frames | a rendered-cell count says nothing about whether the browser drew them in time |
| `worst frame` | longest gap still in the 90-frame window | one stutter during a drag never shows in an average |
| `frames over 32 ms` | running count since the readout mounted | two 60 Hz budgets; past it the browser was asked for a frame and skipped it |

The loop is inside `runWhenInView`, so a route scrolled off the page stops asking for frames. The
window is a `Float64Array` ring, one write and one 90-step sum per frame, so the meter does not
show up in its own reading.

## Console

`window.__grid` is the active route's grid. `window.__demo` is whatever that route wanted reachable.
`window.__sg` holds `grid`, `render` and `Signal`, so a console session can build a fifth grid.

```js
__grid.state.density.$("compact")
__grid.state.sort.$([{ field: "size", sort: "desc" }])
__grid.view.plan.$().span
__demo.applyScenario("Everything")      // /everything only
__demo.nested.state.sort.$([])          // /detail only, the newest nested grid
__demo.cellCount()                      // /sheet only, cells in the document right now
__routes                                // slug, title, features, defects
```

## Defects found

| # | Where | Symptom |
| --- | --- | --- |
| 1 | `src/10_render.ts:294` | A cell reads its value out of `current.data`, the row axis's own map, and under `orientation: "columns"` the vertical key is a column id, which owns no row value. Every cell renders empty. |
| 2 | `src/5_columns.ts:48` | `pinningFor` is exported and never called by the kernel, so `ColumnDef.pin` seeds nothing until a consumer seeds `colPinning` itself. |
| 3 | `src/10_render.ts:83` | `ColumnDef.movable` is read through a local patch type and is absent from `ColumnDef` in `src/0_types.ts`. |
| 4 | `src/0_types.ts:167` | Eight of the thirteen declared slots are never read by `10_render.ts`: `headerGroup`, `row`, `checkbox`, `resizeHandle`, `dragPreview`, `empty`, `loading`, `footer`. |
| 5 | `src/11_detail.ts:26` | The documented lazy-loading recipe calls `attach()`, which the package does not export. |

## Workarounds this directory carries

| Workaround | For | Where |
| --- | --- | --- |
| `state.colPinning` seeded from `pinningFor(schema)` | 2 | `demo/1_everything.ts` |
| The move grip is stamped by a header slot rather than by `movable: true` | 3 | `demo/1_everything.ts` |
| `relabelRowHeaders` rewrites the transposed header band after each pass | 1 | `demo/3_matrix.ts` |
| Nested render handles are held in a Map and stopped from outside the slot | 4 | `demo/4_detail.ts` |
| A local `attach` | 5 | `demo/4_detail.ts` |
