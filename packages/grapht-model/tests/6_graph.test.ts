import { describe, expect, test } from "vitest"
import {
  ancestorsOf,
  depthOf,
  descendantsOf,
  indexGraph,
  type Graph,
  type GraphIndexes,
  validateGraph,
} from "../src/6_graph.js"

function graphFixture(): Graph<string, string> {
  return {
    root: { id: "root", type: "node", data: "container" },
    child: { id: "child", type: "node", parentId: "root" },
    grandchild: { id: "grandchild", type: "node", parentId: "child" },
    sibling: { id: "sibling", type: "node", parentId: "root" },
    nestedEdge: {
      id: "nestedEdge",
      type: "edge",
      parentId: "child",
      fromId: "child",
      toId: "grandchild",
      direction: "forward",
    },
    parallelA: { id: "parallelA", type: "edge", fromId: "child", toId: "sibling", direction: "forward" },
    parallelB: { id: "parallelB", type: "edge", fromId: "child", toId: "sibling", direction: "forward" },
    selfEdge: { id: "selfEdge", type: "edge", fromId: "sibling", toId: "sibling", direction: "none" },
    undirected: { id: "undirected", type: "edge", fromId: "child", toId: "root", direction: "none" },
    bidirectional: { id: "bidirectional", type: "edge", fromId: "sibling", toId: "grandchild", direction: "both" },
    edgeToEdge: {
      id: "edgeToEdge",
      type: "edge",
      fromId: "parallelA",
      toId: "parallelB",
      direction: "forward",
    },
  }
}

function mapSnapshot(map: ReadonlyMap<string, readonly string[]>): Record<string, string[]> {
  return Object.fromEntries([...map.entries()].map(([key, value]) => [key, [...value]]))
}

function indexSnapshot(indexes: GraphIndexes) {
  return {
    childrenByParent: mapSnapshot(indexes.childrenByParent),
    incomingByEndpoint: mapSnapshot(indexes.incomingByEndpoint),
    outgoingByEndpoint: mapSnapshot(indexes.outgoingByEndpoint),
    incidentByEndpoint: mapSnapshot(indexes.incidentByEndpoint),
  }
}

describe("graph canonical model", () => {
  test("indexes one fixture with nesting, parallel, self, and edge-to-edge edges", () => {
    expect(indexSnapshot(indexGraph(graphFixture()))).toMatchInlineSnapshot(`
      {
        "childrenByParent": {
          "child": [
            "grandchild",
            "nestedEdge",
          ],
          "root": [
            "child",
            "sibling",
          ],
        },
        "incidentByEndpoint": {
          "child": [
            "nestedEdge",
            "parallelA",
            "parallelB",
            "undirected",
          ],
          "grandchild": [
            "bidirectional",
            "nestedEdge",
          ],
          "parallelA": [
            "edgeToEdge",
          ],
          "parallelB": [
            "edgeToEdge",
          ],
          "root": [
            "undirected",
          ],
          "sibling": [
            "bidirectional",
            "parallelA",
            "parallelB",
            "selfEdge",
          ],
        },
        "incomingByEndpoint": {
          "grandchild": [
            "bidirectional",
            "nestedEdge",
          ],
          "parallelB": [
            "edgeToEdge",
          ],
          "sibling": [
            "bidirectional",
            "parallelA",
            "parallelB",
          ],
        },
        "outgoingByEndpoint": {
          "child": [
            "nestedEdge",
            "parallelA",
            "parallelB",
          ],
          "grandchild": [
            "bidirectional",
          ],
          "parallelA": [
            "edgeToEdge",
          ],
          "sibling": [
            "bidirectional",
          ],
        },
      }
    `)
  })

  test("derives ancestors, descendants, and depth", () => {
    const graph = graphFixture()
    expect({
      ancestors: ancestorsOf(graph, "grandchild"),
      descendants: descendantsOf(graph, "root"),
      depth: depthOf(graph, "grandchild"),
    }).toMatchInlineSnapshot(`
      {
        "ancestors": [
          "child",
          "root",
        ],
        "depth": 2,
        "descendants": [
          "child",
          "grandchild",
          "nestedEdge",
          "sibling",
        ],
      }
    `)
  })

  test("reports a self edge once in incident index", () => {
    const incident = indexGraph(graphFixture()).incidentByEndpoint.get("sibling") ?? []
    expect(incident.filter(id => id === "selfEdge")).toHaveLength(1)
  })

  test("indexes a bidirectional self edge once for each directional index", () => {
    const indexes = indexGraph({
      self: { id: "self", type: "node" },
      edge: { id: "edge", type: "edge", fromId: "self", toId: "self", direction: "both" },
    })

    expect({
      incoming: indexes.incomingByEndpoint.get("self"),
      outgoing: indexes.outgoingByEndpoint.get("self"),
      incident: indexes.incidentByEndpoint.get("self"),
    }).toMatchInlineSnapshot(`
      {
        "incident": [
          "edge",
        ],
        "incoming": [
          "edge",
        ],
        "outgoing": [
          "edge",
        ],
      }
    `)
  })

  test("validates key mismatch, missing parent, missing endpoint, and cycles", () => {
    expect(
      validateGraph({
        mismatch: { id: "other", type: "node" },
        orphan: { id: "orphan", type: "node", parentId: "missing" },
        dangling: { id: "dangling", type: "edge", fromId: "nope", toId: "mismatch", direction: "forward" },
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "code": "GRAPH_MISSING_ENDPOINT",
          "message": "edge dangling references missing endpoint nope",
        },
        {
          "code": "GRAPH_KEY_ID_MISMATCH",
          "message": "graph key mismatch does not match item id other",
        },
        {
          "code": "GRAPH_MISSING_PARENT",
          "message": "item orphan references missing parent missing",
        },
      ]
    `)

    expect(
      validateGraph({
        a: { id: "a", type: "node", parentId: "b" },
        b: { id: "b", type: "node", parentId: "a" },
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "code": "GRAPH_PARENT_CYCLE",
          "message": "item a participates in a parent cycle",
        },
      ]
      `)

    expect(
      validateGraph({
        self: { id: "self", type: "node", parentId: "self" },
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "code": "GRAPH_PARENT_CYCLE",
          "message": "item self participates in a parent cycle",
        },
      ]
    `)
  })

  test("accepts a valid graph with no diagnostics", () => {
    expect(validateGraph(graphFixture())).toEqual([])
  })
})
