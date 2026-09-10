# signal-grid: the test suite, read as one document

Eight lanes wrote the suite without reading each other. This is the first pass over all of it at
once: a census, the duplicates, the cases that protect nothing, the holes, the drift, and what was
done about each.

Counted with `npx vitest run --reporter=json` on 2026-09-10. Three lanes were editing `src/` during
the pass, and `src/9_css.test.ts`, `src/10_render.test.ts`, `src/13_composite.test.ts`, and
`src/14_measure.test.ts` all landed mid-read. Each is folded into the census, and the last three
are left to the lanes still writing them.

Unit tests stand at 465 across 17 files (from `out/stats/unit.json`). Browser tests are unchanged at 15.

## TOC

1. [Census](#1-census)
2. [Duplicates](#2-duplicates)
3. [Tests that protect nothing](#3-tests-that-protect-nothing)
4. [Coverage holes ranked by risk](#4-coverage-holes-ranked-by-risk)
5. [Idiom drift](#5-idiom-drift)
6. [The unification proposal, and what it did](#6-the-unification-proposal-and-what-it-did)
7. [Source breakage found during the pass](#7-source-breakage-found-during-the-pass)

---

## 1. Census

Lines and counts are after the pass. The `before` column is what each file held when the read
started.

| file | lines | before | after | owns | source | kind |
| --- | ---: | ---: | ---: | --- | --- | --- |
| `src/1_axis.test.ts` | 459 | 38 | 38 | five axis operators, two constructors, two walks, cycle safety | `src/1_axis.ts` | unit, node |
| `src/2_operators.test.ts` | 533 | 56 | 55 | six operator sets, `buildRowPredicate`, four comparators, `buildComparator` | `src/2_operators.ts` | unit, node |
| `src/3_paths.test.ts` | 300 | 47 | 24 | templates, print/match round trip, attrs, selectors, `intentOf`, CSS var names | `src/3_paths.ts` | unit, node |
| `src/4_slice.test.ts` | 407 | 46 | 46 | `partition`, `paginate`, both sizers, `windowOf`, `sliceKeys`, `renderPlan`, `trackList` | `src/4_slice.ts` | unit, node |
| `src/5_columns.test.ts` | 261 | 27 | 26 | `selectAllState`, `toggleSelectAll`, six built-in factories, `pinningFor`, `rowSelectionMode` | `src/5_columns.ts` | unit, node |
| `src/7_epics.test.ts` | 269 | 25 | 43 | twelve epics, driven through `grid()` | `src/7_epics.ts`, `src/6_gestures.ts` | unit, node |
| `src/8_grid.test.ts` | 273 | 27 | 32 | `GridSource<T>`, the state signal, the view chain, server mode, `close()` | `src/8_grid.ts` | unit, jsdom |
| `src/9_css.test.ts` | 141 | 16 | 10 | `writeGridVars`: which entries become tracks, the write pass, the teardown | `src/9_css.ts` | unit, jsdom |
| `src/10_render.test.ts` | 385 | 24 | 50 | slot precedence, built-in routes, detail rows, signal slots, `stop()` | `src/10_render.ts` | unit, jsdom |
| `src/11_detail.test.ts` | 264 | 27 | 26 | detail keys, `withDetail`, `detailHeights`, `detailOnCellClick` | `src/11_detail.ts` | unit, node |
| `src/12_transpose.test.ts` | 239 | 31 | 19 | orientation, the two facets, `collapseToOneEntry`, spans, `coveredBy` | `src/12_transpose.ts` | unit, node |
| `src/13_composite.test.ts` | 189 | 14 | 14 | part ranks, the default stack, composite sorting, list view | `src/13_composite.ts` | unit, jsdom |
| `src/14_measure.test.ts` | 344 | 18 | 18 | one observer per store, measurement, estimate, buffer zone, scroll anchoring | `src/14_measure.ts` | unit, jsdom |
| `src/15_selection.test.ts` | 270 | new | 32 | the range model: `beginAt`, `extendTo`, `commitBlock`, `clearSelection`, `selectionTest` | `src/15_selection.ts` | unit, node |
| `src/16_menu.test.ts` | 368 | new | 19 | menu target resolution, anchor positioning | `src/16_menu.ts` | unit, jsdom |
| `src/features.test.ts` | 57 | 8 | 8 | totality of the `FEATURES` ledger | `src/features.ts` | unit, node |
| `src/theme.test.ts` | 87 | new | 5 | theme.css selectors held against what the router can address | `src/theme.css` | unit, node |
| `src/test/0_kit.ts` | 187 | new | n/a | the fixture, the grid factories, the one `epics$` helper, the intent builders | none | helper |
| `tests/0_delegation.e2e.test.ts` | 138 | 8 | 8 | delegated routing against a real hit test | `src/3_paths.ts`, `src/10_render.ts` | browser, chromium |
| `tests/1_render.e2e.test.ts` | 251 | 7 | 7 | rendered geometry read back out of layout | `src/10_render.ts`, `src/9_css.ts` | browser, chromium |
| `tests/2_visual.e2e.test.ts` | 641 | 5 | 5 | five filmed interactions, own vite lib build | `src/10_render.ts`, `src/theme.css` | browser, own config |

`vitest.e2e.config.ts:33` excludes `tests/2_visual.e2e.test.ts`, which runs under
`vitest.visual.config.ts` instead, so `npx vitest run -c vitest.e2e.config.ts` reports 15.

Source with no test file of its own: `src/0_types.ts` (data only), `src/6_gestures.ts`,
`src/index.ts`.

## 2. Duplicates

Eighteen cases removed. Every claim below still holds at the surviving site.

### 2.1 The whole of `8_grid.test.ts` restated as a transpose preamble

`src/12_transpose.test.ts` opened with `describe("orientation rows leaves every existing shape
alone")` and twelve cases that `src/8_grid.test.ts` already held, two of them character for
character.

| claim | deleted from | survives at |
| --- | --- | --- |
| width override beats the def | `12_transpose.test.ts:111` | `8_grid.test.ts:232` |
| header group becomes a parent edge | `12_transpose.test.ts:98` | `8_grid.test.ts:221` |
| explicit `colOrder` wins | `12_transpose.test.ts:92` | `8_grid.test.ts:215` |
| hiding a column drops it from the run | `12_transpose.test.ts:86` | `8_grid.test.ts:72` |
| descending flips the same comparator | `12_transpose.test.ts:80` | `8_grid.test.ts:68` |
| a sort write reorders rows | `12_transpose.test.ts:73` | `8_grid.test.ts:61` |
| the flat list is the row axis in source order | `12_transpose.test.ts:69` | `8_grid.test.ts:63` |
| a closed tree node hides its subtree | `12_transpose.test.ts:118` | `8_grid.test.ts:80`, `:85` |
| paging narrows the plan | `12_transpose.test.ts:137` | `8_grid.test.ts:99` |
| pinning is lifted out before paging | `12_transpose.test.ts:143` | `8_grid.test.ts:146` |
| virtualization off renders the page | `12_transpose.test.ts:152` | `8_grid.test.ts:110` |
| server mode skips the local stages | `12_transpose.test.ts:156` | `8_grid.test.ts:158` |

The one member of that describe with a claim of its own, `defaultState().orientation === "rows"`,
moved into the transpose describe at `src/12_transpose.test.ts:51` and grew the seat assertion the
old version lacked: under the default, `view.vertical` holds rows.

### 2.2 `trackList` grammar asserted twice

`src/4_slice.test.ts:347` tests `trackList` directly. `src/9_css.test.ts` tested the same grammar
again through `grid()` plus `writeGridVars`.

| claim | deleted from | survives at |
| --- | --- | --- |
| declared width becomes a px track, never `fr` | `9_css.test.ts:38` | `4_slice.test.ts:352` |
| flex becomes `fr` | `9_css.test.ts:45` | `4_slice.test.ts:362` |
| min and max become `minmax` | `9_css.test.ts:51` | `4_slice.test.ts:374` |
| min wraps a flexible max | `9_css.test.ts:57` | `4_slice.test.ts:370` |
| a bare column defaults to `100px` | `9_css.test.ts:63` | `4_slice.test.ts:358` |
| a mixed run joins in order | `9_css.test.ts:69` | `4_slice.test.ts:392` |

`src/9_css.test.ts:43` is now `describe("what becomes a track")` and holds only what `tracksOf`
adds: run order start/center/end (`:41`), a header group taking no track (`:56`), and a committed
resize freezing a flex column (`:65`).

### 2.3 Sorting through the grid, three times in one file

`src/8_grid.test.ts` wrote `state.sort` and read `view.flat` at three sites before the pass: `:84`,
`:97`, and `:233`. The third stayed, now at `src/8_grid.test.ts:207`, because it is the server-mode
describe's control and carries that reason. The `desc` case at `:97` folded into the write that
reaches it, now `src/8_grid.test.ts:61`, which asserts both directions.

### 2.4 Tree flattening, two levels of the same claim

Before the pass, `src/8_grid.test.ts:110` asserted the four keys an open node yields and `:116`
asserted the same four keys plus their depth and `hasChildren`. The second subsumed the first.
Merged, now `src/8_grid.test.ts:85`.

### 2.5 Twenty generated round trips, and six intents that copy params

`src/3_paths.test.ts:100` generated one `it` per path template, twice over, for twenty cases whose
bodies were one shared expression. The loop moved inside two cases at `src/3_paths.test.ts:109` and
`:113`, and the path name rides in the assertion so a failure still names the template.

`src/3_paths.test.ts` also had one `it` per `intentOf` member. Six of the fourteen only copy the
route params through and read the modifiers off the event; they are one table at
`src/3_paths.test.ts:197`. The other seven each carry a rule and kept their own case, renamed after
the rule rather than after the member.

### 2.6 Fixtures duplicated rather than shared

The same `TREE` literal was typed out at `src/7_epics.test.ts:30`, `src/8_grid.test.ts:26`, and
`src/12_transpose.test.ts:34`. The same `keys(nodes)` one-liner was redefined at
`src/1_axis.test.ts:46`, `src/8_grid.test.ts:34`, `src/11_detail.test.ts:37`, and
`src/12_transpose.test.ts:54`. All now come from `src/test/0_kit.ts`.

## 3. Tests that protect nothing

| site | verdict | reason |
| --- | --- | --- |
| `src/11_detail.test.ts:258` | **deleted** | Asserted `typeof slot === "function"` and `undefined === undefined`. It imported nothing from `11_detail.ts` and would have passed with the module deleted. The assignability it wanted is a `tsc --noEmit` claim, which `pnpm typecheck` already runs. Nothing else now asserts it, and nothing needs to. |
| `src/8_grid.test.ts:147` | **rewritten** | `expect(plan.center.length).toBeLessThanOrEqual(3)` over a three-row grid passed for every possible value. Now at `src/8_grid.test.ts:116`, asserting the actual claim: an unmeasured viewport renders nothing, the span is empty at the scroll anchor, and the spacer still measures the whole run. |
| `src/2_operators.test.ts:227` | **absorbed** | `dateTimeOperators.map(name)` compared against `dateOperators.map(name)` was true by construction: `dateSet(grain)` at `src/2_operators.ts:196` builds both from one literal. The name list is now pinned outright for both sets at `src/2_operators.test.ts:279`, which can fail. |
| `src/11_detail.test.ts:268` | **rewritten** | `const ctx = () => undefined as never` passed `undefined` where a `GridEpicCtx` was declared, and worked only because `detailOnCellClick` never reads `ctx` (`src/11_detail.ts:165`). The three epic cases now install the epic beside `defaultEpics()` and read `state.detail` back off the grid, which is the path a consumer takes. |

### The two accusations, checked before condemning

**`src/2_operators.test.ts`, 56 tests against a cut feature.** The cut is real.
`docs/1_parity.md:115` records `row.filter` as "no, by decision", and `buildRowPredicate` has no
caller in `src/`: the only import of `2_operators.js` outside its own test is `src/8_grid.ts:7`,
which takes `buildComparator` alone (`src/8_grid.ts:379`, `:342`). Roughly 44 of the 56 exercise
unwired code.

Not condemned. `src/index.ts:11` re-exports the module wholesale, so every operator set is package
API a consumer can call today, and deleting `buildRowPredicate` breaks that export rather than
going unnoticed. Each case also states a rule that can fail (`:64` an incomplete term must not
filter, `:91` zero and false are not empty, `:181` a bare `YYYY-MM-DD` is a local calendar day).
The finding is disproportion, not deadness: this one file is 15 percent of the suite for a feature
the parity table calls cut. One case went; the rest stand.

**`src/5_columns.test.ts`, 27 tests against factories no renderer could mount.** No longer true, on
two counts. `src/10_render.ts:65` routes the four glyph built-ins through `ROW_ROUTED` and
`src/10_render.ts:328` mounts `def?.cell`, so the factories are mounted; and
`src/10_render.test.ts:170` now asserts exactly that, one case per built-in. The two cases in this
file that had genuinely stopped protecting anything called the width solver the sizing lane had
deleted from `src/4_slice.ts`; that lane rewrote them against `trackList` during this pass.

## 4. Coverage holes ranked by risk

The last audit named `src/10_render.ts` and `src/9_css.ts` as 615 lines with zero unit tests. Both
were filled by other lanes while this pass ran: `src/9_css.test.ts` (10 cases after deduplication)
and `src/10_render.test.ts` (24 cases). What remains, ranked:

| rank | hole | size | the failure a test would have caught |
| --- | --- | ---: | --- |
| 1 | row reconciliation by key, `src/10_render.ts:544` | 30 lines | `reconcile` moves a row element with `insertBefore` rather than rebuilding it, which is the whole reason virtualization pays for itself. No test holds an element across two passes and asserts `toBe`: `grep -c "toBe(row\|toBe(first\|toBe(el" src/10_render.test.ts` answers 0. A scroll that rebuilt every row instead of moving it would tear down and rebuild every cell-level signal subscription per frame, and an editing cell would lose focus mid-keystroke, with the whole suite still green. |
| 2 | the orphan sweep, `src/10_render.ts:584` | 7 lines | A row that leaves the plan must have `record.subs.unsubscribe()` called. `src/10_render.test.ts:357` covers the stop-from-inside-a-slot case; the ordinary case, a row scrolling out of the window, is untested. A long scroll accumulates one live subscription per row ever rendered. |
| 3 | `src/6_gestures.ts` `drag` and `landingIndex` | 95 lines, 0 direct tests | The `merge` versus `concat` choice at `src/6_gestures.ts:56` decides whether the commit fires on the first pointerup or the second. It is reached only through `src/7_epics.test.ts`, so when that file broke on an unrelated source change the entire gesture layer was unprotected for the length of the break. `landingIndex`'s half-of-the-neighbour rule has no direct case at all. |
| 4 | `bindRoot`, `src/8_grid.ts:576` | 30 lines | Two grids on one page share every delegated listener, and only the filter at `src/8_grid.ts:587` separates them. A click in grid A dispatching into grid B passes every test today, because `tests/0_delegation.e2e.test.ts` renders one grid. |
| 5 | the teardown `bind` returns, `src/8_grid.ts:619` | 1 line | `close()` is covered at `src/8_grid.test.ts:244` and `:252`; the teardown `bind` hands back is not. A consumer that remounts accumulates one subscription set per mount, so the third mount dispatches every click three times. |
| 6 | `expandColumn`'s indent, `src/5_columns.ts:222` | 12 lines | Nothing reads the `margin-inline-start: calc(var(--sg-depth, N) * var(--sg-indent, 16px))` this writes. `src/10_render.test.ts:221` asserts the column replaces the run's expander, not that it indents. A tree would render every row at depth zero. |
| 7 | `ColumnDef.formula` and `FormulaApi`, `src/0_types.ts:210` | declared, no implementation | A consumer setting `formula` gets `undefined` in the cell with no error. Documented as cut on the Alternatives rejected page. |

None was filled. Holes 1, 2, and 6 belong inside `src/10_render.test.ts` and `src/5_columns.test.ts`
against source two other lanes are still editing; holes 3 through 5 want a new file. They are named
here and left.

## 5. Idiom drift

| axis | the voice | dissent, before | after |
| --- | --- | --- | --- |
| runner | `it` | `test` in `src/12_transpose.test.ts`, `src/10_render.test.ts`, `src/13_composite.test.ts`, `src/14_measure.test.ts` | `12_transpose` converted. The other three belong to lanes still writing them and keep `test` for now. The e2e files keep `test`, correctly: it is the `@hafley66/vitest-playwright` re-export. |
| `it` named after the rule | `src/1_axis.test.ts:88` "keeps siblings in first-seen order" | named after the function at `src/3_paths.test.ts:190` `"cell.click"`, `:196`, `:202`, `:214`, `:228`, `:244`, `:250`, `:256`, `:272` | all nine gone: six folded into one table, three renamed after the rule |
| `describe` name | split, and left split | the unit (`describe("partition")`, `describe("sortAxis")`) in seven files; the rule (`describe("pinning survives paging")`) in three | unchanged. The law binds the case name, and a describe naming its unit is the majority. Renaming `8_grid.test.ts`'s rule-shaped describes down to function names would be the worse of the two directions. |
| no manual `subscribe` | nine files read `.$()` only | `src/7_epics.test.ts:51` (`run`) owned the only legal one; `src/11_detail.test.ts:214`, `:221`, `:228` used `firstValueFrom` on a hand-built stream | one helper, `withEpics` in `src/test/0_kit.ts:97`. `11_detail` now installs the epic and reads state back. |
| one `epics$` helper | `run(g)`, private to `src/7_epics.test.ts` | nothing else could reach it | `withEpics(g)`, `src/test/0_kit.ts:97` |
| jsdom pragma | line 1 | consistent in all five jsdom files | unchanged |
| grid factory | one per file | `flatGrid()` in two files, `gridOf()` in two more, four different signatures | `flatGrid`/`treeGrid` in the kit, used by `7_epics` and `8_grid`. `12_transpose`, `9_css`, `10_render`, and `13_composite` keep local factories: each needs a fixture shape the shared one cannot serve (five entries and three columns, a two-column schema under test, a render host). |
| row fixture | `{ id, name, size }`, ids `a`, `b`, `c` | `r0`–`r4` plus `note` in `12_transpose`; no `size` in `11_detail`; Alpha/Beta in `10_render` | `Row`, `FLAT`, `TREE`, `COLUMNS` in the kit for the two files that shared a fixture verbatim. The rest are subject-specific and stay. |
| helper duplication | one definition | `keys(nodes)` four times, `TREE` three times, `pointer()` and `at()` once each but wanted twice | `keysOf`, `TREE`, `pointerStreams`, `at`, and eight intent builders now live once, at `src/test/0_kit.ts` |
| single lambda param named `it` | source only, `src/4_slice.ts:82` | `src/10_render.test.ts:193` and `:253` bind `it` inside a test file, shadowing vitest's | flagged, not changed: that file is owned by a lane still writing it |
| import of the unit under test | relative, `./4_slice.js` | `src/12_transpose.test.ts:6` imports the barrel `./index.js` | left. The transpose claim is that the package as a whole transposes, so the barrel is the right door for it. |

## 6. The unification proposal, and what it did

The API document listed a test kit since the first day, and it was a table pointing at
helpers that lived inside whichever test file wrote them first. `src/test/0_kit.ts` is now that
file. It holds the fixture (`Row`, `FLAT`, `TREE`, `COLUMNS`), the two grid factories, `keysOf`,
`withEpics`, `pointerStreams`, `at`, and eight intent builders. Two rules govern it, stated at the
top of the file: nothing subscribes except `withEpics`, and nothing reaches a document, so a file
takes the jsdom pragma only when its own subject needs one.

| file | action | before | after |
| --- | --- | ---: | ---: |
| `src/1_axis.test.ts` | keep whole | 38 | 38 |
| `src/2_operators.test.ts` | absorb the construction-true date-name case | 56 | 55 |
| `src/3_paths.test.ts` | 20 generated round trips become 2; 6 param-copy intents become 1; 3 renamed after their rule | 47 | 24 |
| `src/4_slice.test.ts` | keep whole; it owns the `trackList` grammar | 46 | 46 |
| `src/5_columns.test.ts` | merge the two affordance loops into one | 27 | 26 |
| `src/7_epics.test.ts` | adopt the kit; every case keeps its reason | 25 | 25 |
| `src/8_grid.test.ts` | adopt the kit; fold two duplicate cases; rewrite the tautology | 27 | 25 |
| `src/9_css.test.ts` | drop the six `trackList` restatements | 16 | 10 |
| `src/10_render.test.ts` | folded into the census, left to its lane | 24 | 24 |
| `src/11_detail.test.ts` | delete the tautology; drive the epic through `grid()` | 27 | 26 |
| `src/12_transpose.test.ts` | delete the 12-case duplicate preamble; `test` becomes `it`; adopt `keysOf` | 31 | 19 |
| `src/13_composite.test.ts` | folded into the census, left to its lane | 14 | 14 |
| `src/14_measure.test.ts` | folded into the census, left to its lane | 18 | 18 |
| `src/features.test.ts` | keep; `src/features.ts:373` explains why the ledger is hand-written | 8 | 8 |
| `tests/0_delegation.e2e.test.ts` | unchanged | 8 | 8 |
| `tests/1_render.e2e.test.ts` | unchanged | 7 | 7 |
| `tests/2_visual.e2e.test.ts` | unchanged | 5 | 5 |

Unit tests go **down**, 404 to 358. Browser tests hold at 15 under `vitest.e2e.config.ts` and 5
under `vitest.visual.config.ts`.

Where the 46 cases went:

| kind | count | where the claim still holds |
| --- | ---: | --- |
| duplicate of another site | 18 | the survivor named in section 2 |
| collapsed into a table-driven case | 26 | the same loop body, one `it` instead of N |
| merged restatement | 1 | the case it merged into, section 3 |
| tautology | 1 | nowhere. `src/11_detail.test.ts:258` asserted nothing to begin with, and the type claim it gestured at is `tsc`'s. |

## 7. Source breakage found during the pass

The sizing lane replaced the width solver with the CSS `trackList` grammar. `view.widths` now reports
declared widths (`src/8_grid.ts:432`), the browser owns distribution, and nothing in this suite is
red.

No source file was edited by this lane.
