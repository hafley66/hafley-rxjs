// createGrid auto-syncs each grid's state to one URL query param as a devalue
// blob. sync.key is route-local; the same gridStateParam is reused under any key.
import { Signal } from "@hafley66/signals"
import { slash } from "@hafley66/path"
import { z } from "zod"
import { createGrid, gridStateParam } from "@hafley66/grid"

const RowsA = z.object({ id: z.string(), n: z.number() })
const RowsB = z.object({ id: z.string(), label: z.string() })

const sourceA = Signal<z.infer<typeof RowsA>[]>([{ id: "1", n: 1 }])
const sourceB = Signal<z.infer<typeof RowsB>[]>([{ id: "1", label: "x" }])

// createGrid builds the URL-backed state signal itself when sync.key is set:
// storageSignal(urlAdapter(key), defaultState, gridStateParam). No call-site wiring.
const gridA = createGrid({
  schema: RowsA,
  rows: sourceA,
  getRowId: (r) => r.id,
  mode: "client",
  sync: { key: "a" },
})
const gridB = createGrid({
  schema: RowsB,
  rows: sourceB,
  getRowId: (r) => r.id,
  mode: "client",
  sync: { key: "b" },
})

// gridA writes -> ?a=<devalue>; gridB writes -> ?b=<devalue>. Neither grid knows
// the other exists. They share only the baked gridStateParam codec.
gridA.onSortingChange([{ id: "n", desc: true }])

// Route-level composition: the same gridStateParam mounts under each key for
// whole-URL printing/matching. Independent of the live grid instances.
const dash = slash("/dash?{a}&{b}", { params: { a: gridStateParam, b: gridStateParam } })
// dash.print({ a: gridA.state.$(), b: gridB.state.$() })
//   -> "/dash?a=%5B%5B%22n%22%2Ctrue%5D%5D&b=..."

export { gridA, gridB, dash }
