/// <reference types="vite/client" />
import { svgGraphGeometryOf } from "../../../src/2_graph/4_svgGeometry.ts"
import { fitGraphCamera } from "../../../src/2_graph/1_fitCamera.ts"
import type { Graph, GraphId } from "@hafley66/grapht-model"
import type { GraphFrame, GraphGeometry } from "../../../src/2_graph/0_frame.ts"
import largeFixture from "../../../fixtures/sequence/large.json"
import largeSvgUrl from "../../../fixtures/sequence/large.svg?url"
import largeSource from "../../../fixtures/sequence/large.mmd?raw"
import d2Fixture from "../../../fixtures/sequence/paired-d2.json"
import d2SvgUrl from "../../../fixtures/sequence/paired-d2.svg?url"
import d2Source from "../../../fixtures/sequence/paired-d2.d2?raw"
import mermaidFixture from "../../../fixtures/sequence/paired-mermaid.json"
import mermaidSvgUrl from "../../../fixtures/sequence/paired-mermaid.svg?url"
import mermaidSource from "../../../fixtures/sequence/paired-mermaid.mmd?raw"
const fixtures = {
  sequence: { metadata: largeFixture, url: largeSvgUrl, source: largeSource, language: "mermaid" as const },
  "paired-d2": { metadata: d2Fixture, url: d2SvgUrl, source: d2Source, language: "d2" as const },
  "paired-mermaid": { metadata: mermaidFixture, url: mermaidSvgUrl, source: mermaidSource, language: "mermaid" as const },
}
type FixtureRect = { id: string; label: string; left: number; width: number; top: number; bottom: number }

/** The smallest group that strictly contains this one, which is its header's parent in the stack. */
function containerOf(group: FixtureRect, groups: readonly FixtureRect[]): string | undefined {
  return groups
    .filter(other => other.id !== group.id && other.top <= group.top && other.bottom >= group.bottom && other.left <= group.left)
    .sort((left, right) => left.bottom - left.top - (right.bottom - right.top))
    .at(0)?.id
}

export async function sequenceFrame(viewport: { width: number; height: number }, example: keyof typeof fixtures = "sequence"): Promise<GraphFrame> {
  const fixture = fixtures[example]
  const sequenceFixture = fixture.metadata
  const svg = await (await fetch(fixture.url)).text()
  const box = sequenceFixture.viewBox
  const actors = sequenceFixture.actors as FixtureRect[]
  const groups = sequenceFixture.groups as FixtureRect[]
  const bounds = { x: box.x, y: box.y, width: box.width, height: box.height }

  const graph: Record<string, unknown> = {
    ...Object.fromEntries(Object.entries(sequenceFixture.graph).map(([id, item]) => [id, { ...item, parentId: "parentId" in item ? item.parentId : "seq" }])),
    seq: { id: "seq", type: "node", layout: { mode: "sealed", bounds, geometryRevisionId: "seq:geometry:1" } },
  }
  for (const actor of actors) graph[actor.id] ??= { id: actor.id, type: "node", parentId: "seq" }
  for (const group of groups) graph[group.id] = { ...(graph[group.id] as object), id: group.id, type: "node", parentId: containerOf(group, groups) ?? "seq" }

  const geometry: GraphGeometry = {
    revisionId: `${example}:1`,
    boundsById: {
      seq: bounds,
      ...Object.fromEntries(groups.map(group => [group.id, { x: group.left, y: group.top, width: group.width, height: group.bottom - group.top }])),
    },
    endpointAnchorById: { seq: { x: box.x + box.width / 2, y: box.y + box.height / 2 } },
    routesById: {},
    headerBoundsById: Object.fromEntries(groups.map(group => [group.id, { x: group.left, y: group.top, width: group.width, height: 22 }])),
    columnBoundsById: Object.fromEntries(actors.map(actor => [actor.id, { x: actor.left, y: actor.top, width: actor.width, height: actor.bottom - actor.top }])),
  }

  const frame: GraphFrame = {
    graph: graph as Graph,
    geometry,
    camera: fitGraphCamera(geometry, { x: 0, y: 0, width: viewport.width, height: viewport.height }, 24),
    presentation: {
      stickyHeaders: [],
      hiddenIds: new Set<GraphId>(),
      focusedIds: new Set<GraphId>(),
      labelsById: { ...Object.fromEntries(Object.entries(sequenceFixture.graph).map(([id, item]) => [id, { text: item.data.label ?? "" }])), ...Object.fromEntries([...actors, ...groups].map(item => [item.id, { text: item.label }])) },
      sealedSvgArtifactsByRootId: {
        seq: {
          rootId: "seq",
          revisionId: `${example}:svg:1`,
          bindings: sequenceFixture.bindings as import("../../../src/2_graph/3_sealedSvgArtifact.ts").SealedSvgArtifact["bindings"],
          geometryRevisionId: "seq:geometry:1",
          svg,
          source: { language: fixture.language, text: fixture.source, locator: sequenceFixture.source },
          sourceBounds: bounds,
          fit: "contain",
        },
      },
    },
  }
  const measured = svgGraphGeometryOf(document, frame.presentation.sealedSvgArtifactsByRootId.seq)
  frame.geometry = { ...frame.geometry, boundsById: { ...measured.boundsById, ...geometry.boundsById }, endpointAnchorById: { ...measured.endpointAnchorById, ...geometry.endpointAnchorById }, routesById: measured.routesById }
  return frame
}

