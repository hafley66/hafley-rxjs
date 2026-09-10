# signal-grid benchmarks

Numbers from a run that actually happened, on the machine this file records, including the two
places signal-grid loses.

## contents

| section | question it answers |
| --- | --- |
| [how to run](#how-to-run) | the two commands |
| [method](#method) | warmup, statistics, what stops dead-code elimination |
| [machine](#machine) | what the numbers were measured on |
| [data](#data) | the seeded generators and their checksums |
| [kernel operators](#kernel-operators) | cost of the operators in isolation, 1k to 1M |
| [head to head](#head-to-head-with-tanstacktable-core-910) | the same operations on both libraries |
| [not compared, and why](#not-compared-and-why) | operations only one library performs |
| [where TanStack wins](#where-tanstack-wins) | the two losses, with the reason for each |
| [reading the incremental rows](#reading-the-incremental-rows) | why the two sides are not doing equal work |
| [reactive derivation](#reactive-derivation) | which write reaches which memo |
| [the defect this run found](#the-defect-this-run-found) | a resize gesture recomputes the row pipeline |
| [allocation](#allocation) | retained bytes per row after a forced gc |
| [complexity claims checked](#complexity-claims-checked-against-the-numbers) | where a comment understates |
| [known gaps](#known-gaps) | what is not measured |

## how to run

```
cd packages/signal-grid
npx vitest bench -c bench/vitest.bench.config.ts
NODE_OPTIONS=--expose-gc npx vite-node -c bench/vitest.bench.config.ts bench/4_report.ts
npx tsc --noEmit -p bench/tsconfig.json
```

`bench/vitest.bench.config.ts` sets `outputJson: "bench/results.json"`, so the first command drops a
generated file in this directory. It is regenerated on every run and belongs in `.gitignore`.

The first command is the interactive runner. The second prints every table in this file. Both read
the same case lists, so neither can drift from the other: `bench/_cases.ts` exports `register`,
which hands a case to vitest's `bench`, and `measure`, which runs the same closure through a
median/p95 loop.

`vitest bench` is the primary runner and is not sufficient on its own. tinybench 2.9 reports p75 and
p99 but no p95, and vitest 4.1.10 drops `benchmark.includeSamples` on the way to the worker, so
`bench/results.json` comes back with `samples: []` and p95 cannot be recovered from it. That is why
`bench/4_report.ts` exists and why every table in this file comes from it, not from the vitest table.

One consequence, stated up front: `4_report.ts` runs all three case lists in a single process, so
every measurement carries the GC pressure of roughly a gigabyte of live fixtures. `vitest bench`
isolates per file and reads faster on identical cases: `vitest bench` reported a 113.5 ms mean and a
100.3 ms minimum for `sortAxis 1 key 100000`, and the same case in the kernel table has a 125.6 ms
median and a 117.8 ms minimum. Ratios between two rows of one table are sound; the absolute numbers
are the pessimistic end.

## method

- Warmup iterations run and are discarded. Every case pins `warmup` and `iterations`, so the sample
  count is exact rather than time-derived.
- Median and p95 are computed from the raw samples. `ops/s` is `1000 / mean`.
- Cases with 5 to 7 samples have a p95 that is just the largest sample. Read those as a worst
  observed case, not as a percentile.
- Sub-microsecond cases carry an `inner` batch count, printed as `n x inner`. One sample is the mean
  of `inner` consecutive calls.
- Every result is passed to `consume` in `bench/0_data.ts`, which folds it into a module-level word.
  No measured result in this suite is dead.
- Every case carries a null hypothesis in the comment attached to it: the result that would prove
  the design wrong.
- `bench/0_data.ts` is seeded xorshift32 with no clock, no environment and no filesystem read. The
  FNV-1a checksums in the data table are asserted at fixture load, so a generator edit fails the run
  rather than quietly invalidating the numbers.

## machine

- node v24.15.0, darwin arm64
- 12 x Apple M2 Pro
- 16 GiB RAM
- run 2026-09-10

## data

| set | rows | FNV-1a |
| --- | ---: | --- |
| flatRows(1000) | 1000 | 0xf41b6e57 |
| flatRows(10000) | 10000 | 0x461b92fe |
| flatRows(100000) | 100000 | 0xc750ffbf |
| treeRows(100000, 4, 5) | 124800 nodes, 100000 leaves | structural |

## kernel operators

### axisOf, flat relation

| benchmark | ops/s | median ms | p95 ms | min ms | n | what the number means |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| axisOf 1000 | 18,848 | 0.05192 | 0.06029 | 0.04867 | 200 | build the forest for 1000 flat rows: 2 passes, 4 maps, no parent edges |
| axisOf 10000 | 1,485 | 0.64587 | 0.75004 | 0.60792 | 60 | build the forest for 10000 flat rows: 2 passes, 4 maps, no parent edges |
| axisOf 100000 | 131 | 7.164 | 9.747 | 6.934 | 20 | build the forest for 100000 flat rows: 2 passes, 4 maps, no parent edges |
| axisOf 1000000 | 4.81 | 204.0 | 219.7 | 199.3 | 7 | build the forest for 1000000 flat rows: 2 passes, 4 maps, no parent edges |

### axisOf, one chain of depth n

| benchmark | ops/s | median ms | p95 ms | min ms | n | what the number means |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| axisOf chain 500 | 168 | 6.276 | 6.444 | 5.237 | 5 | 500 nodes where every node's parent is the node before it |
| axisOf chain 1000 | 39 | 25.703 | 26.354 | 25.351 | 5 | 1000 nodes where every node's parent is the node before it |
| axisOf chain 2000 | 9.16 | 109.2 | 109.7 | 108.5 | 5 | 2000 nodes where every node's parent is the node before it |
| axisOf chain 4000 | 2.25 | 445.1 | 448.6 | 438.7 | 5 | 4000 nodes where every node's parent is the node before it |

### sortAxis, one key

| benchmark | ops/s | median ms | p95 ms | min ms | n | what the number means |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| sortAxis 1 key 1000 | 1,891 | 0.52254 | 0.55000 | 0.50092 | 200 | re-sort 1000 roots on a numeric key, seats + Map.get per comparison |
| sortAxis 1 key 10000 | 139 | 7.093 | 7.905 | 6.844 | 60 | re-sort 10000 roots on a numeric key, seats + Map.get per comparison |
| sortAxis 1 key 100000 | 7.76 | 125.6 | 145.0 | 117.8 | 20 | re-sort 100000 roots on a numeric key, seats + Map.get per comparison |
| sortAxis 1 key 1000000 | 0.27 | 3663.2 | 3803.6 | 3560.6 | 7 | re-sort 1000000 roots on a numeric key, seats + Map.get per comparison |

### sortAxis, three keys

| benchmark | ops/s | median ms | p95 ms | min ms | n | what the number means |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| sortAxis 3 keys 1000 | 1,095 | 0.89204 | 0.93625 | 0.86371 | 200 | same 1000 roots, comparator falls through string, number, string |
| sortAxis 3 keys 10000 | 79 | 12.425 | 13.554 | 11.974 | 60 | same 10000 roots, comparator falls through string, number, string |
| sortAxis 3 keys 100000 | 4.91 | 201.7 | 217.2 | 191.5 | 20 | same 100000 roots, comparator falls through string, number, string |
| sortAxis 3 keys 1000000 | 0.20 | 4789.9 | 5365.5 | 4749.7 | 7 | same 1000000 roots, comparator falls through string, number, string |

### groupAxis, one level

| benchmark | ops/s | median ms | p95 ms | min ms | n | what the number means |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| groupAxis dept 1000 | 3,487 | 0.26075 | 0.33346 | 0.24954 | 200 | 1000 rows into 8 dept groups, forest rebuilt above the data edges |
| groupAxis dept 10000 | 299 | 3.154 | 4.706 | 2.984 | 60 | 10000 rows into 8 dept groups, forest rebuilt above the data edges |
| groupAxis dept 100000 | 24 | 40.880 | 45.705 | 34.991 | 20 | 100000 rows into 8 dept groups, forest rebuilt above the data edges |

### groupAxis, two levels

| benchmark | ops/s | median ms | p95 ms | min ms | n | what the number means |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| groupAxis dept+tier 1000 | 2,064 | 0.47375 | 0.50133 | 0.45675 | 200 | 1000 rows into 8 x 4 groups, two JSON group keys minted per row |
| groupAxis dept+tier 10000 | 178 | 5.317 | 7.524 | 4.998 | 60 | 10000 rows into 8 x 4 groups, two JSON group keys minted per row |
| groupAxis dept+tier 100000 | 16 | 61.702 | 70.516 | 57.533 | 20 | 100000 rows into 8 x 4 groups, two JSON group keys minted per row |

### flattenAxis, tree

| benchmark | ops/s | median ms | p95 ms | min ms | n | what the number means |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| flattenAxis all open, 124800 nodes | 51 | 17.668 | 24.452 | 16.090 | 20 | emit every node of a 124800-node, depth-4 forest |
| flattenAxis 10% open, 124800 nodes | 5,256 | 0.15142 | 0.25583 | 0.14179 | 200 | same forest, 2480 of 24800 internal nodes open |

### renderPlan, end to end

| benchmark | ops/s | median ms | p95 ms | min ms | n | what the number means |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| renderPlan uniform 100000 | 463 | 1.911 | 4.373 | 1.771 | 40 | partition + paginate + window over 100000 keys, O(1) sizer |
| renderPlan measured 100000 | 260 | 3.416 | 6.352 | 3.253 | 40 | same plan, sizer builds a 100001-entry prefix array every call |

### windowOf, 1M rows

| benchmark | ops/s | median ms | p95 ms | min ms | n | what the number means |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| windowOf measuredSizer 1M | 2,503,113 | 3.83e-4 | 5.01e-4 | 3.29e-4 | 200x500 | two binary searches over a 1,000,001-entry prefix array, random scroll offset |
| windowOf uniformSizer 1M | 32,641,944 | 2.87e-5 | 3.53e-5 | 2.65e-5 | 200x500 | the same window through two divisions, the uniform-sizer control |
| measuredSizer construction 1M | 56 | 17.562 | 20.660 | 17.397 | 10 | the one-time O(n) prefix pass that the binary search reads |


## head to head with @tanstack/table-core 9.1.0

### sort 100k, one numeric key

| benchmark | ops/s | median ms | p95 ms | min ms | n | what the number means |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| ours: sortAxis | 5.70 | 167.0 | 216.3 | 150.4 | 20 | sort 100k RowIds, seat index for stability, Map.get per value read |
| tanstack: getSortedRowModel | 4.82 | 193.9 | 253.6 | 176.2 | 20 | sort 100k Row instances, row.index for stability, values already cached |

### group 100k, one level on dept

| benchmark | ops/s | median ms | p95 ms | min ms | n | what the number means |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| ours: groupAxis | 24 | 42.669 | 45.812 | 35.094 | 20 | 8 synthetic group keys, forest rebuilt, 100k rows re-parented |
| tanstack: getGroupedRowModel | 27 | 34.343 | 44.953 | 31.246 | 20 | 8 group Rows constructed, 100k leaf rows distributed into subRows |

### expand 124800-node tree, 10% of internal nodes open

| benchmark | ops/s | median ms | p95 ms | min ms | n | what the number means |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| ours: flattenAxis | 6,161 | 0.16163 | 0.17554 | 0.14942 | 100 | walk the open frontier, allocate one FlatNode per visible row |
| tanstack: getExpandedRowModel | 1,573 | 0.59400 | 0.62967 | 0.57954 | 100 | same frontier, push existing Row references into a new array |

### incremental, change the sort key and re-derive

| benchmark | ops/s | median ms | p95 ms | min ms | n | what the number means |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| ours: state.sort write + view.flat read | 5.68 | 173.1 | 219.3 | 161.0 | 15 | sortAxis over 100k plus flattenAxis allocating 100k FlatNodes |
| tanstack: sorting set + getRowModel | 5.06 | 195.8 | 248.3 | 185.4 | 15 | sorted stage reruns over 100k Rows, expanded and paginated stages hit cache |

### incremental, change a key the row pipeline does not read

| benchmark | ops/s | median ms | p95 ms | min ms | n | what the number means |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| ours: state.colWidth write + view.flat read | 4.74 | 190.1 | 397.0 | 168.0 | 15 | one column width changes, then the flat row list is read back |
| tanstack: columnSizing set + getRowModel | 632,853 | 0.00145 | 0.00317 | 9.83e-4 | 15x20 | same edit, no row-model memo dep moved, so every stage answers from cache |

### incremental, no write, read the derived list

| benchmark | ops/s | median ms | p95 ms | min ms | n | what the number means |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| ours: view.flat read | 5,184,200 | 1.31e-4 | 3.81e-4 | 9.75e-5 | 200x200 | a clean memo answers from its stored value |
| tanstack: getRowModel | 2,115,371 | 4.59e-4 | 5.66e-4 | 4.28e-4 | 200x200 | the dep tuple is unchanged at every stage, so the cached model is returned |


### not compared, and why

- renderPlan: TanStack leaves pinning geometry and virtualization to the adapter (@tanstack/react-virtual), so there is no core-side pipeline to time against it.
- axisOf vs constructTable: TanStack builds a Row instance with per-cell value caches; axisOf builds four maps over the caller's own objects. The one-time costs are reported side by side in the allocation table and labelled, not ranked.
- windowOf: no table-core equivalent. The nearest thing lives in a different package with a different data model.

## where TanStack wins

Two rows in the head to head go against signal-grid.

### grouping 100k rows on one key

TanStack is 1.24x faster: 34.3 ms against 42.7 ms at the median. `groupAxis` makes three full passes
over the axis before it places a single row. One collects the units, one copies `by` while dropping
old group keys, one copies `parent` and `children` while dropping group edges. Then it walks the
units and calls `JSON.stringify` on the path once per row per level to mint the group key.
TanStack's grouped model buckets rows into arrays keyed by the raw value, constructs 8 group `Row`
instances and leaves the leaf rows alone. It never stringifies and it never rebuilds a parent map.

The difference is bought, not lost. `groupAxis` is total over tree data and idempotent, so a unit
travels with its own subtree and the forest above it has to be rebuilt; TanStack's grouped model
does not carry that property. The price of the guarantee is about 8 ms per 100k rows here. The
cheapest way to get most of it back without giving the guarantee up is to replace `groupKeyOf`'s
`JSON.stringify` with a delimiter join over the level values, which is the same 8-group key space
without a JSON encoder in the inner loop.

### changing a state key the row pipeline does not read

TanStack is 131,000x faster: 0.00145 ms against 190.1 ms. It is the most important row in the file
and the next section is about it.

### everything else

signal-grid takes the other four rows, on median and on p95 alike. The whole head to head in one
table, losses included:

| operation | signal-grid median | table-core median | ratio |
| --- | ---: | ---: | ---: |
| sort 100k, one numeric key | 167.0 ms | 193.9 ms | 1.16x ours |
| expand a 124,800-node tree, 10 percent open | 0.162 ms | 0.594 ms | 3.67x ours |
| change the sort key and re-derive | 173.1 ms | 195.8 ms | 1.13x ours |
| no write, read the derived list | 0.000131 ms | 0.000459 ms | 3.5x ours |
| change a width and re-derive | 190.1 ms | 0.00145 ms | 131,000x theirs |
| group 100k on one key | 42.7 ms | 34.3 ms | 1.24x theirs |

Retained memory is the other margin: `axisOf` over 100k rows holds 46 bytes per row on top of the
caller's own objects, against 786 bytes per row for `constructTable` plus its core row model, a 17x
gap. TanStack buys per-cell value caches with those bytes, which is what makes its re-sort
comparator cheap.

The two runners disagree on magnitude and agree on direction, which is the check that matters. The
same six rows as `vitest bench` reports them, per-file isolated rather than one process:

| operation | vitest bench ratio | `4_report.ts` ratio |
| --- | --- | --- |
| sort 100k, one numeric key | 1.56x ours | 1.16x ours |
| expand a 124,800-node tree, 10 percent open | 4.06x ours | 3.67x ours |
| change the sort key and re-derive | 1.24x ours | 1.13x ours |
| no write, read the derived list | 3.84x ours | 3.5x ours |
| change a width and re-derive | 367,046x theirs | 131,000x theirs |
| group 100k on one key | 1.17x theirs | 1.24x theirs |

## reading the incremental rows

The two sides do not do the same amount of work on a sort change, and the asymmetry favours
TanStack, so the win has to be read with that in hand.

| side | what runs on a `sort` change | what it produces |
| --- | --- | --- |
| signal-grid | `grouped` (early return, no group keys set), `sortAxis` over 100k, `flattenAxis` over 100k | a `FlatNode[]` with depth, parent, index and hasChildren per row, ready for the virtualizer |
| table-core | `sortedRowModel` over 100k `Row` instances; `expandedRowModel` and `paginatedRowModel` return their input unchanged because the table is flat and nothing is expanded | the sorted `Row[]` |

signal-grid allocates 100k `FlatNode` objects that TanStack never allocates, and still finishes
first. On the no-write read both sides are pure cache reads, and the gap is the cost of the lookup
itself: one dirty flag against a dependency-tuple comparison at every stage of a six-stage pipeline.

## reactive derivation

### reactive, 1k rows

| benchmark | ops/s | median ms | p95 ms | min ms | n | what the number means |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| read view.flat, no write (1k rows) | 9,383,993 | 1.04e-4 | 1.38e-4 | 8.81e-5 | 200x200 | the clean-memo floor: one dirty check and a stored array |
| state.sort write then view.flat read (1k rows) | 1,188 | 0.80429 | 0.92129 | 0.76512 | 60 | sortAxis plus flattenAxis, the work a sort change owes |
| state.colWidth write then view.flat read (1k rows) | 1,207 | 0.80975 | 0.90729 | 0.75129 | 60 | a write no row-pipeline stage reads, then the flat list is read back |
| 1000 sequential colWidth writes, nothing subscribed (1k rows) | 1.35 | 742.8 | 746.3 | 723.7 | 5 | 1000 pointermove-sized writes with no read between them |
| 1000 sequential colWidth writes, view.plan subscribed (1k rows) | 1.13 | 878.0 | 905.0 | 867.3 | 5 | the same burst on a grid that is rendering, so every stage has an observer |

### reactive, 100k rows

| benchmark | ops/s | median ms | p95 ms | min ms | n | what the number means |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| read view.flat, no write (100k rows) | 10,790,705 | 9.15e-5 | 9.88e-5 | 8.79e-5 | 200x200 | the clean-memo floor: one dirty check and a stored array |
| state.sort write then view.flat read (100k rows) | 5.49 | 182.0 | 198.0 | 171.0 | 12 | sortAxis plus flattenAxis, the work a sort change owes |
| state.colWidth write then view.flat read (100k rows) | 5.71 | 174.7 | 184.8 | 165.0 | 12 | a write no row-pipeline stage reads, then the flat list is read back |
| 20 sequential colWidth writes, nothing subscribed (100k rows) | 0.30 | 3291.6 | 3530.4 | 3265.5 | 5 | 20 pointermove-sized writes with no read between them |
| 20 sequential colWidth writes, view.plan subscribed (100k rows) | 0.24 | 4063.5 | 4829.7 | 4020.6 | 5 | the same burst on a grid that is rendering, so every stage has an observer |

## the defect this run found

`state.colWidth` is read by `view.widths` and by no stage of the row pipeline. A dependency-scoped
memo should therefore answer `view.flat` from cache after a width change. It does not, and the two
rows are the same number at both sizes:

| size | sort write, then read `view.flat` | colWidth write, then read `view.flat` |
| --- | ---: | ---: |
| 1k rows | 0.804 ms | 0.810 ms |
| 100k rows | 182.0 ms | 174.7 ms |

Per write during a resize drag, which is one write per pointermove:

| size | nothing subscribed | `view.plan` subscribed |
| --- | ---: | ---: |
| 1k rows | 0.74 ms | 0.88 ms |
| 100k rows | 165 ms | 203 ms |

The 100k figures are 20 writes measured and divided. A 1000-write drag extrapolates to 165 and
203 seconds; the burst case is capped at 20 writes at that size because the full gesture does not
finish inside a benchmark.

The mechanism, measured directly rather than inferred:

| observation | result |
| --- | --- |
| repeated `view.flat.$()` with no write | memo holds, about 100 ns |
| write `state.b`, read a memo that only ever read `state.a` | memo recomputes |
| subscribe `state.a.$`, write `state.b` three times | 3 emissions on the `state.a` selector |
| the same with `distinctUntilChanged()` spliced into the selector | 0 emissions, and the one real write still emits |
| chained memo, write an unrelated key, never read | the upstream memo recomputes at write time |

Two causes, both in `@hafley66/signals`, neither in `packages/signal-grid`:

1. `1_SignalCreator.ts` builds the nested-path selector as
   `root$.pipe(map((i) => get(i, path)), tap(...), shareReplay(...))`. No `distinctUntilChanged`, so
   every root push emits on every path signal whether or not the value at that path moved. immer
   already preserves reference identity for untouched subtrees, so `===` is a sound comparison here
   and the fix is one operator.
2. `createComputedSignal.invalidate` recomputes eagerly whenever `subscriberCount > 0`, and a
   downstream memo holds a subscription on its upstream memo. `sorted` therefore has a subscriber
   even when nothing subscribes to `view.flat`. Cause 1 dirties it and cause 2 moves the recompute
   to write time, which is why a 1000-write burst is expensive with no read anywhere in it.

The patch for cause 1, exactly:

```ts
// packages/signals/src/1_SignalCreator.ts
import { BehaviorSubject, distinctUntilChanged, filter, map, merge, Observable, shareReplay, Subject, tap } from "rxjs"
// ...
            autoSelector$ = root$.pipe(
              map((i) => get(i, path)),
              distinctUntilChanged(),
              tap({
```

Cause 2 is a design call rather than a bug, and cause 1 on its own removes the spurious
invalidations that make it expensive.

## allocation

| structure | retained after gc | bytes per unit |
| --- | ---: | ---: |
| flatRows(100000), the source data | 13.7 MiB | 144 B |
| axisOf over 100k rows | 4.4 MiB | 46 B |
| sortAxis result, 100k | 0.8 MiB | 8 B |
| groupAxis result, 100k into 8 | 10.8 MiB | 113 B |
| flattenAxis, 124,800 nodes all open | 8.9 MiB | 75 B |
| measuredSizer prefix array, 1M | 7.6 MiB | 8 B |
| TanStack constructTable + core model, 100k | 74.9 MiB | 786 B |

## complexity claims checked against the numbers

| operator | comment claims | measured | verdict |
| --- | --- | --- | --- |
| `axisOf`, no `parentOf` | "two passes" | 12.4x, 11.1x, then 28.5x per decade | claim holds, see note |
| `axisOf`, with `parentOf` | "two passes" | 4.1x per doubling of a chain | **claim understates** |
| `sortAxis` | stability via a seat index | 13.6x, 17.7x, 29.2x per decade | claim holds, see note |
| `groupAxis` | one level per key function | a second level adds 51 to 82 percent, not 100 | claim holds |
| `flattenAxis` | "skipping the subtree of a closed node" | 10 percent open is 117x cheaper than all open | claim holds |
| `uniformSizer` | "every method O(1), no allocation" | 29 ns per `windowOf` at 1M rows | claim holds |
| `measuredSizer` | "O(n) once", "O(log n) binary search" | construction 17.6 ms at 1M, `windowOf` 13.3x the uniform path | claim holds |
| `renderPlan` | no complexity claim | O(total rows) per call, virtualized or not | not a violated claim, see note |

### `axisOf` with `parentOf` is not two passes

The second loop calls `returnsToSelf(key, raw)` for every key that names a known parent, and
`returnsToSelf` allocates a `Set` and walks the whole ancestor chain. That is O(n * depth), which is
O(n^2) on a path-shaped relation. Measured on a single chain where every node's parent is the node
before it: 500 nodes 6.3 ms, 1000 nodes 25.7 ms, 2000 nodes 109 ms, 4000 nodes 445 ms. Each doubling
costs 4.1x, which is the signature of a quadratic.

A flat relation never reaches the walk, because `parentOf` is absent and `raw` stays empty, so
`grid({ rows })` is unaffected. `grid({ rows, subRows })` goes through `fromTree` and is also
unaffected. The caller who pays is the one building an axis from explicit parent ids, which is the
whole reason `axisOf(entries, parentOf)` takes a second argument.

The fix is one colour-marking pass over `raw`, hoisted above the loop, replacing the per-key walk:

```ts
/** Every key standing on a parent cycle, found in one pass rather than one ancestor walk per key. */
const cycleMembers = <K extends string>(raw: ReadonlyMap<K, K>): ReadonlySet<K> => {
  const onCycle = new Set<K>()
  const done = new Set<K>()
  for (const start of raw.keys()) {
    if (done.has(start)) continue
    const path: K[] = []
    const seen = new Map<K, number>()
    let at: K | undefined = start
    while (at !== undefined && !done.has(at) && !seen.has(at)) {
      seen.set(at, path.length)
      path.push(at)
      at = raw.get(at)
    }
    const from = at === undefined ? -1 : (seen.get(at) ?? -1)
    if (from >= 0) for (let i = from; i < path.length; i++) onCycle.add(path[i] as K)
    for (const key of path) done.add(key)
  }
  return onCycle
}
```

Then `returnsToSelf(key, raw)` in the second loop becomes `onCycle.has(key)`, with
`const onCycle = cycleMembers(raw)` hoisted out of it. Same semantics: `returnsToSelf` is true
exactly when the key stands on a cycle, which is what the colour pass marks. Checked against the
current implementation on 3000 random parent maps of 2 to 15 nodes with self-edges excluded: every
key agrees.

### the 100k to 1M step

Both `axisOf` and `sortAxis` cost about 12 to 18x per decade up to 100k and about 29x for the last
one. That is not an extra algorithmic pass; it is a `Map` with a million entries falling out of
cache, plus the rehash growth on the way there. The comments do not claim otherwise. `sortAxis`
could take most of it back by reading each key's sort value once into the seat instead of doing a
`Map.get` per comparison, which turns O(n log n) map lookups into O(n).

### `renderPlan` is linear per scroll tick

`partition` buckets the entire flat key list into three arrays on every call, and `8_grid.ts` maps
`FlatNode[]` to a key array before calling it. Both are O(total rows), so a scroll event at 100k
rows costs a full pass whether or not `virtualize` is on: 1.91 ms with a uniform sizer, 3.42 ms with
a measured one. Nothing in the comments claims O(1), so this is a note rather than a violated claim,
but it is the ceiling on how large a virtualized grid can get before scrolling drops frames.

## known gaps

- No DOM. The suite covers the kernel and the derivation chain in node. Paint, layout and event
  dispatch are not measured.
- `filterAxis` and `flexWidths` are not benchmarked. `flexWidths` runs one pass per clamped column,
  so it is O(columns^2) in the worst case; its comment discloses that, and it is bounded by a column
  count rather than a row count.
- TanStack is measured through `@tanstack/table-core` only. `@tanstack/react-table` adds React work
  that is not in these numbers, and neither is `@tanstack/react-virtual`.
- GC pauses land inside samples. The allocation table is the separate, forced-gc measurement.
- The p95 column on 5-sample and 7-sample cases is the maximum sample.
