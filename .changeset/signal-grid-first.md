---
"@hafley66/signal-grid": minor
---

New package: a relational data grid kernel with MUI X feature parity, no React and no table library.

Two ordered forests, rows and columns, over one `Axis<K, T>`. Five pure operators serve both: `axisOf`, `filterAxis`, `sortAxis`, `groupAxis`, `flattenAxis`. Windowing is a sixth in `4_slice.ts`, where `partition` handles pinning on either axis, `paginate` covers all three page modes, and `renderPlan` composes them in one order that a pinned row survives.

- **Transpose.** `state.orientation` swaps which axis scrolls. Zero branches on orientation anywhere in `src/`, two lookup tables in `12_transpose.ts`. Cell spanning transposes with it: a 2 by 3 span becomes 3 by 2 and the covered set swaps.
- **State is one signal.** `g.state.colWidth.name.$(140)` is the whole API. No value/onChange pairs anywhere.
- **Intents become changes through epics.** One `drag` operator serves resize, column move, and row move. One route-to-intent table in `bind(root)`.
- **Layout is the browser's.** `trackList` emits `grid-template-columns`, every row is a `subgrid` of it, pinned runs are sticky boxes. No width arithmetic in the package.
- **Paths do quadruple duty.** One template from `@hafley66/xdom` is the element id, the delegated event route, the CSS custom property namespace, and the test selector, and a test holds `theme.css` to it.
- Built-in columns, detail panels hosting a nested grid, composite cells, measured auto-sizing with an `IntersectionObserver` buffer zone, client and server mode, pages and infinite scroll.

Cut by decision: filtering, column type systems, inline editing, aggregation.
