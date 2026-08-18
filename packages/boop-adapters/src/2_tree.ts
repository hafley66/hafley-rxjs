import type { AgentTreeCommunication, AgentTreeProjection, AgentTreeRow, BoopAgentEvent, BoopAgentNode, BoopAgentSnapshot } from "./0_types.js"
import { eventIdentity, eventStart, nodeIdentity, parseBoopAgentSnapshot, resolveIdentity } from "./1_validate.js"

function referenceOf(value: string | undefined, identities: Set<string>): string | null {
  return value ? resolveIdentity(identities, value) : null
}

function communicationOf(event: BoopAgentEvent, id: string, index: number): AgentTreeCommunication {
  return {
    id: eventIdentity(event),
    kind: event.kind,
    from: event.from ?? null,
    to: event.to ?? null,
    message: event.message ?? event.preview ?? "",
    timestamp: eventStart(event),
    ...(event.metadata ? { metadata: event.metadata } : {}),
  }
}

export const projectAgentTree: AgentTreeProjection = (input) => {
  const snapshot = parseBoopAgentSnapshot(input)
  const identities = new Set(snapshot.nodes.map((node) => nodeIdentity(node.harness, node.id)))
  const nodeById = new Map(snapshot.nodes.map((node) => [nodeIdentity(node.harness, node.id), node]))
  const parentById = new Map<string, string>()
  for (const node of snapshot.nodes) {
    const id = nodeIdentity(node.harness, node.id)
    const parent = referenceOf(node.parentId ?? undefined, identities)
    if (parent && parent !== id) parentById.set(id, parent)
  }
  for (const edge of snapshot.edges) {
    if (edge.kind !== "spawn" && edge.kind !== "parent" && edge.kind !== "subagent") continue
    const from = resolveIdentity(identities, edge.from)
    const to = resolveIdentity(identities, edge.to)
    if (from && to && from !== to && !parentById.has(to)) parentById.set(to, from)
  }
  const children = new Map<string, string[]>()
  for (const [child, parent] of parentById) children.set(parent, [...(children.get(parent) ?? []), child])
  const communications = new Map<string, AgentTreeCommunication[]>()
  snapshot.events.forEach((event, index) => {
    const from = referenceOf(event.from, identities)
    const to = referenceOf(event.to, identities)
    const owner = referenceOf(event.nodeId, identities) ?? from ?? to
    if (!owner) return
    const communication = communicationOf({ ...event, from: from ?? event.from, to: to ?? event.to }, owner, index)
    for (const endpoint of new Set([from, to, owner])) {
      if (endpoint) communications.set(endpoint, [...(communications.get(endpoint) ?? []), communication])
    }
  })
  const makeRow = (id: string, ancestry: Set<string>): AgentTreeRow => {
    const node = nodeById.get(id) as BoopAgentNode
    const childIds = ancestry.has(id) ? [] : (children.get(id) ?? [])
    const nextAncestry = new Set(ancestry).add(id)
    const childRows = childIds.map((child) => makeRow(child, nextAncestry))
    return {
      id,
      name: node.label ?? node.name ?? node.sessionId ?? node.id,
      kind: "agent",
      harness: node.harness,
      sessionId: node.sessionId ?? node.id,
      parentId: parentById.get(id) ?? null,
      status: node.status ?? "unknown",
      from: node.from ?? "user",
      why: node.why ?? "",
      cwd: node.cwd ?? "",
      communications: communications.get(id) ?? [],
      ...(childRows.length ? { children: childRows } : {}),
    }
  }
  const roots = snapshot.nodes
    .map((node) => nodeIdentity(node.harness, node.id))
    .filter((id) => !parentById.has(id) || !nodeById.has(parentById.get(id) as string))
  return roots.map((id) => makeRow(id, new Set()))
}

export const agentTreeProjection = projectAgentTree
export const boopAgentTree = projectAgentTree
