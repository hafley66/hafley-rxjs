// Route 4. Both things a cell click can mean. One opens a detail row holding a second full grid;
// the other loads that row's children into the row axis and expands it, with no panel at all.
import { Signal } from "@hafley66/signals"
import { filter, Subscription } from "rxjs"
import {
  BUILT_IN_IDS,
  defaultEpics,
  detailColumn,
  detailHeights,
  detailOnCellClick,
  grid,
  render,
  type ColumnDef,
  type GridIntent,
  type GridState,
  type RenderHandle,
  type RowCtx,
  type RowId,
  type Viewport,
} from "../src/index.js"
import { actions, checkField, group, h, readbackField } from "./controls.js"
import { readout } from "./readout.js"
import { aboutPanel, stageBox, type DemoHandle, type DemoHosts, type DemoRoute } from "./0_shell.js"

// --- Data -------------------------------------------------------------------

interface OrderRow {
  readonly id: string
  readonly label: string
  readonly region: string
  readonly total: number
  readonly placed: string
  readonly kind: "order" | "line"
  readonly children?: readonly OrderRow[]
}

interface Line {
  readonly id: string
  readonly item: string
  readonly qty: number
  readonly unit: number
  readonly amount: number
}

const REGIONS = ["north", "south", "east", "west"] as const
const PARTS = ["bracket", "spindle", "gasket", "rotor", "bushing", "pin", "shim"] as const

const ORDER_COUNT = 400

const ORDERS: readonly OrderRow[] = Array.from({ length: ORDER_COUNT }, (_unused, index) => ({
  id: `order-${String(index).padStart(4, "0")}`,
  label: `customer-${String((index * 7) % 120).padStart(3, "0")}`,
  region: REGIONS[index % REGIONS.length] ?? "north",
  total: 1200 + ((index * 137) % 8800),
  placed: new Date(Date.UTC(2026, 0, 1 + (index % 240))).toISOString().slice(0, 10),
  kind: "order",
}))

/** Deterministic from the order id, so a lazy load and a panel show the same lines. */
const linesOf = (order: string): readonly Line[] => {
  const seed = [...order].reduce((carry, it) => carry + it.charCodeAt(0), 0)
  const count = 3 + (seed % 5)
  return Array.from({ length: count }, (_unused, index) => {
    const qty = 1 + ((seed + index * 13) % 9)
    const unit = 25 + ((seed + index * 31) % 180)
    return {
      id: `${order}/line-${index}`,
      item: PARTS[(seed + index) % PARTS.length] ?? "bracket",
      qty,
      unit,
      amount: qty * unit,
    }
  })
}

const childRowsOf = (order: string): readonly OrderRow[] =>
  linesOf(order).map((it) => ({
    id: it.id,
    label: it.item,
    region: "",
    total: it.amount,
    placed: "",
    kind: "line",
  }))

/** The `attach` the lazy-loading recipe in `src/11_detail.ts` names but the package never exports. */
const attach = (
  rows: readonly OrderRow[],
  id: RowId,
  kids: readonly OrderRow[],
): readonly OrderRow[] => rows.map((it) => (it.id === id ? { ...it, children: kids } : it))

const LINE_COLUMNS: readonly ColumnDef<Line>[] = [
  { id: "item", header: "Item", width: 160, resizable: true },
  { id: "qty", header: "Qty", type: "number", width: 80, resizable: true },
  { id: "unit", header: "Unit", type: "number", width: 90, resizable: true },
  { id: "amount", header: "Amount", type: "number", width: 110, resizable: true },
]

const PANEL_HEIGHT = 210

// --- The route --------------------------------------------------------------

export const detailDemo: DemoRoute = {
  slug: "detail",
  title: "Master detail",
  blurb:
    "Clicking the disclosure or the customer cell opens a row that spans every column and holds a " +
    "second grid over that order's lines. Clicking the region cell takes the other path and loads " +
    "the same lines into the row axis instead.",
  stressing:
    "A grid inside a grid. The nested one has its own sort and its own pinning, and the panel it " +
    "lives in is a real node of the outer row axis, so the scroll spacer has to account for it.",
  features: ["row.detail", "row.tree", "row.expand", "row.sort", "col.pin", "col.resize", "view.slots", "view.virtualize.row"],
  defects: [
    "A slot has no teardown hook, so the nested render handle has to be tracked outside the slot and stopped when the panel closes or the row rebuilds.",
    "Arrow keys inside the nested grid move both grids: each render() opens its own keydown listener on its own root and the event bubbles to the outer one.",
  ],
  mount,
}

function mount(hosts: DemoHosts): DemoHandle {
  const subs = new Subscription()
  const box = stageBox(hosts, "stage-box")

  let queued = false
  const groups: { refresh: () => void }[] = []

  function refresh(): void {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      for (const entry of groups) entry.refresh()
    })
  }

  const source = Signal<readonly OrderRow[]>(ORDERS)
  const loaded = new Set<RowId>()
  const pending = new Set<RowId>()
  // The nested grid needs no hand-wired delegation: `data-route-boundary` on its own root ends the
  // ancestor walk, so its cells compose `g/r/c` against it rather than `g/r/g/r/c` against the page.
  let lastNested: unknown = null

  const detailSlot = (ctx: RowCtx<OrderRow>) => {
    const host = h("div", "nested-host")
    const head = h("div", "nested-head")
    head.append(
      h("span", "nested-title", `${ctx.data.label} · ${ctx.row}`),
      h("span", "nested-note", "its own sort and its own pinned column"),
    )
    const into = h("div", "nested-grid")
    host.append(head, into)
    const inner = grid<Line>({
      id: `lines-${ctx.row}`,
      rows: linesOf(ctx.row),
      columns: LINE_COLUMNS,
      rowId: (it) => it.id,
      state: {
        virtualize: false,
        sort: [{ field: "amount", sort: "desc" }],
        colPinning: { item: "start" },
      },
    })
    const handle = render(inner, into)
    lastNested = inner
    window.__demo["nested"] = inner
    // The slot hands back its own teardown, so the nested grid stops when its panel closes without
    // a panel registry outside the slot.
    return { content: host, unsubscribe: handle.stop }
  }

  const COLUMNS: readonly ColumnDef<OrderRow>[] = [
    detailColumn<OrderRow>(),
    { id: "label", header: "Customer", flex: 1, minWidth: 200, resizable: true },
    { id: "region", header: "Region (loads children)", width: 200, resizable: true },
    { id: "total", header: "Total", type: "number", width: 110, resizable: true },
    { id: "placed", header: "Placed", width: 120, resizable: true },
  ]

  const seedBox = box.getBoundingClientRect()
  const viewport = Signal<Viewport>({
    top: 0,
    left: 0,
    width: Math.round(seedBox.width),
    height: Math.round(seedBox.height),
  })

  const orders = grid<OrderRow>({
    id: "detail",
    rows: source,
    columns: COLUMNS,
    rowId: (it) => it.id,
    subRows: (it) => it.children,
    state: Signal<Partial<GridState>>({ virtualize: true, colPinning: { [BUILT_IN_IDS.detail]: "start" } }),
    viewport,
    overscan: 4,
    epics: [
      ...defaultEpics<OrderRow>(),
      detailOnCellClick<OrderRow>({ columns: [BUILT_IN_IDS.detail, "label"] }),
    ],
    slots: { detail: detailSlot },
  })

  const handle = render(orders, box)

  // A panel is tall and variable, so its key needs a height or the sizer measures it at the
  // density default and the scroll drifts by the difference on every open.
  subs.add(
    orders.state.detail.$.subscribe((open) => {
      const next = detailHeights(open, PANEL_HEIGHT)
      const current = orders.state.rowHeight.$()
      const keys = Object.keys(next)
      const same =
        keys.length === Object.keys(current).length && keys.every((it) => current[it] === next[it])
      if (!same) orders.state.rowHeight.$(next)
      refresh()
    }),
  )

  // --- the other path: lazy children, no panel ------------------------------

  const isCellClick = (action: GridIntent): action is Extract<GridIntent, { type: "cell.click" }> =>
    action.type === "cell.click"

  subs.add(
    orders.intent$
      .pipe(
        filter(isCellClick),
        filter((it) => it.col === "region"),
        filter((it) => !loaded.has(it.row) && !pending.has(it.row)),
      )
      .subscribe((action) => {
        pending.add(action.row)
        refresh()
        // A real fetch is what a consumer puts here; the delay is what makes the pending state visible.
        window.setTimeout(() => {
          pending.delete(action.row)
          loaded.add(action.row)
          source.$(attach(source.$(), action.row, childRowsOf(action.row)))
          orders.state.expanded.$({ ...orders.state.expanded.$(), [action.row]: true })
          refresh()
        }, 220)
      }),
  )

  // --- panel ----------------------------------------------------------------

  const openRows = (): readonly RowId[] => Object.keys(orders.state.detail.$())

  const openFirst = (): void => {
    const first = orders.view.plan.$().center.find((it) => !it.includes(" "))
    if (first === undefined) return
    orders.state.detail.$({ ...orders.state.detail.$(), [first]: BUILT_IN_IDS.detail })
  }

  const panelGroup = group("Detail panels", [
    actions([
      { label: "open the first visible row", run: openFirst },
      { label: "close every panel", run: () => orders.state.detail.$({}) },
    ]),
    readbackField("open panels", () => `${openRows().length}: ${openRows().slice(0, 2).join(", ")}`),
    readbackField("nested grids alive", () => String(openRows().length)),
    readbackField("detail row heights", () =>
      Object.keys(orders.state.rowHeight.$()).length === 0
        ? "none"
        : `${Object.keys(orders.state.rowHeight.$()).length} keys at ${PANEL_HEIGHT}px`,
    ),
    actions([
      {
        label: "sort the newest nested grid by qty",
        title: "Proves the panel holds a real grid with state of its own",
        run: () => {
          const inner = lastNested
          if (inner === null) return
          const typed = inner as { readonly state: { readonly sort: { $: (next: unknown) => void } } }
          typed.state.sort.$([{ field: "qty", sort: "desc" }])
        },
      },
      {
        label: "unpin the nested item column",
        run: () => {
          const inner = lastNested
          if (inner === null) return
          const typed = inner as { readonly state: { readonly colPinning: { $: (next: unknown) => void } } }
          typed.state.colPinning.$({})
        },
      },
    ]),
  ])

  const lazyGroup = group("Lazy children through intent$", [
    readbackField("rows loaded", () => String(loaded.size)),
    readbackField("fetches in flight", () => String(pending.size)),
    readbackField("expanded rows", () => String(Object.keys(orders.state.expanded.$()).length)),
    readbackField("flat length", () => orders.view.flat.$().length.toLocaleString("en-US")),
    actions([
      {
        label: "forget every lazy load",
        run: () => {
          loaded.clear()
          source.$(ORDERS)
          orders.state.expanded.$({})
          refresh()
        },
      },
    ]),
    checkField("virtualize rows", () => orders.state.virtualize.$(), (next) =>
      orders.state.virtualize.$(next),
    ),
  ])

  groups.push(panelGroup, lazyGroup)
  hosts.panel.append(aboutPanel(detailDemo), panelGroup.el, lazyGroup.el)

  const panelReadout = readout(orders, box)
  hosts.readout.append(panelReadout.el)

  subs.add(orders.state.$.subscribe(refresh))
  refresh()

  return {
    grid: orders,
    stop: () => {
      subs.unsubscribe()
      panelReadout.stop()
      handle.stop()
      orders.close()
      box.remove()
    },
  }
}
