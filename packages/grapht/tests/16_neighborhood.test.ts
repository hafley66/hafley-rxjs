import { expect, test } from "vitest"
import { graphNeighborhood } from "../src/2_graph/16_neighborhood.js"
import { collapsedGraphIds, groupGraphItems } from "../src/2_graph/17_groupProjection.js"
import { sequenceNeighborhood } from "../src/2_graph/19_sequenceNeighborhood.js"
import type { Graph, SequenceGraph } from "@hafley66/grapht-model"

const graph: Graph = {
  a: { id: "a", type: "node" }, b: { id: "b", type: "node" }, c: { id: "c", type: "node" }, d: { id: "d", type: "node" },
  ab: { id: "ab", type: "edge", fromId: "a", toId: "b", direction: "forward" },
  ac: { id: "ac", type: "edge", fromId: "a", toId: "c", direction: "forward" },
  bd: { id: "bd", type: "edge", fromId: "b", toId: "d", direction: "forward" },
  da: { id: "da", type: "edge", fromId: "d", toId: "a", direction: "forward" },
}
test("direction, branching, cycles, and collapse retain source IDs", () => {
  const grouped = groupGraphItems(graph, "g", ["b", "c"], "Workers")
  expect({
    downstream: graphNeighborhood(graph, new Set(["a"]), { mode: "downstream", depth: 2 }),
    upstream: graphNeighborhood(graph, new Set(["a"]), { mode: "upstream", depth: 1 }),
    hidden: [...collapsedGraphIds(grouped, new Set(["g"]))].sort(),
    originalParent: graph.b.parentId ?? null,
  }).toMatchInlineSnapshot(`
    {
      "downstream": {
        "a": 0,
        "ab": 1,
        "ac": 1,
        "b": 1,
        "bd": 2,
        "c": 1,
        "d": 2,
      },
      "hidden": [
        "ab",
        "ac",
        "b",
        "bd",
        "c",
      ],
      "originalParent": null,
      "upstream": {
        "a": 0,
        "d": 1,
        "da": 1,
      },
    }
  `)
})
test("parallel messages receive equal hop distance before the join", () => {
  const seq = {
    ...graph,
    par: { id: "par", type: "node", data: { kind: "group", ordinal: 1, structuralKey: "par", branches: [["ac"], ["bd"]] } },
    ab: { ...graph.ab, data: { kind: "message", ordinal: 0 } },
    ac: { ...graph.ac, parentId: "par", data: { kind: "message", ordinal: 2 } },
    bd: { ...graph.bd, parentId: "par", data: { kind: "message", ordinal: 3 } },
    da: { ...graph.da, data: { kind: "message", ordinal: 4 } },
  } as SequenceGraph
  expect(sequenceNeighborhood(seq, new Set(["ab"]), { mode: "downstream", depth: 2 })).toMatchInlineSnapshot(`
    {
      "a": 0,
      "ab": 0,
      "ac": 1,
      "b": 0,
      "bd": 1,
      "c": 1,
      "d": 1,
      "da": 2,
      "par": 1,
    }
  `)
})

test("collapsed ownership components consume one hop across their members", () => {
  const grouped = groupGraphItems({ ...graph, bc: { id: "bc", type: "edge", fromId: "b", toId: "c", direction: "forward" } }, "g", ["b", "c"], "Workers")
  expect(graphNeighborhood(grouped, new Set(["a"]), { mode: "downstream", depth: 2, components: new Set(["g"]) })).toEqual({ a: 0, ab: 1, ac: 1, g: 1, bd: 2, d: 2, b: 1, c: 1, bc: 1 })
  expect(graphNeighborhood(grouped, new Set(["g"]), { mode: "downstream", depth: 1, components: new Set(["g"]) })).toEqual({ g: 0, bd: 1, d: 1, b: 0, c: 0, bc: 0 })
  const seq = {
    ...graph,
    g: { id: "g", type: "node", data: { kind: "group", ordinal: 1, structuralKey: "g" } },
    ab: { ...graph.ab, data: { kind: "message", ordinal: 0 } },
    ac: { ...graph.ac, parentId: "g", data: { kind: "message", ordinal: 2 } },
    bd: { ...graph.bd, parentId: "g", data: { kind: "message", ordinal: 3 } },
    da: { ...graph.da, data: { kind: "message", ordinal: 4 } },
  } as SequenceGraph
  const hops = sequenceNeighborhood(seq, new Set(["ab"]), { mode: "downstream", depth: 2, components: new Set(["g"]) })
  expect(hops).toEqual({ ab: 0, g: 1, da: 2, ac: 1, bd: 1, a: 0, b: 0, d: 1, c: 1 })
})
