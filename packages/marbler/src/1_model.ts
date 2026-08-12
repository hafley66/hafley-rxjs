import { createGrid } from "@hafley66/grid"
import { Signal } from "@hafley66/signals"
import { MarbleEventSchema, type EventFilter, type MarbleEvent } from "./0_types"
import { createTimeViewport, eventRange } from "./0a_TimeViewport"

export function createMarbler(seed: MarbleEvent[]) {
  const source = Signal(seed)
  const filter = Signal<EventFilter>("all")
  const selectedId = Signal<string | null>(seed[0]?.id ?? null)
  const hoveredId = Signal<string | null>(null)
  const viewport = Signal(createTimeViewport(eventRange(seed)))
  const rows = Signal(() => filter.$() === "all" ? source.$() : source.$().filter((row) => row.type === filter.$()))
  const grid = createGrid<MarbleEvent>({
    schema: MarbleEventSchema,
    rows,
    getRowId: (row) => row.id,
    mode: "client",
    columnDefs: [
      { id: "name", accessorKey: "name", header: "Name" },
      { id: "status", accessorKey: "status", header: "Status" },
      { id: "type", accessorKey: "type", header: "Type" },
      { id: "initiator", accessorKey: "initiator", header: "Initiator" },
      { id: "size", accessorKey: "size", header: "Size" },
      { id: "duration", accessorKey: "duration", header: "Time" },
      { id: "waterfall", header: "Waterfall" },
    ],
  })
  return { source, filter, selectedId, hoveredId, viewport, rows, grid }
}

export type Marbler = ReturnType<typeof createMarbler>
