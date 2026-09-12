import { describe, expect, test } from "vitest"
import { graphLayoutScopeOf, type Graph, validateGraph } from "../src/index.js"

function layoutFixture(): Graph {
  return {
    sealedSequence: {
      id: "sealedSequence",
      type: "node",
      layout: { mode: "sealed", bounds: { x: 10, y: 20, width: 240, height: 160 }, geometryRevisionId: "sequence:1" },
    },
    sequenceGroup: { id: "sequenceGroup", type: "node", parentId: "sealedSequence" },
    actor: { id: "actor", type: "node", parentId: "sequenceGroup" },
    activation: { id: "activation", type: "node", parentId: "actor" },
    sequenceMessage: { id: "sequenceMessage", type: "edge", parentId: "sequenceGroup", fromId: "actor", toId: "activation", direction: "forward" },
    sibling: { id: "sibling", type: "node" },
    externalEdge: { id: "externalEdge", type: "edge", fromId: "sibling", toId: "actor", direction: "forward" },
    excluded: { id: "excluded", type: "node", layout: { mode: "excluded" } },
    excludedChild: { id: "excludedChild", type: "node", parentId: "excluded" },
    excludedEdge: { id: "excludedEdge", type: "edge", parentId: "excluded", fromId: "excluded", toId: "excludedChild", direction: "forward" },
  }
}

describe("graph layout participation", () => {
  test("seals sequence descendants, resolves external endpoints, and omits excluded subtrees", () => {
    const graph = layoutFixture()

    expect({
      diagnostics: validateGraph(graph),
      scope: graphLayoutScopeOf(graph),
    }).toMatchInlineSnapshot(`
      {
        "diagnostics": [],
        "scope": {
          "endpointIdByGraphId": {
            "activation": "sealedSequence",
            "actor": "sealedSequence",
            "excluded": undefined,
            "excludedChild": undefined,
            "excludedEdge": undefined,
            "externalEdge": "externalEdge",
            "sealedSequence": "sealedSequence",
            "sequenceGroup": "sealedSequence",
            "sequenceMessage": "sealedSequence",
            "sibling": "sibling",
          },
          "itemIds": [
            "externalEdge",
            "sealedSequence",
            "sibling",
          ],
        },
      }
    `)
  })

  test("treats undefined participation as managed compatibility", () => {
    const graph: Graph = {
      root: { id: "root", type: "node" },
      child: { id: "child", type: "node", parentId: "root" },
      edge: { id: "edge", type: "edge", parentId: "root", fromId: "root", toId: "child", direction: "forward" },
    }

    expect(graphLayoutScopeOf(graph)).toMatchInlineSnapshot(`
      {
        "endpointIdByGraphId": {
          "child": "child",
          "edge": "edge",
          "root": "root",
        },
        "itemIds": [
          "child",
          "edge",
          "root",
        ],
      }
    `)
  })
})
