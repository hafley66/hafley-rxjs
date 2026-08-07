import { Signal, type Signal$, SignalCreator } from "@hafley66/signals"
import { applyNodeChanges } from "@xyflow/react"
import { merge, type Observable, scan } from "rxjs"
import type { DockFlowEvent, DockFlowNode, DockFlowState } from "./0_types.js"

export function makeDockFlowNodes(count: number): DockFlowNode[] {
  const columns = Math.ceil(Math.sqrt(count))
  return Array.from({ length: count }, (_, index) => ({
    id: `panel-${index}`,
    type: "dockFlowPanel",
    position: { x: (index % columns) * 280, y: Math.floor(index / columns) * 168 },
    data: { title: `Panel ${index + 1}`, panelId: `panel-${index}` },
  }))
}

export function reduceDockFlow(state: DockFlowState, event: DockFlowEvent): DockFlowState {
  const common = { eventCount: state.eventCount + 1, lastEvent: event.type }
  if (event.type === "node-count-selected") {
    return { ...state, ...common, requestedNodes: event.count, nodes: makeDockFlowNodes(event.count) }
  }
  if (event.type === "nodes-changed") {
    return { ...state, ...common, nodes: applyNodeChanges(event.changes, state.nodes) }
  }
  if (event.type === "panel-value-changed") {
    return { ...state, ...common, values: { ...state.values, [event.panelId]: event.value } }
  }
  return { ...state, ...common, dockPanels: event.dockPanels }
}

export type DockAndFlowModel = {
  events: { $: Signal$<DockFlowEvent> }
  state: {
    $: Signal$<DockFlowState>
    nodes: { $: Signal$<DockFlowNode[]> }
  }
  dispose: () => void
}

export function createDockAndFlowModel(nodeCount = 100, sources: Observable<DockFlowEvent>[] = []): DockAndFlowModel {
  const events = SignalCreator<DockFlowEvent>({ event: true })
  const initial: DockFlowState = {
    nodes: makeDockFlowNodes(nodeCount),
    values: {},
    requestedNodes: nodeCount,
    dockPanels: 0,
    eventCount: 0,
    lastEvent: "initial",
  }
  const state = Signal(merge(events.$, ...sources).pipe(scan(reduceDockFlow, initial)), initial)
  const lifetime = state.$.subscribe()
  return { events, state, dispose: () => lifetime.unsubscribe() }
}
