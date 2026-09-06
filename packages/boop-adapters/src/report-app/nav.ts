// Pure row-shaping between the marbler tree + session map and the TreeTable's NetworkNavRow.
// No signals here; model.ts wires these into Signal()s.
import type { MarbleEvent, MarbleFrame } from "@hafley66/marbler"
import type { NavRow } from "@hafley66/report-shell"
import type { BoopSessionRow } from "../0_types.js"
import { shortId } from "../lib/format.js"
import { deriveStatus, waitingOnPeer, type StatusFrame, type StatusWord } from "../lib/status.js"
import { matchesWindow, type TimeWindow, type WindowActivity } from "../lib/window.js"

export const OLDER_FOLD_ID = "__older_sessions__"

export type NetworkNavRow = {
  id: string
  name: string
  cwd: string | null
  harness: string
  status: StatusWord
  waitingOn: string | null
  turns: number
  tokens: number
  age: number
  kind: string
  live: boolean
  selected?: boolean
  children?: NetworkNavRow[]
}

export type PivotRow = NavRow<{ kind: string }>
export type Ranked = WindowActivity & { node: MarbleEvent }

export function collectFrameKinds(frames: { kind: string }[]): string[] {
  return [...new Set(frames.map((frame) => frame.kind))].sort()
}

function nodeMatches(node: MarbleEvent, sessionById: Map<string, BoopSessionRow>, kinds: Set<string>, q: string): boolean {
  const ownFrames: MarbleFrame[] = node.frames ?? []
  if (kinds.size && !ownFrames.some((frame) => kinds.has(frame.kind))) return false
  if (!q) return true
  const session = sessionById.get(node.id)
  const haystack = [node.name, session?.harness ?? "", session?.cwd ?? "", ...ownFrames.map((frame) => frame.preview)]
  return haystack.some((text) => text.toLowerCase().includes(q))
}

export function filterTree(nodes: MarbleEvent[], sessionById: Map<string, BoopSessionRow>, kinds: Set<string>, q: string): MarbleEvent[] {
  const output: MarbleEvent[] = []
  for (const node of nodes) {
    const children = node.children ? filterTree(node.children, sessionById, kinds, q) : undefined
    if (!nodeMatches(node, sessionById, kinds, q) && !children?.length) continue
    output.push(children?.length ? { ...node, children } : node)
  }
  return output
}

export function toRanked(node: MarbleEvent, sessionById: Map<string, BoopSessionRow>): Ranked {
  const session = sessionById.get(node.id)
  return { node, live: session?.live ?? false, lastActivityTs: session?.lastActivityTs ?? null, openedTs: session?.openedTs ?? null }
}

// A root is "within window" if it matches itself, or hides an active descendant: a root gone
// quiet with a still-active subagent underneath stays visible, only fully-quiet trees fold away.
function treeMatchesWindow(node: MarbleEvent, sessionById: Map<string, BoopSessionRow>, window: TimeWindow, now: number): boolean {
  if (matchesWindow(toRanked(node, sessionById), window, now)) return true
  return (node.children ?? []).some((child) => treeMatchesWindow(child, sessionById, window, now))
}

export function partitionRootsByWindow(
  roots: MarbleEvent[],
  sessionById: Map<string, BoopSessionRow>,
  window: TimeWindow,
  now: number,
): { within: MarbleEvent[]; older: MarbleEvent[] } {
  const within: MarbleEvent[] = []
  const older: MarbleEvent[] = []
  for (const root of roots) (treeMatchesWindow(root, sessionById, window, now) ? within : older).push(root)
  return { within, older }
}

function toStatusFrames(node: MarbleEvent): StatusFrame[] {
  return (node.frames ?? []).map((frame) => ({ t: frame.t, direction: frame.direction, peer: frame.peer }))
}

export function toNavRow(node: MarbleEvent, sessionById: Map<string, BoopSessionRow>, now: number): NetworkNavRow {
  const session = sessionById.get(node.id)
  const frames = toStatusFrames(node)
  const status = session
    ? deriveStatus({ live: session.live, closedTs: session.closedTs, exitStatus: session.exitStatus, lastActivityTs: session.lastActivityTs, frames, now })
    : "unknown"
  return {
    id: node.id,
    name: session?.nickname ?? shortId(node.id),
    cwd: session?.cwd ?? null,
    harness: session?.harness ?? "",
    status,
    waitingOn: status === "waiting" ? waitingOnPeer(frames) : null,
    turns: session?.turns ?? 0,
    tokens: session?.tokens ?? 0,
    age: session?.lastActivityTs ?? 0,
    kind: node.type,
    live: session?.live ?? false,
    children: node.children?.map((child) => toNavRow(child, sessionById, now)),
  }
}

export function makeFoldRow(children: NetworkNavRow[], window: TimeWindow): NetworkNavRow {
  return {
    id: OLDER_FOLD_ID,
    name: `${children.length} more sessions (window: ${window})`,
    cwd: null,
    harness: "",
    status: "unknown",
    waitingOn: null,
    turns: 0,
    tokens: 0,
    age: 0,
    kind: "fold",
    live: false,
    children,
  }
}

export function findNode(nodes: MarbleEvent[], id: string): MarbleEvent | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = node.children ? findNode(node.children, id) : undefined
    if (found) return found
  }
  return undefined
}

export function markSelected(nodes: NetworkNavRow[], id: string | null): NetworkNavRow[] {
  return nodes.map((node) => ({ ...node, selected: node.id === id, children: node.children ? markSelected(node.children, id) : undefined }))
}

export function toPivotRow(row: NetworkNavRow): PivotRow {
  return { id: row.id, label: row.name, status: row.status, durationMs: 0, events: row.turns, kind: row.kind, children: row.children?.map(toPivotRow) }
}
