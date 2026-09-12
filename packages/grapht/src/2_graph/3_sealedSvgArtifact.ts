import type { Graph, GraphId, SvgBindingRole } from "@hafley66/grapht-model"
import type { Rect } from "../1_sequence/3_geometry.js"

export type SealedSvgArtifact = {
  rootId: GraphId
  revisionId: string
  geometryRevisionId: string
  svg: string
  sourceBounds: Rect
  fit: "contain"
  graphIdByElementId?: Readonly<Record<string, GraphId>>
  bindings?: readonly {
    elementId: string
    graphId: GraphId
    role: SvgBindingRole
    ordinal: number
  }[]
}

export type SealedSvgArtifactsByRootId = Readonly<Record<GraphId, SealedSvgArtifact>>

export const EMPTY_SEALED_SVG_ARTIFACTS_BY_ROOT_ID: SealedSvgArtifactsByRootId = Object.freeze({})

function sameRect(left: Rect, right: Rect): boolean {
  return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height
}

/** Validates presentation artifacts while preserving their record identity. */
export function validateSealedSvgArtifacts(graph: Graph, artifacts: SealedSvgArtifactsByRootId): SealedSvgArtifactsByRootId {
  for (const rootId of Object.keys(artifacts).sort()) {
    const artifact = artifacts[rootId]
    if (artifact.rootId !== rootId) throw new Error(`sealed SVG artifact key ${rootId} does not match root ${artifact.rootId}`)
    const root = graph[rootId]
    if (root?.type !== "node" || root.layout?.mode !== "sealed") {
      throw new Error(`sealed SVG artifact ${rootId} requires a sealed graph node`)
    }
    if (artifact.geometryRevisionId !== root.layout.geometryRevisionId) {
      throw new Error(`sealed SVG artifact ${rootId} geometry revision ${artifact.geometryRevisionId} does not match sealed layout revision ${root.layout.geometryRevisionId}`)
    }
    if (!sameRect(artifact.sourceBounds, root.layout.bounds)) {
      throw new Error(`sealed SVG artifact ${rootId} source bounds do not match sealed layout bounds`)
    }
    for (const [elementId, graphId] of Object.entries(artifact.graphIdByElementId ?? {})) {
      if (elementId.length === 0) throw new Error(`sealed SVG artifact ${rootId} contains an empty element id`)
      if (graph[graphId] === undefined) throw new Error(`sealed SVG artifact ${rootId} maps element ${elementId} to missing graph item ${graphId}`)
    }
    for (const binding of artifact.bindings ?? []) {
      if (graph[binding.graphId] === undefined) throw new Error(`sealed SVG artifact ${rootId} maps element ${binding.elementId} to missing graph item ${binding.graphId}`)
    }
  }
  return artifacts
}
