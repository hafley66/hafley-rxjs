// Per-group automatic-layout ownership, with retained manual positions across collapse/expand.
import type { GraphId, GraphPoint } from "@hafley66/grapht-model"

export type GroupPositions = Readonly<Record<GraphId, GraphPoint>>
export type GroupLayoutState = {
  /** UI toggle: checked means expansion resumes automatic layout. */
  autoOnExpand: boolean
  groups: Readonly<Record<GraphId, { collapsed: boolean; mode: "auto" | "manual"; manual?: GroupPositions }>>
}
export type GroupLayoutEvent =
  | { type: "auto-on-expand"; enabled: boolean }
  | { type: "manual-move"; groupId: GraphId; positions: GroupPositions }
  | { type: "collapse" | "expand" | "resume-auto"; groupId: GraphId }

/**
 * Caller-owned state, suitable for a signal or event-log fold. Manual move means one completed
 * gesture and supplies the affected group's full local arrangement. Other groups remain unchanged.
 * Collapse permits automatic placement of the collapsed representation. Expansion uses the current
 * toggle; neither toggle branch deletes the saved manual arrangement. Identity reconciliation,
 * layout execution, and undo cursor remain caller-owned.
 */
export function reduceGroupLayout(state: GroupLayoutState, event: GroupLayoutEvent): GroupLayoutState {
  if (event.type === "auto-on-expand") return { ...state, autoOnExpand: event.enabled }
  const group = state.groups[event.groupId] ?? { collapsed: false, mode: "auto" as const }
  const next = event.type === "manual-move"
    ? { ...group, mode: "manual" as const, manual: Object.fromEntries(Object.entries(event.positions).map(([id, point]) => [id, { ...point }])) }
    : event.type === "collapse" ? { ...group, collapsed: true }
    : event.type === "resume-auto" ? { ...group, mode: "auto" as const }
    : { ...group, collapsed: false, mode: !state.autoOnExpand && group.manual !== undefined ? "manual" as const : "auto" as const }
  return { ...state, groups: { ...state.groups, [event.groupId]: next } }
}

/** Whether the group's current representation may be laid out automatically. Unknown groups start automatic. */
export function groupAllowsAutoLayout(state: GroupLayoutState, groupId: GraphId): boolean {
  const group = state.groups[groupId]
  return group === undefined || group.collapsed || group.mode === "auto"
}

/** Resolve local child positions after the caller has obtained an automatic arrangement. */
export function groupPositionsOf(state: GroupLayoutState, groupId: GraphId, automatic: GroupPositions): GroupPositions {
  return groupAllowsAutoLayout(state, groupId) ? automatic : state.groups[groupId]?.manual ?? automatic
}
