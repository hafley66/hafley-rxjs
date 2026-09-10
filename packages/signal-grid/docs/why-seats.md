# The seat table

Which axis scrolls is a state key, and no stage in the kernel branches on it. Two lookup tables
carry the whole transpose.

## The boundary

Past `src/12_transpose.ts` the kernel speaks of a vertical seat and a horizontal seat and never asks
which one holds a row.

```ts
g.state.orientation.$("columns")
g.view.vertical.$()      // whichever axis now scrolls, pages, and pins
g.view.horizontal.$()    // the other one
```

## The receipt

```sh
grep -rnE "if *\(.*orientation|orientation *===|orientation *!==" src/
```

That prints nothing and exits non-zero, tests included. Every read of the key is an index into a
table rather than a branch, and there are four of them in the grid constructor.

| table in `src/12_transpose.ts` | what it holds |
| --- | --- |
| `SEATS` | one row per orientation, mapping it to a seat pair |
| `FLIPPED` | the seat pair the other way round |

`transpose` in `src/12_transpose.ts` is its own inverse, which is what a round trip rests on, and
`src/12_transpose.test.ts` asserts that transposing twice returns the original plan.

A third orientation would be a third row in the table and no other edit anywhere.

## Why a branch would have been the wrong shape

Every stage that reads a row would need a column twin, so the branch that section one greps for
would appear once per stage rather than once. The seat pair moves that decision to the boundary and
leaves every stage below it monomorphic.

Spanning is the sharpest case. A span declared as two rows by three columns has to become three
rows by two columns after a flip, so a declaration in the reader's vocabulary cannot be what any
stage reads. `neutralSpan` in `src/12_transpose.ts` crosses it once, and the covered set swaps with
it. See [Span](/cells-span).

## What is finished, and what is not

| half | state |
| --- | --- |
| the model | asserted, including spans, the round trip, and list view |
| the renderer | a transposed grid builds its frame and writes no cell values |

A cell reads its value out of the row axis's own map, and under a transposed orientation the
vertical key is a column id, which owns no row value. Writing the key after a render moves the
header band and leaves the plan on the previous axis, which is the renderer's subscription rather
than the derivation: the same write with no renderer attached moves the plan correctly.

`demo/3_matrix.ts` carries the workaround, rewriting the transposed header band after each pass. The
route is on [Matrix](/showcase-matrix).

## List view is the same lever

`collapseToOneEntry` in `src/12_transpose.ts` keeps one entry on the horizontal axis, so every
vertical entry renders as a single cell. A list is a degenerate transpose rather than a second
rendering mode, which is why selection, pinning, and virtualization all keep working inside one.
