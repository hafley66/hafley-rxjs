import { documentFingerprint, validateGraph, type Graph } from "@hafley66/grapht-model"
import type { GraphFrame } from "./0_frame.js"
import { fitGraphCamera } from "./1_fitCamera.js"
import { validateSealedSvgArtifacts, type SealedSvgArtifact } from "./3_sealedSvgArtifact.js"
import { svgGraphGeometryOf } from "./4_svgGeometry.js"

export type SvgFrameInput = {
  svg: string
  locator: string
  rootId?: string
  viewport: { width: number; height: number }
  /** Optional semantic graph and explicit SVG-element bindings enable native interaction. */
  graph?: Graph
  bindings?: SealedSvgArtifact["bindings"]
}

/** Ingest any SVG as a source-preserving sealed frame. XML geometry alone does not establish
 * edge endpoints. Supply graph + bindings for native Cytoscape nodes/edges; renderers sanitize
 * SVG at their mounting boundary. Source text remains caller-owned.
 */
export function svgFrame(document: Document, input: SvgFrameInput): GraphFrame {
  const parsed = new DOMParser().parseFromString(input.svg, "image/svg+xml")
  const svg = parsed.documentElement
  if (parsed.querySelector("parsererror") || svg.localName !== "svg") throw new Error("Expected a valid SVG document")
  const viewBox = svg.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number)
  const dimension = (name: string) => {
    const value = svg.getAttribute(name) ?? ""
    return /^\d+(?:\.\d+)?(?:px)?$/.test(value) ? parseFloat(value) : NaN
  }
  const values = viewBox ?? [0, 0, dimension("width"), dimension("height")]
  if (values.length !== 4 || !values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0) throw new Error("SVG requires a finite viewBox or positive pixel width/height")
  const sourceBounds = { x: values[0], y: values[1], width: values[2], height: values[3] }
  const rootId = input.rootId ?? "svg"
  if (input.graph?.[rootId]) throw new Error(`SVG root ID conflicts with graph item: ${rootId}`)
  const revisionId = `svg:${documentFingerprint([input.svg, input.graph, input.bindings])}`
  const graph: Graph = { ...Object.fromEntries(Object.entries(input.graph ?? {}).map(([id, item]) => [id, { ...item, parentId: item.parentId ?? rootId }])),
    [rootId]: { id: rootId, type: "node", layout: { mode: "sealed", bounds: sourceBounds, geometryRevisionId: revisionId } } }
  const diagnostics = validateGraph(graph)
  if (diagnostics.length) throw new Error(diagnostics.map(item => item.message).join("\n"))
  const ids = new Set<string>()
  for (const element of parsed.querySelectorAll("[id]")) {
    if (ids.has(element.id)) throw new Error(`Duplicate SVG element ID: ${element.id}`)
    ids.add(element.id)
  }
  for (const binding of input.bindings ?? []) if (!ids.has(binding.elementId)) throw new Error(`Missing bound SVG element: ${binding.elementId}`)
  const artifact: SealedSvgArtifact = { rootId, revisionId, geometryRevisionId: revisionId, svg: input.svg,
    source: { language: "svg", text: input.svg, locator: input.locator }, sourceBounds, fit: "contain", bindings: input.bindings }
  validateSealedSvgArtifacts(graph, { [rootId]: artifact })
  const measured = input.bindings?.length ? svgGraphGeometryOf(document, artifact) : { boundsById: {}, endpointAnchorById: {}, routesById: {}, headerBoundsById: {} }
  const geometry = { ...measured, revisionId, boundsById: { ...measured.boundsById, [rootId]: sourceBounds } }
  return { graph, geometry, camera: fitGraphCamera(geometry, { x: 0, y: 0, ...input.viewport }, 24),
    presentation: { stickyHeaders: [], hiddenIds: new Set(), focusedIds: new Set(),
      labelsById: Object.fromEntries(Object.values(graph).map(item => [item.id, { text: typeof item.data === "object" && item.data !== null && "label" in item.data ? String(item.data.label) : item.id }])),
      sealedSvgArtifactsByRootId: { [rootId]: artifact } } }
}
