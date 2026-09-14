import type { Graph, GraphId } from "@hafley66/grapht-model"
import type { GraphFrame } from "./0_frame.js"

/** Add explicit containment without changing source IDs or source ordering. */
export function groupGraphItems(graph: Graph, id: GraphId, members: readonly GraphId[], label: string, parentId?: GraphId): Graph {
  if (graph[id]) throw new Error(`group ID already exists: ${id}`)
  if (parentId && !graph[parentId]) throw new Error(`missing parent: ${parentId}`)
  for (const member of members) {
    if (!graph[member]) throw new Error(`missing member: ${member}`)
    let ancestor = parentId
    while (ancestor) {
      if (ancestor === member) throw new Error(`group would create a containment cycle: ${member}`)
      ancestor = graph[ancestor]?.parentId
    }
  }
  return { ...graph, [id]: { id, type: "node", ...(parentId ? { parentId } : {}), data: { kind: "group", label } },
    ...Object.fromEntries(members.map(member => [member, { ...graph[member], parentId: id }])) }
}

/** Hidden descendants and internal/incident edges; the full source graph remains available. */
export function collapsedGraphIds(graph: Graph, collapsed: ReadonlySet<string>): Set<string> {
  const hidden = new Set<string>()
  for (const item of Object.values(graph)) {
    const seen = new Set<string>()
    let parent = item.parentId
    while (parent && !seen.has(parent)) {
      if (collapsed.has(parent)) { hidden.add(item.id); break }
      seen.add(parent)
      parent = graph[parent]?.parentId
    }
  }
  for (const item of Object.values(graph)) if (item.type === "edge" && (hidden.has(item.fromId) || hidden.has(item.toId))) hidden.add(item.id)
  return hidden
}

/** Visibility projection is renderer-independent and never deletes source topology. */
export function collapseGraphFrame(frame: GraphFrame, collapsed: ReadonlySet<string>): GraphFrame {
  return { ...frame, presentation: { ...frame.presentation, collapsedIds: new Set(collapsed), hiddenIds: new Set([...frame.presentation.hiddenIds, ...collapsedGraphIds(frame.graph, collapsed)]) } }
}
