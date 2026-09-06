// All reactive state for the boop network report lives on one Model, created once in main.tsx.
// navRows layers the window select and the outside-window fold on top of filteredTree's scope.
import { createMarbler, createTimeViewport, eventRange, reduceTimeViewport, type Marbler, type MarbleEvent } from "@hafley66/marbler"
import { Signal, storageSignal, historyAdapter, localStorageAdapter, type Signal as SignalType } from "@hafley66/signals"
import type { PivotEntry } from "@hafley66/report-shell"
import { projectAgentNetwork } from "../7_network.js"
import type { AgentNetworkExport, BoopSessionRow } from "../0_types.js"
import { countHeader, sortByRecencyDesc, type HeaderCounts, type TimeWindow } from "../lib/window.js"
import {
  collectFrameKinds, filterTree, findNode, makeFoldRow, markSelected, partitionRootsByWindow, toNavRow, toPivotRow, toRanked,
  type NetworkNavRow, type PivotRow,
} from "./nav.js"

export type ContinuousState = { search: string; kinds: string[] }

export type Density = "compact" | "cozy"
export type Theme = "auto" | "dark" | "light"
export type Prefs = { theme: Theme; density: Density; window: TimeWindow }
export const DEFAULT_PREFS: Prefs = { theme: "auto", density: "compact", window: "active" }

export { OLDER_FOLD_ID, type NetworkNavRow, type PivotRow } from "./nav.js"
export { findNode }

function decodePivotStack(raw: string): PivotEntry[] {
  if (!raw) return []
  try {
    return JSON.parse(raw) as PivotEntry[]
  } catch {
    return []
  }
}
function encodePivotStack(stack: PivotEntry[]): string {
  return stack.length ? JSON.stringify(stack) : ""
}

export type Model = {
  data: SignalType<AgentNetworkExport>
  sessionById: SignalType<Map<string, BoopSessionRow>>
  continuous: SignalType<ContinuousState>
  selected: SignalType<string | null>
  pivotStack: SignalType<PivotEntry[]>
  networkTree: SignalType<MarbleEvent[]>
  navRows: SignalType<NetworkNavRow[]>
  pivotRows: SignalType<PivotRow[]>
  frameKinds: SignalType<string[]>
  counts: SignalType<HeaderCounts>
  marbler: Marbler
}

export function createModel(initial: AgentNetworkExport, prefs: SignalType<Prefs>): Model {
  const data = Signal<AgentNetworkExport>(initial)
  const sessionById = Signal<Map<string, BoopSessionRow>>(() => new Map(data.$().rows.map((row) => [row.session, row])))
  const continuous = Signal<ContinuousState>({ search: "", kinds: collectFrameKinds(initial.frames) })
  const selected = storageSignal<string | null>(historyAdapter("s"), null, { serialize: (v) => v ?? "", parse: (raw) => raw || null })
  const pivotStack = storageSignal(historyAdapter("p"), [] as PivotEntry[], { serialize: encodePivotStack, parse: decodePivotStack })

  const networkTree = Signal<MarbleEvent[]>(() => projectAgentNetwork(data.$()))
  const frameKinds = Signal<string[]>(() => collectFrameKinds(data.$().frames))
  const filteredTree = Signal<MarbleEvent[]>(() => {
    const cont = continuous.$()
    return filterTree(networkTree.$(), sessionById.$(), new Set(cont.kinds), cont.search.trim().toLowerCase())
  })

  const counts = Signal<HeaderCounts>(() => countHeader(data.$().rows, Date.now()))

  const navRows = Signal<NetworkNavRow[]>(() => {
    const now = Date.now()
    const byId = sessionById.$()
    const window = prefs.$().window
    const { within, older } = partitionRootsByWindow(filteredTree.$(), byId, window, now)
    const rows = within.map((node) => toNavRow(node, byId, now))
    if (older.length) rows.push(makeFoldRow(older.map((node) => toNavRow(node, byId, now)), window))
    return markSelected(rows, selected.$())
  })

  const pivotRows = Signal<PivotRow[]>(() => navRows.$().map(toPivotRow))

  const scopedMarbleRows = Signal<MarbleEvent[]>(() => {
    const sel = selected.$()
    const tree = filteredTree.$()
    if (!sel) return tree
    const node = findNode(tree, sel) ?? findNode(networkTree.$(), sel)
    return node ? [node] : tree
  })

  const marbler = createMarbler(scopedMarbleRows.$())
  let lastSelected = selected.$()
  scopedMarbleRows.$.subscribe((events) => {
    marbler.source.$(events)
    const sel = selected.$()
    const selectionChanged = sel !== lastSelected
    lastSelected = sel
    const range = eventRange(events)
    marbler.viewport.$(selectionChanged ? createTimeViewport(range) : reduceTimeViewport(marbler.viewport.$(), { type: "full", range }))
  })

  if (selected.$() === null) selected.$(defaultSelectionId(networkTree.$(), sessionById.$(), prefs.$().window))

  return { data, sessionById, continuous, selected, pivotStack, networkTree, navRows, pivotRows, frameKinds, counts, marbler }
}

// Picks a root guaranteed visible under the given window (rescued-or-active, most recent first)
// so the initial selection is never hidden inside the fold row.
function defaultSelectionId(tree: MarbleEvent[], sessionById: Map<string, BoopSessionRow>, window: TimeWindow): string | null {
  const now = Date.now()
  const { within } = partitionRootsByWindow(tree, sessionById, window, now)
  const visible = sortByRecencyDesc(within.map((node) => toRanked(node, sessionById)))
  if (visible.length) return visible[0]!.node.id
  const liveRoot = sortByRecencyDesc(tree.map((node) => toRanked(node, sessionById))).find((entry) => entry.live)
  if (liveRoot) return liveRoot.node.id
  return tree[0]?.id ?? null
}

export function patchContinuous(model: Pick<Model, "continuous">, patch: Partial<ContinuousState>): void {
  model.continuous.$({ ...model.continuous.$(), ...patch })
}
export function pushPivot(model: Pick<Model, "pivotStack">, entry: PivotEntry): void {
  model.pivotStack.$([...model.pivotStack.$(), entry])
}
export function popPivotsTo(model: Pick<Model, "pivotStack">, count: number): void {
  model.pivotStack.$(model.pivotStack.$().slice(0, count))
}

export function createPrefs(): SignalType<Prefs> {
  return storageSignal(localStorageAdapter("boop-network.prefs"), DEFAULT_PREFS, {
    parse: (raw) => ({ ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) }),
  })
}
