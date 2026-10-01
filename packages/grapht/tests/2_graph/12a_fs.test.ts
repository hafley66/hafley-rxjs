import { expect, test } from "vitest"
import { firstValueFrom, of } from "rxjs"
import type { Graph } from "@hafley66/grapht-model"
import { layout } from "../../src/2_graph/9_operators.ts"
import { FS } from "../../src/2_graph/12a_fs.ts"
import { zigzag } from "../../src/2_graph/12b_zigzag.ts"

const graph: Graph = {
  a: { id: "a", type: "node" },
  b: { id: "b", type: "node" },
  c: { id: "c", type: "node" },
  d: { id: "d", type: "node" },
  e: { id: "e", type: "node" },
  ab: { id: "ab", type: "edge", fromId: "a", toId: "b", direction: "forward" },
  ac: { id: "ac", type: "edge", fromId: "a", toId: "c", direction: "forward" },
  ca: { id: "ca", type: "edge", fromId: "c", toId: "a", direction: "forward" },
}
const hints = { entrypoints: ["a"], order: ["c", "b"], symlinks: ["ca"] }

test("FS pipes through grapht: ordered traversal, cycle cross-link, disconnected roots", async () => {
  const result = await firstValueFrom(of(graph).pipe(layout(FS(hints))))
  expect(Object.entries(result.geometry.boundsById).map(([id, b]) => [id, b.x, b.y])).toMatchInlineSnapshot(`
    [
      [
        "a",
        24,
        24,
      ],
      [
        "c",
        56,
        64,
      ],
      [
        "b",
        56,
        104,
      ],
      [
        "d",
        24,
        144,
      ],
      [
        "e",
        24,
        184,
      ],
    ]
  `)
  expect(Object.keys(result.geometry.routesById).sort()).toEqual(["ab", "ac", "ca"])
  expect(result.graph).toBe(graph)
  expect(FS({ ...hints, symlinks: [] })(graph, new AbortController().signal).boundsById).toEqual(result.geometry.boundsById)
})

test("zigzag bounces right then left with equal x/y steps", () => {
  const geometry = zigzag(hints)(graph, new AbortController().signal)
  expect(Object.values(geometry.boundsById).map(b => [b.x, b.y])).toMatchInlineSnapshot(`
    [
      [
        24,
        24,
      ],
      [
        184,
        184,
      ],
      [
        344,
        344,
      ],
      [
        184,
        504,
      ],
      [
        24,
        664,
      ],
    ]
  `)
  expect([...geometry.routesById.ca]).toEqual([256, 198, 528, 198, 528, 38, 96, 38])
})

test("containment wins over symlinks; aborts and invalid inputs fail explicitly", () => {
  const fs = FS({ entrypoints: ["a"], symlinks: ["ac"] })
  const contained = { ...graph, b: { ...graph.b, parentId: "a" } }
  expect(fs(contained, new AbortController().signal).boundsById.b.x).toBe(56)
  expect(() => fs(graph, AbortSignal.abort(new Error("cancelled")))).toThrow("cancelled")
  expect(() => FS({ entrypoints: ["missing"] })(graph, new AbortController().signal)).toThrow("Unknown FS entrypoint")
  expect(() => zigzag({ columns: 1 })).toThrow("columns")
})

test("zigzag preserves traversal order for integer-like IDs", () => {
  const geometry = zigzag({ entrypoints: ["10"], order: ["10", "2"] })({
    "2": { id: "2", type: "node" }, "10": { id: "10", type: "node" },
  }, new AbortController().signal)
  expect([geometry.boundsById["10"].y, geometry.boundsById["2"].y]).toEqual([24, 184])
})
