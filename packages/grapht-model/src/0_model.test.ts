import { describe, expect, it } from "vitest"
import {
  boardRevisionSchema,
  graphTopologySchema,
  matchEntities,
  reconcilePlacements,
  resolveSequenceFocus,
  toggleSequenceGroup,
} from "./index.js"

describe("grapht-model", () => {
  it("validates topology and preserves addressable sequence entities", () => {
    const topology = {
      language: "mermaid",
      entities: [
        { id: "actor/api", kind: "actor" as const, label: "API", ordinal: 0 },
        { id: "actor/db", kind: "actor" as const, label: "DB", ordinal: 1 },
        { id: "message/query", kind: "message" as const, label: "query", ordinal: 2 },
        { id: "group/retry", kind: "group" as const, label: "retry", ordinal: 3 },
      ],
      relations: [
        { id: "relation/query", kind: "message" as const, sourceId: "actor/api", targetId: "actor/db", ordinal: 0 },
        { id: "contains/retry", kind: "contains" as const, sourceId: "group/retry", targetId: "message/query", ordinal: 0 },
      ],
      sourceSpans: [],
    }
    expect(graphTopologySchema.parse(topology)).toMatchInlineSnapshot(`
      {
        "entities": [
          {
            "id": "actor/api",
            "kind": "actor",
            "label": "API",
            "ordinal": 0,
          },
          {
            "id": "actor/db",
            "kind": "actor",
            "label": "DB",
            "ordinal": 1,
          },
          {
            "id": "message/query",
            "kind": "message",
            "label": "query",
            "ordinal": 2,
          },
          {
            "id": "group/retry",
            "kind": "group",
            "label": "retry",
            "ordinal": 3,
          },
        ],
        "language": "mermaid",
        "relations": [
          {
            "id": "relation/query",
            "kind": "message",
            "ordinal": 0,
            "sourceId": "actor/api",
            "targetId": "actor/db",
          },
          {
            "id": "contains/retry",
            "kind": "contains",
            "ordinal": 0,
            "sourceId": "group/retry",
            "targetId": "message/query",
          },
        ],
        "sourceSpans": [],
      }
    `)
  })

  it("resolves message and activation focus to actors and groups", () => {
    const topology = {
      language: "d2",
      entities: [
        { id: "api", kind: "actor" as const, label: "API", ordinal: 0 },
        { id: "db", kind: "actor" as const, label: "DB", ordinal: 1 },
        { id: "group/retry", kind: "group" as const, label: "retry", ordinal: 2 },
        { id: "message/retry", kind: "message" as const, parentId: "group/retry", ordinal: 3 },
        { id: "activation/db", kind: "activation" as const, parentId: "db", ordinal: 4 },
      ],
      relations: [
        { id: "message/retry", kind: "message" as const, sourceId: "api", targetId: "db", parentId: "group/retry", ordinal: 0 },
      ],
      sourceSpans: [],
    }
    expect(resolveSequenceFocus(topology, "message/retry")).toMatchInlineSnapshot(`
      {
        "actorIds": [
          "api",
          "db",
        ],
        "groupIds": [
          "group/retry",
        ],
        "hoveredEntityId": "message/retry",
      }
    `)
    expect(resolveSequenceFocus(topology, "activation/db")).toMatchInlineSnapshot(`
      {
        "actorIds": [
          "db",
        ],
        "groupIds": [],
        "hoveredEntityId": "activation/db",
      }
    `)
  })

  it("records duplicate structural matches as ambiguous", () => {
    const previous = [
      { id: "old/1", kind: "message" as const, label: "retry", ordinal: 0 },
      { id: "old/2", kind: "message" as const, label: "retry", ordinal: 1 },
    ]
    const next = [{ id: "new/1", kind: "message" as const, label: "retry", ordinal: 0 }]
    expect(matchEntities(previous, next)).toMatchInlineSnapshot(`
      {
        "ambiguous": [
          "new/1",
        ],
        "inserted": [
          "new/1",
        ],
        "removed": [
          "old/1",
          "old/2",
        ],
        "retained": [],
      }
    `)
  })

  it("reconciles placements and keeps manual placement provenance", () => {
    const board = boardRevisionSchema.parse({
      id: "board/1",
      graphRevisionId: "graph/1",
      collapsedGroupIds: [],
      placements: [{
        viewId: "view/1",
        entityId: "api",
        baseGeometryRevisionId: "geometry/1",
        rect: { x: 80, y: 12, width: 100, height: 30 },
        source: "manual",
        policy: "delta-from-layout",
      }],
    })
    const result = reconcilePlacements({
      previous: board,
      next: {
        revisionId: "graph/2",
        geometry: {
          id: "geometry/2",
          renderRevisionId: "render/2",
          coordinateSpace: "svg-viewBox",
          viewBox: { x: 0, y: 0, width: 500, height: 300 },
          entities: [
            { entityId: "api", localBounds: { x: 0, y: 0, width: 100, height: 30 }, worldBounds: { x: 10, y: 20, width: 100, height: 30 }, sourceSvgElementIds: ["g-api"] },
            { entityId: "db", localBounds: { x: 0, y: 0, width: 100, height: 30 }, worldBounds: { x: 300, y: 20, width: 100, height: 30 }, sourceSvgElementIds: ["g-db"] },
          ],
        },
      },
    })
    expect(result).toMatchInlineSnapshot(`
      {
        "ambiguous": [],
        "inserted": [
          "db",
        ],
        "placements": [
          {
            "baseGeometryRevisionId": "geometry/2",
            "entityId": "api",
            "policy": "delta-from-layout",
            "rect": {
              "height": 30,
              "width": 100,
              "x": 80,
              "y": 12,
            },
            "source": "manual",
            "viewId": "view/1",
          },
          {
            "baseGeometryRevisionId": "geometry/2",
            "entityId": "db",
            "policy": "delta-from-layout",
            "rect": {
              "height": 30,
              "width": 100,
              "x": 300,
              "y": 20,
            },
            "source": "auto-layout",
            "viewId": "view/1",
          },
        ],
        "removed": [],
        "retained": [
          "api",
        ],
      }
    `)
  })

  it("toggles group collapse without mutating the prior state", () => {
    const state = { collapsedGroupIds: ["group/a"] }
    expect(toggleSequenceGroup(state, "group/b")).toEqual({ collapsedGroupIds: ["group/a", "group/b"] })
    expect(state).toEqual({ collapsedGroupIds: ["group/a"] })
    expect(toggleSequenceGroup(state, "group/a")).toEqual({ collapsedGroupIds: [] })
  })
})
