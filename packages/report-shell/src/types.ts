// Shared row/pivot shapes for PivotStack (and any grid-backed nav). A domain adds fields through `Extra`
// and keeps its own id/label/status/durationMs/events semantics.
export type NavRow<Extra extends object = object> = {
  id: string
  label: string
  status: string
  durationMs: number
  events: number
  selected?: boolean
  children?: NavRow<Extra>[]
} & Extra

export type PivotEntry = { columnId: string; value: string; label: string }
