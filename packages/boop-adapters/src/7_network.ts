import type { MarbleEvent } from "@hafley66/marbler"
import { agentNetworkExportSchema, type AgentNetworkProjection, type AgentNetworkTopologyProjection, type BoopFrameRow, type BoopSessionRow } from "./0_types.js"

type NetworkFrame = {
  id: string
  t: number
  kind: string
  direction: "in" | "out" | "self"
  peer: string | null
  preview: string
  repeat: number
}

// NetworkRow is a MarbleEvent superset; marbler adds these fields later.
type NetworkRow = MarbleEvent & {
  frames: NetworkFrame[]
  parentId: string | null
  children?: NetworkRow[]
}

const inboundEdgeKinds = new Set(["spawned", "hail", "deliver-midturn", "deliver-nextturn"])
const outboundEdgeKinds = new Set(["result"])

function directionOf(kind: string): "in" | "out" | "self" {
  if (inboundEdgeKinds.has(kind)) return "in"
  if (outboundEdgeKinds.has(kind)) return "out"
  return "self"
}

function toFrame(row: BoopFrameRow): NetworkFrame {
  return {
    id: `${row.kind}:${row.session}:${row.peer ?? ""}:${row.ts}`,
    t: row.ts,
    kind: row.kind,
    direction: directionOf(row.kind),
    peer: row.peer,
    preview: row.detail,
    repeat: row.repeat,
  }
}

export const projectAgentNetwork: AgentNetworkProjection = (input) => {
  const { rows, frames } = agentNetworkExportSchema.parse(input)
  const rowBySession = new Map(rows.map((row) => [row.session, row]))
  const framesBySession = new Map<string, BoopFrameRow[]>()
  for (const frame of frames) {
    if (!rowBySession.has(frame.session)) continue
    framesBySession.set(frame.session, [...(framesBySession.get(frame.session) ?? []), frame])
  }
  const childrenByParent = new Map<string, string[]>()
  for (const row of rows) {
    if (row.parent !== null && rowBySession.has(row.parent)) {
      childrenByParent.set(row.parent, [...(childrenByParent.get(row.parent) ?? []), row.session])
    }
  }

  const makeNode = (session: string, ancestry: Set<string>): NetworkRow => {
    const row = rowBySession.get(session) as BoopSessionRow
    const rowFrames = (framesBySession.get(session) ?? [])
      .slice()
      .sort((left, right) => left.ts - right.ts || left.kind.localeCompare(right.kind))
      .map(toFrame)
    const start = row.openedTs ?? row.spawnedTs ?? row.firstTurnTs
    const end = row.closedTs ?? row.lastTurnTs ?? start
    const duration = start !== null && end !== null ? Math.max(0, end - start) : null
    const hasError = rowFrames.some((frame) => frame.kind === "error")
    const status = row.closedTs === null ? 101 : hasError ? 500 : 200
    const type = row.parent === null ? "root" : row.session.includes("/agent-") ? "subagent" : "lane"
    const childIds = ancestry.has(session) ? [] : (childrenByParent.get(session) ?? [])
    const nextAncestry = new Set(ancestry).add(session)
    const children = childIds.map((childId) => makeNode(childId, nextAncestry))
    return {
      id: row.session,
      name: row.nickname ?? row.branch ?? row.session,
      method: row.harness.toUpperCase(),
      status,
      type,
      initiator: row.parent ?? "",
      size: `${row.turns} turns`,
      start,
      duration,
      from: row.parent ?? "",
      to: row.session,
      preview: row.goal ?? "",
      phases: [],
      frames: rowFrames,
      parentId: row.parent,
      ...(children.length ? { children } : {}),
    }
  }

  const roots = rows
    .map((row) => row.session)
    .filter((session) => {
      const row = rowBySession.get(session) as BoopSessionRow
      return row.parent === null || !rowBySession.has(row.parent)
    })
  return roots.map((session) => makeNode(session, new Set()))
}

export const projectAgentNetworkTopology: AgentNetworkTopologyProjection = (input) => {
  const { rows } = agentNetworkExportSchema.parse(input)
  const nodeIds = rows.map((row) => row.session)
  const index = new Map(nodeIds.map((session, position) => [session, position]))
  const edges: [number, number][] = []
  for (const row of rows) {
    if (row.parent === null) continue
    const parentIndex = index.get(row.parent)
    if (parentIndex === undefined) continue
    edges.push([parentIndex, index.get(row.session) as number])
  }
  return { nodeIds, edges }
}

function flattenRow(row: NetworkRow, expanded: ReadonlySet<string>, output: MarbleEvent[]): void {
  output.push(row)
  if (!expanded.has(row.id)) return
  for (const child of row.children ?? []) flattenRow(child, expanded, output)
}

export function flattenNetworkRows(rows: MarbleEvent[], expanded: ReadonlySet<string>): MarbleEvent[] {
  const nodes = rows as NetworkRow[]
  const output: MarbleEvent[] = []
  for (const node of nodes) flattenRow(node, expanded, output)
  return output
}
