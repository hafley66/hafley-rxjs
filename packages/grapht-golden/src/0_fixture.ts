import type { SealedSvgArtifact } from "@hafley66/grapht/browser"
import { decorateSvg, graphVisualsOf, sequenceDocumentToGraph, type Graph, type GraphId, type GraphPort, type GraphVisual, type NativeRenderReceipt, type PortLocation } from "@hafley66/grapht-model"
import { bindMermaidSvg, identifyMermaidOccurrences, parseMermaidSequence } from "@hafley66/mmd/browser"
import { bindD2Svg, identifyD2Occurrences, parseD2Sequence } from "@hafley66/d2/browser"
import mermaidSvg from "../../../fixtures/sequence/6_mermaid.svg?raw"
import mermaidReceiptJson from "../../../fixtures/sequence/7_mermaid.receipt.json?raw"
import mermaidSource from "../../../fixtures/sequence/0_mermaid.mmd?raw"
import d2Svg from "../../../fixtures/sequence/10_d2.svg?raw"
import d2ReceiptJson from "../../../fixtures/sequence/11_d2.receipt.json?raw"
import d2Source from "../../../fixtures/sequence/2_d2.d2?raw"

export type GoldenGraphData = { label: string }
export type GoldenScenarioId = "mermaid" | "d2" | "generic"
export type GoldenScenario = {
  id: GoldenScenarioId
  label: string
  graph: Graph
  sealedSvgArtifactsByRootId: Readonly<Record<GraphId, SealedSvgArtifact>>
  ports: readonly GraphPort[]
  visuals: readonly GraphVisual[]
}

export const goldenGraph = {
  platform: { id: "platform", type: "node", data: { label: "Platform" } },
  ingestion: { id: "ingestion", type: "node", parentId: "platform", data: { label: "Ingestion" } },
  parsers: { id: "parsers", type: "node", parentId: "ingestion", data: { label: "Parsers" } },
  json: { id: "json", type: "node", parentId: "parsers", data: { label: "JSON source" } },
  typescript: { id: "typescript", type: "node", parentId: "parsers", data: { label: "TypeScript source" } },
  normalization: { id: "normalization", type: "node", parentId: "ingestion", data: { label: "Normalization" } },
  canonical: { id: "canonical", type: "node", parentId: "normalization", data: { label: "Canonical records" } },
  delivery: { id: "delivery", type: "node", parentId: "platform", data: { label: "Delivery" } },
  renderers: { id: "renderers", type: "node", parentId: "delivery", data: { label: "Renderers" } },
  cytoscape: { id: "cytoscape", type: "node", parentId: "renderers", data: { label: "Cytoscape" } },
  pixi: { id: "pixi", type: "node", parentId: "renderers", data: { label: "Pixi" } },
  inspection: { id: "inspection", type: "node", parentId: "delivery", data: { label: "Inspection" } },
  hover: { id: "hover", type: "node", parentId: "inspection", data: { label: "Hover feedback" } },
  selection: { id: "selection", type: "node", parentId: "inspection", data: { label: "Selection feedback" } },
  "parse-flow": { id: "parse-flow", type: "edge", parentId: "platform", fromId: "json", toId: "canonical", direction: "forward", data: { label: "directed parse" } },
  "shared-shape": { id: "shared-shape", type: "edge", parentId: "platform", fromId: "typescript", toId: "canonical", direction: "none", data: { label: "undirected shape" } },
  "renderer-sync": { id: "renderer-sync", type: "edge", parentId: "platform", fromId: "canonical", toId: "cytoscape", direction: "both", data: { label: "bidirectional sync" } },
  "renderer-sync-2": { id: "renderer-sync-2", type: "edge", parentId: "platform", fromId: "canonical", toId: "cytoscape", direction: "forward", data: { label: "parallel render path" } },
  "feedback-flow": { id: "feedback-flow", type: "edge", parentId: "platform", fromId: "pixi", toId: "hover", direction: "forward", data: { label: "feedback" } },
  "edge-to-edge": { id: "edge-to-edge", type: "edge", parentId: "platform", fromId: "parse-flow", toId: "renderer-sync", direction: "forward", data: { label: "edge to edge" } },
} satisfies Graph<GoldenGraphData, GoldenGraphData>

function viewBoxOf(svg: string): { x: number; y: number; width: number; height: number } {
  const value = /\bviewBox=["']([^"']+)["']/.exec(svg)?.[1]
  const numbers = value?.trim().split(/[\s,]+/).map(Number)
  if (numbers?.length !== 4 || numbers.some(number => !Number.isFinite(number))) throw new Error("Checked SVG fixture has no finite viewBox")
  return { x: numbers[0], y: numbers[1], width: numbers[2], height: numbers[3] }
}

function sealedScenario(id: "mermaid" | "d2", label: string, source: string, svg: string, receiptJson: string): GoldenScenario {
  const receipt = { ...(JSON.parse(receiptJson) as Omit<NativeRenderReceipt, "svg">), svg }
  const document = id === "mermaid" ? parseMermaidSequence(source) : parseD2Sequence(source)
  const occurrences = id === "mermaid" ? identifyMermaidOccurrences(document as ReturnType<typeof parseMermaidSequence>) : identifyD2Occurrences(document as ReturnType<typeof parseD2Sequence>)
  const bindings = id === "mermaid"
    ? bindMermaidSvg(document as ReturnType<typeof parseMermaidSequence>, occurrences, receipt)
    : bindD2Svg(document as ReturnType<typeof parseD2Sequence>, occurrences, receipt)
  const rootId = `${id}:sequence`
  const geometryRevisionId = `${id}:${receipt.svgHash}`
  const bounds = viewBoxOf(svg)
  const occurrenceGraph = sequenceDocumentToGraph(occurrences)
  const graph: Graph = {
    ...Object.fromEntries(Object.entries(occurrenceGraph).map(([graphId, item]) => [graphId, item.parentId === undefined ? { ...item, parentId: rootId } : item])),
    [rootId]: {
      id: rootId,
      type: "node",
      data: { label },
      layout: { mode: "sealed", bounds, geometryRevisionId },
    },
  }
  const endpointIds = Object.values(graph).flatMap(item => item.type === "edge" ? [item.fromId, item.toId] : [])
  const edgeIds = Object.values(graph).filter(item => item.type === "edge").map(item => item.id)
  const locations: PortLocation[] = [
    { kind: "absolute", point: { x: bounds.x + 12, y: bounds.y + 12 } },
    { kind: "relative-box", x: 0.5, y: 0.5 },
    { kind: "side", side: "bottom", offset: { unit: "ratio", value: 0.5 }, orientation: { mode: "tangent" } },
    { kind: "boundary", offset: { unit: "ratio", value: 0.25 }, lateralOffset: 4, orientation: { mode: "reverse-tangent" } },
    { kind: "path", pathId: edgeIds[0], offset: { unit: "ratio", value: 0.5 }, lateralOffset: 4, orientation: { mode: "fixed", angle: 0 } },
  ]
  const ports = locations.map((location, index): GraphPort => ({
    id: `${rootId}:port:${location.kind}`,
    ownerId: location.kind === "path" ? edgeIds[0] : endpointIds[index % endpointIds.length],
    location,
  }))
  const artifactBindings = bindings.bindings.map(binding => ({ elementId: binding.elementId, graphId: binding.occurrenceId, role: binding.role, ordinal: binding.ordinal }))
  return {
    id,
    label,
    graph,
    ports,
    visuals: graphVisualsOf(artifactBindings, ports),
    sealedSvgArtifactsByRootId: {
      [rootId]: {
        rootId,
        revisionId: receipt.svgHash,
        geometryRevisionId,
        svg: decorateSvg(receipt, bindings),
        sourceBounds: bounds,
        fit: "contain",
        graphIdByElementId: Object.fromEntries(bindings.bindings.map(binding => [binding.elementId, binding.occurrenceId])),
        bindings: artifactBindings,
      },
    },
  }
}

export const goldenScenarios: Readonly<Record<GoldenScenarioId, GoldenScenario>> = {
  mermaid: sealedScenario("mermaid", "Mermaid sequence", mermaidSource, mermaidSvg, mermaidReceiptJson),
  d2: sealedScenario("d2", "D2 sequence", d2Source, d2Svg, d2ReceiptJson),
  generic: { id: "generic", label: "Generic fCoSE graph", graph: goldenGraph, sealedSvgArtifactsByRootId: {}, ports: [], visuals: [] },
}
