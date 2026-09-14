import type { SequenceGraph } from "./7_sequenceGraph.js"

export type SequenceFlow = { nextById: Record<string, string[]>; previousById: Record<string, string[]> }

/** Event ordering: ordinary fragments compose in order; parallel branches share entry and exit.
 * Actors are endpoints of messages, not events in this ordering graph. Each transition costs one hop.
 */
export function sequenceFlowOf(graph: SequenceGraph): SequenceFlow {
  const nextById: Record<string, string[]> = {}, previousById: Record<string, string[]> = {}
  const children = new Map<string | undefined, string[]>()
  for (const item of Object.values(graph).sort((a, b) => (a.data?.ordinal ?? 0) - (b.data?.ordinal ?? 0))) {
    if (item.type !== "edge" && item.data?.kind !== "group") continue
    children.set(item.parentId, [...(children.get(item.parentId) ?? []), item.id])
  }
  const connect = (from: string[], to: string[]) => {
    for (const a of from) for (const b of to) {
      nextById[a] = [...new Set([...(nextById[a] ?? []), b])]
      previousById[b] = [...new Set([...(previousById[b] ?? []), a])]
    }
  }
  const visiting = new Set<string>()
  const sequence = (ids: readonly string[]): { first: string[]; last: string[] } => {
    let first: string[] = [], last: string[] = []
    for (const id of ids) {
      const item = graph[id]
      if (!item) throw new Error(`missing sequence event: ${id}`)
      if (visiting.has(id)) throw new Error(`sequence containment cycle: ${id}`)
      visiting.add(id)
      let entry: string[], exit: string[]
      if (item.type === "edge") { entry = [id]; exit = [id] }
      else if (item.data?.branches) {
        const branches = item.data.branches.map(sequence)
        entry = branches.flatMap(branch => branch.first)
        exit = branches.flatMap(branch => branch.last)
      } else { const fragment = sequence(children.get(id) ?? []); entry = fragment.first; exit = fragment.last }
      visiting.delete(id)
      if (!entry.length) continue
      if (!first.length) first = entry
      connect(last, entry)
      last = exit
    }
    return { first, last }
  }
  const roots = [...children.entries()].filter(([parent]) => parent === undefined || graph[parent]?.data?.kind !== "group").flatMap(([, ids]) => ids)
  sequence(roots)
  return { nextById, previousById }
}
