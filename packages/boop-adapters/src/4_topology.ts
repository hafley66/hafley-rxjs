import type { AgentTopology, AgentTopologyProjection, BoopAgentSnapshot } from "./0_types.js"
import { nodeIdentity, parseBoopAgentSnapshot, resolveIdentity } from "./1_validate.js"

export const projectAgentTopology: AgentTopologyProjection = (input) => {
  const snapshot = parseBoopAgentSnapshot(input)
  const nodeIds = snapshot.nodes.map((node) => nodeIdentity(node.harness, node.id))
  const identities = new Set(nodeIds)
  const index = new Map(nodeIds.map((id, position) => [id, position]))
  const edges = snapshot.edges.map((edge) => {
    const from = resolveIdentity(identities, edge.from) as string
    const to = resolveIdentity(identities, edge.to) as string
    return [index.get(from) as number, index.get(to) as number] as [number, number]
  })
  return { nodeIds, edges }
}

export const agentTopologyProjection = projectAgentTopology
export const boopAgentTopology = projectAgentTopology
