import { describe, expect, it } from "vitest"

import {
  ancestorsOf,
  depthOf,
  descendantsOf,
  indexGraph,
  validateGraph,
  type Graph,
} from "./6_graph"

// Fixture covers every canonical shape: nested nodes (app > ui > button),
// a nested edge (flow), parallel edges (flow + flow2), a self edge (loop),
// an edge-to-edge edge (audit), and all three direction modes.
const fixture: Graph<{ label: string }> = {
  app: { id: "app", type: "node", data: { label: "app" } },
  ui: { id: "ui", type: "node", parentId: "app", data: { label: "ui" } },
  net: { id: "net", type: "node", parentId: "app", data: { label: "net" } },
  button: { id: "button", type: "node", parentId: "ui", data: { label: "button" } },
  flow: { id: "flow", type: "edge", parentId: "ui", fromId: "button", toId: "net", direction: "forward" },
  flow2: { id: "flow2", type: "edge", fromId: "button", toId: "net", direction: "both" },
  loop: { id: "loop", type: "edge", fromId: "net", toId: "net", direction: "forward" },
  audit: { id: "audit", type: "edge", fromId: "flow", toId: "app", direction: "none" },
}

describe("validateGraph", () => {
  it("accepts the fixture without diagnostics", () => {
    expect(validateGraph(fixture)).toEqual([])
  })

  it("reports every diagnostic class in deterministic order", () => {
    const broken: Graph = {
      "wrong-key": { id: "node", type: "node" },
      orphan: { id: "orphan", type: "node", parentId: "ghost" },
      dangling: { id: "dangling", type: "edge", fromId: "node", toId: "gone", direction: "forward" },
      cycA: { id: "cycA", type: "node", parentId: "cycB" },
      cycB: { id: "cycB", type: "node", parentId: "cycA" },
    }
    expect(validateGraph(broken)).toMatchInlineSnapshot(`
      [
        {
          "code": "GRAPH_KEY_ID_MISMATCH",
          "id": "node",
          "message": "record key wrong-key does not match item id node",
          "referenceId": "wrong-key",
        },
        {
          "code": "GRAPH_MISSING_EDGE_ENDPOINT",
          "id": "dangling",
          "message": "edge dangling references missing to endpoint gone",
          "referenceId": "gone",
        },
        {
          "code": "GRAPH_MISSING_EDGE_ENDPOINT",
          "id": "dangling",
          "message": "edge dangling references missing from endpoint node",
          "referenceId": "node",
        },
        {
          "code": "GRAPH_MISSING_PARENT",
          "id": "orphan",
          "message": "item orphan references missing parent ghost",
          "referenceId": "ghost",
        },
        {
          "code": "GRAPH_PARENT_CYCLE",
          "id": "cycA",
          "message": "item cycA reaches parent cycle at cycA",
          "referenceId": "cycA",
        },
        {
          "code": "GRAPH_PARENT_CYCLE",
          "id": "cycB",
          "message": "item cycB reaches parent cycle at cycB",
          "referenceId": "cycB",
        },
      ]
    `)
  })
})

describe("indexGraph", () => {
  it("derives containment and adjacency for every fixture shape", () => {
    expect(indexGraph(fixture)).toMatchInlineSnapshot(`
      {
        "childrenByParent": Map {
          "app" => [
            "net",
            "ui",
          ],
          "ui" => [
            "button",
            "flow",
          ],
        },
        "incidentByEndpoint": Map {
          "app" => [
            "audit",
          ],
          "button" => [
            "flow",
            "flow2",
          ],
          "flow" => [
            "audit",
          ],
          "net" => [
            "flow",
            "flow2",
            "loop",
          ],
        },
        "incomingByEndpoint": Map {
          "button" => [
            "flow2",
          ],
          "net" => [
            "flow",
            "flow2",
            "loop",
          ],
        },
        "outgoingByEndpoint": Map {
          "button" => [
            "flow",
            "flow2",
          ],
          "net" => [
            "flow2",
            "loop",
          ],
        },
      }
    `)
  })
})

describe("tree walks", () => {
  it("walks ancestors, descendants, and depth over parent nesting", () => {
    expect(ancestorsOf(fixture, "button")).toEqual(["ui", "app"])
    expect(ancestorsOf(fixture, "app")).toEqual([])
    expect(descendantsOf(fixture, "app")).toEqual(["net", "ui", "button", "flow"])
    expect(descendantsOf(fixture, "ui")).toEqual(["button", "flow"])
    expect(descendantsOf(fixture, "button")).toEqual([])
    expect(depthOf(fixture, "app")).toBe(0)
    expect(depthOf(fixture, "ui")).toBe(1)
    expect(depthOf(fixture, "button")).toBe(2)
    expect(depthOf(fixture, "loop")).toBe(0)
  })
})
