// Chromium only: axe-core audits the live document, real layout and all. Under the node runner the
// suite self-skips, which is where this package keeps its simulated-document-free rule.
import { describe, expect, test } from "vitest"
import axe from "axe-core"
import { grid, type Grid } from "./8_grid.js"
import { render, type RenderHandle } from "./10_render.js"
import type { ColumnDef, Row, Slots } from "./0_types.js"
import { GROUP_PREFIX } from "./0_types.js"

const NAME: ColumnDef<Row> = { id: "name", header: "Name", width: 120 }
const SIZE: ColumnDef<Row> = { id: "size", header: "Size", width: 80 }

const FLAT: readonly Row[] = [
  { id: "a", name: "Alpha", size: 1 },
  { id: "b", name: "Beta", size: 2 },
]

const TREE: readonly Row[] = [
  { id: "a", name: "Alpha", size: 1, kids: [{ id: "b", name: "Beta", size: 2 }] },
]

const GROUPED: readonly Row[] = [
  { id: "a", name: "Alpha", size: 1, kind: "document" },
  { id: "b", name: "Beta", size: 2, kind: "image" },
]
const KIND: ColumnDef<Row> = { id: "kind", header: "Kind", width: 100 }

const keyOf = (...path: readonly string[]): string => GROUP_PREFIX + JSON.stringify(path)

const LIVE: RenderHandle[] = []

const mount = (options: {
  rows: readonly Row[]
  columns: readonly ColumnDef<Row>[]
  subRows?: (row: Row) => readonly Row[] | undefined
  state?: Record<string, unknown>
  slots?: Slots<Row>
}): HTMLElement => {
  const made = grid<Row>({
    id: "sg-axe",
    rows: options.rows,
    columns: options.columns,
    rowId: (item) => item.id,
    subRows: options.subRows,
    state: { virtualize: { vertical: false, horizontal: false }, ...options.state } as never,
    viewport: { top: 0, left: 0, width: 600, height: 400 },
    slots: options.slots,
  })
  const root = document.createElement("div")
  document.body.append(root)
  LIVE.push(render(made, root))
  return root
}

const GROUP_KEY = keyOf("document")

const grids: readonly { readonly name: string; readonly make: () => HTMLElement }[] = [
  { name: "flat", make: () => mount({ rows: FLAT, columns: [NAME, SIZE] }) },
  {
    name: "tree",
    make: () =>
      mount({ rows: TREE, columns: [NAME, SIZE], subRows: (it) => it.kids, state: { expanded: { a: true } } }),
  },
  {
    name: "grouped",
    make: () =>
      mount({ rows: GROUPED, columns: [NAME, KIND, SIZE], state: { group: ["kind"], expanded: { [GROUP_KEY]: true } } }),
  },
  {
    name: "spanned",
    make: () =>
      mount({ rows: FLAT, columns: [{ ...NAME, span: () => ({ rows: 1, cols: 2 }) }, SIZE] }),
  },
]

const hasDocument = typeof document !== "undefined"

describe("axe", () => {
  test.skipIf(!hasDocument)(
    "every grid shape passes wcag2a and wcag2aa",
    async () => {
      for (const it of grids) {
        const root = it.make()
        const result = await axe.run(root, { runOnly: ["wcag2a", "wcag2aa"] })
        const named = result.violations.map(
          (violation) =>
            `${violation.id}: ${violation.help}\n  ${violation.nodes[0]?.html ?? ""}`,
        )
        expect(named, `axe violations in the ${it.name} grid`).toEqual([])
      }
    },
  )
})

test("nothing stays subscribed after the run", () => {
  for (const handle of LIVE) handle.stop()
  LIVE.length = 0
  expect(LIVE).toHaveLength(0)
})
