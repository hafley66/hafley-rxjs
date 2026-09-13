/// <reference types="vite/client" />
import { fitGraphCamera } from "../../../src/2_graph/1_fitCamera.ts"
import type { Graph, GraphId } from "@hafley66/grapht-model"
import type { GraphFrame, GraphGeometry } from "../../../src/2_graph/0_frame.ts"
import sequenceFixture from "../../../fixtures/sequence/large.json"
import sequenceSvgUrl from "../../../fixtures/sequence/large.svg?url"
type FixtureRect = { id: string; label: string; left: number; width: number; top: number; bottom: number }

/** The smallest group that strictly contains this one, which is its header's parent in the stack. */
function containerOf(group: FixtureRect, groups: readonly FixtureRect[]): string | undefined {
  return groups
    .filter(other => other.id !== group.id && other.top <= group.top && other.bottom >= group.bottom && other.left <= group.left)
    .sort((left, right) => left.bottom - left.top - (right.bottom - right.top))
    .at(0)?.id
}

export async function sequenceFrame(viewport: { width: number; height: number }): Promise<GraphFrame> {
  const svg = await (await fetch(sequenceSvgUrl)).text()
  const box = sequenceFixture.viewBox
  const actors = sequenceFixture.actors as FixtureRect[]
  const groups = sequenceFixture.groups as FixtureRect[]
  const bounds = { x: box.x, y: box.y, width: box.width, height: box.height }

  const graph: Record<string, unknown> = {
    ...Object.fromEntries(Object.entries(sequenceFixture.graph).map(([id, item]) => [id, { ...item, parentId: "parentId" in item ? item.parentId : "seq" }])),
    seq: { id: "seq", type: "node", layout: { mode: "sealed", bounds, geometryRevisionId: "seq:geometry:1" } },
  }
  for (const actor of actors) graph[actor.id] ??= { id: actor.id, type: "node", parentId: "seq" }
  for (const group of groups) graph[group.id] = { id: group.id, type: "node", parentId: containerOf(group, groups) ?? "seq" }

  const geometry: GraphGeometry = {
    revisionId: "seq:1",
    boundsById: {
      seq: bounds,
      ...Object.fromEntries(groups.map(group => [group.id, { x: group.left, y: group.top, width: group.width, height: group.bottom - group.top }])),
    },
    endpointAnchorById: { seq: { x: box.x + box.width / 2, y: box.y + box.height / 2 } },
    routesById: {},
    headerBoundsById: Object.fromEntries(groups.map(group => [group.id, { x: group.left, y: group.top, width: group.width, height: 22 }])),
    columnBoundsById: Object.fromEntries(actors.map(actor => [actor.id, { x: actor.left, y: actor.top, width: actor.width, height: actor.bottom - actor.top }])),
  }

  return {
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
          revisionId: "seq:svg:1",
          bindings: sequenceFixture.bindings as import("../../../src/2_graph/3_sealedSvgArtifact.ts").SealedSvgArtifact["bindings"],
          geometryRevisionId: "seq:geometry:1",
          svg,
          sourceBounds: bounds,
          fit: "contain",
        },
      },
    },
  }
}

