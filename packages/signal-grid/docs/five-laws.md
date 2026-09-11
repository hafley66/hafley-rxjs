# The five laws

Five rules decide where any piece of behaviour goes. Knowing them lets you predict the API for a
feature you have not read about yet.

| # | law | what it buys you |
| --- | --- | --- |
| 1 | One deep state signal per grid, reached by proxy dots | `g.state.colWidth.name.$(140)` mints no signal at author time; the proxy makes it on first touch |
| 2 | Derivation is a chain of computed signals, one stage each | a stage that stops reading `group` stops depending on it, with no dependency list to maintain |
| 3 | Anything with a filter, a deadline, or a gesture is plain RxJS | a drag is `takeUntil` over a live pointer stream in `src/6_gestures.ts`, never a signal |
| 4 | One path template is the attributes, the event route, the CSS namespace, and the test selector | `src/3_paths.ts` declares each part once, so a selector cannot describe an element the renderer never draws |
| 5 | Every subscription is opened by `bind`, `render`, `writeGridVars`, or `runWhenInView` and handed back as a teardown | stopping a grid is one call, and a leak has exactly four places to be |

## Law 1 in practice

```ts
g.state.$()                     // the whole GridState
g.state.sort.$()                // one key
g.state.colHidden.size.$(true)  // one key of one record
runWhenInView(g.state.colHidden.size.$.pipe(tap(handle)))
```

A nested-path selector dedupes with `distinctShallow`, so writing one column's width does not wake
every other column's subscriber. That is measured on [No layout algorithm](/why-no-solver).

## Law 2 in practice

The view chain is eight computed signals, each readable on its own.

```ts
g.view.base.$()       // the row forest, from entries or from nested payloads
g.view.grouped.$()    // groupAxis, identity in server mode
g.view.sorted.$()     // sortAxis, identity in server mode
g.view.detailed.$()   // one extra node per open detail panel
g.view.flat.$()       // depth-first walk honouring expansion
g.view.plan.$()       // pinning, then paging, then the window
g.view.cols.$()       // the column forest after hide and reorder
g.view.widths.$()     // declared widths; the browser distributes flex
```

## Law 3 in practice

Signals cannot decline to emit, and a gesture is mostly declining. Resize, column move, and row move
are one `drag` operator in `src/6_gestures.ts` with three hit tests, driven by epics in
`src/7_epics.ts`.

## Law 4 in practice

| use | call | result |
| --- | --- | --- |
| DOM attributes | `rowAttrs` in `src/3_paths.ts` | `data-route="g/r"` plus `data-row-id` |
| event stream | `gridDom` in `src/3_paths.ts` | a delegated event carrying typed params |
| intent | `intentOf` in `src/3_paths.ts` | a `GridIntent`, with no state moved |
| CSS namespace | `colWidthVar` in `src/3_paths.ts` | a custom property named after the column |
| test selector | `selectorFor` in `src/3_paths.ts` | the same attributes, as a CSS selector |

## Law 5 in practice

```ts
const stop = g.bind(root)        // delegated listeners, keydown, epics
const handle = render(g, root)   // calls bind itself
handle.stop()
```

## Next

[Reading this site](/reading-this-site) explains the demo panel under every concept page.
