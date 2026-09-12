import type { SvgBindingRole } from "./1_sequenceSvgBinding.js"
import type { GraphId } from "./6_graph.js"
import type { GraphPort } from "./6b_portLocation.js"

export type GraphVisualPart = {
  elementId: string
  role: SvgBindingRole
  ordinal: number
}

export type GraphVisual = {
  id: GraphId
  graphId: GraphId
  parts: readonly GraphVisualPart[]
  ports: readonly GraphPort[]
}

export function graphVisualsOf(
  bindings: readonly { elementId: string; graphId: GraphId; role: SvgBindingRole; ordinal: number }[],
  ports: readonly GraphPort[] = [],
): readonly GraphVisual[] {
  const partsByGraphId = new Map<GraphId, GraphVisualPart[]>()
  for (const binding of bindings) {
    const parts = partsByGraphId.get(binding.graphId) ?? []
    parts.push({ elementId: binding.elementId, role: binding.role, ordinal: binding.ordinal })
    partsByGraphId.set(binding.graphId, parts)
  }
  return [...partsByGraphId.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([graphId, parts]) => ({
      id: `${graphId}:visual`,
      graphId,
      parts: parts.sort((left, right) => left.role.localeCompare(right.role) || left.ordinal - right.ordinal || left.elementId.localeCompare(right.elementId)),
      ports: ports.filter(port => port.ownerId === graphId).sort((left, right) => left.id.localeCompare(right.id)),
    }))
}
