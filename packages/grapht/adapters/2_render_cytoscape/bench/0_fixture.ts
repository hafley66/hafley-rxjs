// Repeat the checked sequence inside one graph and one SVG, preserving each copy's source order.
import { sequenceFrame } from "../proof/0_sequenceFrame.ts"
import type { GraphFrame } from "../../../src/2_graph/0_frame.ts"

export async function memoryFixture(copies: number): Promise<GraphFrame> {
  const base = await sequenceFrame({ width: 1280, height: 800 })
  const artifact = base.presentation.sealedSvgArtifactsByRootId.seq
  const height = artifact.sourceBounds.height
  const bounds = { ...artifact.sourceBounds, height: height * copies }
  const root = new DOMParser().parseFromString(artifact.svg, "image/svg+xml").documentElement
  const output = root.cloneNode(false) as Element
  output.setAttribute("viewBox", `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`)
  output.setAttribute("width", String(bounds.width))
  output.setAttribute("height", String(bounds.height))
  const graph: Record<string, any> = { seq: { ...base.graph.seq, layout: { mode: "sealed", bounds, geometryRevisionId: "scaled" } } }
  const labels: Record<string, any> = {}
  const bindings: NonNullable<typeof artifact.bindings>[number][] = []
  const geometry = { revisionId: "scaled", boundsById: { seq: bounds } as Record<string, any>, endpointAnchorById: {}, routesById: {}, headerBoundsById: {} as Record<string, any>, columnBoundsById: {} as Record<string, any> }
  for (let index = 0; index < copies; index++) {
    const prefix = `copy${index}:`
    const idOf = (id: string) => id === "seq" ? "seq" : prefix + id
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g")
    group.setAttribute("transform", `translate(0 ${height * index})`)
    const clone = root.cloneNode(true) as Element
    const ids = new Map([...clone.querySelectorAll("[id]")].map(element => [element.id, prefix + element.id]))
    for (const element of clone.querySelectorAll("*")) {
      for (const attribute of [...element.attributes]) {
        if (attribute.name === "id") element.setAttribute("id", ids.get(attribute.value)!)
        else element.setAttribute(attribute.name, attribute.value.replace(/url\(#([^)]*)\)/g, (_, id) => `url(#${ids.get(id) ?? id})`).replace(/^#(.+)$/, (_, id) => `#${ids.get(id) ?? id}`))
      }
    }
    group.append(...clone.childNodes)
    output.appendChild(group)
    for (const [id, item] of Object.entries(base.graph)) {
      if (id === "seq") continue
      graph[idOf(id)] = { ...item, id: idOf(id), ...(item.parentId ? { parentId: idOf(item.parentId) } : {}), ...(item.type === "edge" ? { fromId: idOf(item.fromId), toId: idOf(item.toId) } : {}) }
    }
    for (const [id, label] of Object.entries(base.presentation.labelsById)) labels[idOf(id)] = label
    for (const binding of artifact.bindings ?? []) bindings.push({ ...binding, elementId: prefix + binding.elementId, graphId: idOf(binding.graphId) })
    for (const key of ["boundsById", "headerBoundsById", "columnBoundsById"] as const) {
      for (const [id, rect] of Object.entries(base.geometry[key] ?? {})) {
        if (id !== "seq") geometry[key][idOf(id)] = { ...rect, y: rect.y + index * height }
      }
    }
  }
  return { graph, geometry, camera: { ...base.camera, x: 24, y: 24, scale: 0.3 }, presentation: { ...base.presentation, labelsById: labels, sealedSvgArtifactsByRootId: { seq: { ...artifact, revisionId: "scaled", geometryRevisionId: "scaled", sourceBounds: bounds, bindings, svg: new XMLSerializer().serializeToString(output) } } } }
}
