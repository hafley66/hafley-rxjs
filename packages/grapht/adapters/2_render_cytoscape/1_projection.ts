import cytoscape, { type Core, type ElementDefinition, type NodeSingular } from "cytoscape"
import type { Geometry } from "./0_protocol.ts"

export type Camera = { pan: { x: number; y: number }; zoom: number }
export type Projection = { cy: Core; nodeIds: string[]; mounted: boolean; camera(): Camera; selectedId(): string | undefined; dispose(): void }

export function createProjection(geometry: Geometry, container?: HTMLElement): Projection {
  const elements: ElementDefinition[] = geometry.nodeIds.map((id, index) => ({ data: { id }, position: { x: geometry.positions[index * 2], y: geometry.positions[index * 2 + 1] } }))
  for (const [source, target] of geometry.edges) elements.push({ data: { id: `e${source}_${target}`, source: geometry.nodeIds[source], target: geometry.nodeIds[target] } })
  const style = [
    { selector: "node", style: { backgroundColor: "#5b9bed", width: 8, height: 8, label: "data(id)", color: "#e9eef6", fontSize: 8 } },
    { selector: "edge", style: { lineColor: "#78879d", width: 1, opacity: 0.42 } },
    { selector: ":selected", style: { backgroundColor: "#f5a33b", lineColor: "#f5a33b", borderWidth: 2, borderColor: "#fff" } },
  ] as any
  const positions = Object.fromEntries(geometry.nodeIds.map((id, index) => [id, { x: geometry.positions[index * 2], y: geometry.positions[index * 2 + 1] }]))
  const cy = cytoscape({ container, headless: !container, elements, style })
  cy.layout({ name: "preset", positions, fit: false } as any).run()
  return {
    cy, nodeIds: geometry.nodeIds, mounted: Boolean(container),
    camera: () => ({ pan: { ...cy.pan() }, zoom: cy.zoom() }),
    selectedId: () => cy.$("node:selected").first().data("id") as string | undefined,
    dispose: () => cy.destroy(),
  }
}

export function selectNode(projection: Projection, id: string): void {
  projection.cy.nodes().unselect()
  const node: NodeSingular = projection.cy.getElementById(id)
  if (node.nonempty()) node.select()
}

export function exerciseInteraction(projection: Projection, selectedId: string): { selectedId?: string; camera: Camera; visibleNodes: number; visibleEdges: number } {
  if (projection.mounted) projection.cy.fit(undefined, 20)
  else { projection.cy.pan({ x: 0, y: 0 }); projection.cy.zoom(1) }
  const fitted = projection.camera()
  projection.cy.pan({ x: fitted.pan.x + 15, y: fitted.pan.y - 10 })
  projection.cy.zoom({ level: fitted.zoom * 1.1, renderedPosition: { x: 256, y: 192 } })
  selectNode(projection, selectedId)
  return { selectedId: projection.selectedId(), camera: projection.camera(), visibleNodes: projection.cy.nodes().length, visibleEdges: projection.cy.edges().length }
}
