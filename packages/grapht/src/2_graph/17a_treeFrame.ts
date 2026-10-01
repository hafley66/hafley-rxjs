import type { Graph } from "@hafley66/grapht-model"
import type { GraphFrame } from "./0_frame.js"

/** Draw containment as directory branches while retaining the caller's source graph. */
export function treeGraphFrame(frame: GraphFrame): GraphFrame {
  const graph: Record<string, Graph[string]> = {}
  const routesById = { ...frame.geometry.routesById }
  const labelsById = { ...frame.presentation.labelsById }
  for (const item of Object.values(frame.graph)) {
    const { parentId, ...flat } = item
    graph[item.id] = flat
    if (!parentId || item.type !== "node") continue
    const parent = frame.geometry.boundsById[parentId], child = frame.geometry.boundsById[item.id]
    if (!parent || !child || frame.presentation.hiddenIds.has(item.id) || frame.presentation.hiddenIds.has(parentId)) continue
    let id = `containment:${item.id}`
    while (frame.graph[id] || graph[id]) id = `:${id}`
    graph[id] = { id, type: "edge", fromId: parentId, toId: item.id, direction: "none" }
    const x = parent.x + 8, y = child.y + child.height / 2
    routesById[id] = new Float32Array([
      parent.x + parent.width / 2, parent.y + parent.height / 2,
      x, parent.y + parent.height + 6, x, y,
      child.x + child.width / 2, y,
    ])
    labelsById[id] = { text: "" }
  }
  return { ...frame, graph, geometry: { ...frame.geometry, routesById }, presentation: { ...frame.presentation, labelsById } }
}
