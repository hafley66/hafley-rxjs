import { boopAgentSnapshotSchema, type BoopAgentSnapshot } from "./0_types.js"

export function parseBoopAgentSnapshot(input: BoopAgentSnapshot): BoopAgentSnapshot {
  const snapshot = boopAgentSnapshotSchema.parse(input)
  const identities = new Set<string>()
  for (const node of snapshot.nodes) {
    const key = nodeIdentity(node.harness, node.id)
    if (identities.has(key)) throw new Error(`duplicate Boop agent identity: ${key}`)
    identities.add(key)
  }
  for (const edge of snapshot.edges) {
    if (!resolveIdentity(identities, edge.from) || !resolveIdentity(identities, edge.to)) {
      throw new Error(`Boop edge references an unknown agent: ${edge.from} -> ${edge.to}`)
    }
  }
  return snapshot
}

export function nodeIdentity(harness: string, id: string): string {
  return `${harness}:${id}`
}

export function resolveIdentity(identities: Set<string>, reference: string): string | null {
  return identities.has(reference) ? reference : null
}

export function eventIdentity(event: { id: string }): string {
  return event.id
}

export function timeOf(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const numeric = Number(value)
    if (Number.isFinite(numeric) && value.trim() !== "") return numeric
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

export function eventStart(event: { start?: unknown }): number | null {
  return timeOf(event.start)
}

export function eventEnd(event: { end?: unknown }): number | null {
  return timeOf(event.end)
}
