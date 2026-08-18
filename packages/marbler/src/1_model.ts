import { createGrid, type Grid } from "@hafley66/grid"
import { Signal, type Signal as SignalValue } from "@hafley66/signals"
import type { ExpandedState } from "@tanstack/react-table"
import { MarbleEventSchema, type EventFilter, type MarbleEvent } from "./0_types.js"
import { createTimeViewport, eventRange, type TimeViewport } from "./0a_TimeViewport.js"

function isRowExpanded(expanded: ExpandedState, id: string): boolean {
  return expanded === true || Boolean(expanded[id])
}

function flattenExpandedRows(rows: MarbleEvent[], expanded: ExpandedState): MarbleEvent[] {
  const flattened: MarbleEvent[] = []
  const walk = (level: MarbleEvent[]) => {
    for (const row of level) {
      flattened.push(row)
      if (row.children?.length && isRowExpanded(expanded, row.id)) walk(row.children)
    }
  }
  walk(rows)
  return flattened
}

export type Marbler = {
  source: SignalValue<MarbleEvent[]>
  filter: SignalValue<EventFilter>
  selectedId: SignalValue<string | null>
  hoveredId: SignalValue<string | null>
  viewport: SignalValue<TimeViewport>
  grid: Grid<MarbleEvent>
  rows: SignalValue<MarbleEvent[]>
}

export function createMarbler(seed: MarbleEvent[]): Marbler {
  const source = Signal<MarbleEvent[]>(seed)
  const filter = Signal<EventFilter>("all")
  const selectedId = Signal<string | null>(seed[0]?.id ?? null)
  const hoveredId = Signal<string | null>(null)
  const viewport = Signal(createTimeViewport(eventRange(seed)))
  const treeRows = Signal<MarbleEvent[]>(() => filter.$() === "all" ? source.$() : source.$().filter((row: MarbleEvent) => row.type === filter.$()))
  const grid = createGrid<MarbleEvent>({
    schema: MarbleEventSchema,
    rows: treeRows,
    getRowId: (row: MarbleEvent) => row.id,
    getSubRows: (row: MarbleEvent) => row.children,
    mode: "client",
    columnDefs: [
      { id: "__expand", header: "" },
      { id: "name", accessorKey: "name", header: "Name" },
      { id: "status", accessorKey: "status", header: "Status" },
      { id: "type", accessorKey: "type", header: "Type" },
      { id: "initiator", accessorKey: "initiator", header: "Initiator" },
      { id: "size", accessorKey: "size", header: "Size" },
      { id: "duration", accessorKey: "duration", header: "Time" },
      { id: "waterfall", header: "Waterfall" },
    ],
  })
  const rows = Signal<MarbleEvent[]>(() => flattenExpandedRows(treeRows.$(), grid.state.$().expanded))
  return { source, filter, selectedId, hoveredId, viewport, rows, grid }
}
