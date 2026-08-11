import test from "node:test"
import assert from "node:assert/strict"
import { layoutGrid } from "../dist/2_layout.js"
import { generateFixture } from "../dist/5_fixtures.js"
test("layout is deterministic and degree ordered", () => {
  const graph = { nodeIds: ["a", "b", "c"], edges: [[0, 1], [0, 2]] }
  const params = { spacing: 10, margin: 5 }
  assert.deepEqual(Array.from(layoutGrid(3, graph.edges, params)), [5, 5, 15, 5, 5, 15])
  assert.deepEqual(layoutGrid(3, graph.edges, params), layoutGrid(3, graph.edges, params))
})
test("fixture generation is deterministic", () => {
  const first = generateFixture({ name: "fixture", nodes: 32, edges: 50, seed: 123 })
  const second = generateFixture({ name: "fixture", nodes: 32, edges: 50, seed: 123 })
  assert.deepEqual(first, second)
})
