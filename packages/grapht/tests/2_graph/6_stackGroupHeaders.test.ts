import { describe, expect, test } from "vitest"
import type { Graph } from "@hafley66/grapht-model"
import { stackGroupHeaders, type GraphCamera } from "../../src/index.js"

function headerGraph(): Graph {
  return {
    outer: { id: "outer", type: "node" },
    inner: { id: "inner", type: "node", parentId: "outer" },
    sibling: { id: "sibling", type: "node" },
    deeper: { id: "deeper", type: "node", parentId: "inner" },
  }
}

const camera = (overrides: Partial<GraphCamera> = {}): GraphCamera => ({
  x: 0,
  y: 0,
  scale: 1,
  viewport: { x: 0, y: 0, width: 800, height: 600 },
  ...overrides,
})

describe("stackGroupHeaders", () => {
  test("places root headers relative to the viewport origin", () => {
    const [placement] = stackGroupHeaders({
      graph: headerGraph(),
      camera: camera({ viewport: { x: 10, y: 40, width: 800, height: 600 } }),
      inset: 8,
      gap: 4,
      headers: [{ id: "outer", naturalTop: 0, boundaryBottom: 300, height: 20, order: 0 }],
    })

    expect(placement).toMatchInlineSnapshot(`
      {
        "depth": 0,
        "id": "outer",
        "state": "stuck",
        "top": 48,
        "visible": true,
      }
    `)
  })

  test("stacks nested headers below active ancestors and keeps siblings natural", () => {
    expect(
      stackGroupHeaders({
        graph: headerGraph(),
        camera: camera(),
        inset: 80,
        gap: 4,
        headers: [
          { id: "outer", naturalTop: 0, boundaryBottom: 300, height: 20, order: 0 },
          { id: "inner", naturalTop: 30, boundaryBottom: 200, height: 18, order: 0 },
          { id: "sibling", naturalTop: 250, boundaryBottom: 500, height: 20, order: 1 },
        ],
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "depth": 0,
          "id": "outer",
          "state": "stuck",
          "top": 80,
          "visible": true,
        },
        {
          "depth": 0,
          "id": "sibling",
          "state": "natural",
          "top": 250,
          "visible": true,
        },
        {
          "depth": 1,
          "id": "inner",
          "state": "stuck",
          "top": 104,
          "visible": true,
        },
      ]
    `)
  })

  test("releases a header once its group boundary passes its slot", () => {
    expect(
      stackGroupHeaders({
        graph: headerGraph(),
        camera: camera({ y: -250 }),
        inset: 80,
        gap: 4,
        headers: [
          { id: "outer", naturalTop: 0, boundaryBottom: 300, height: 20, order: 0 },
          { id: "inner", naturalTop: 30, boundaryBottom: 200, height: 18, order: 0 },
        ],
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "depth": 0,
          "id": "outer",
          "state": "released",
          "top": -250,
          "visible": false,
        },
        {
          "depth": 1,
          "id": "inner",
          "state": "released",
          "top": -220,
          "visible": false,
        },
      ]
    `)
  })

  test("replaces one sibling with the next by interval and order", () => {
    expect(
      stackGroupHeaders({
        graph: { a: { id: "a", type: "node" }, b: { id: "b", type: "node" } },
        camera: camera({ y: -250 }),
        inset: 80,
        gap: 4,
        headers: [
          { id: "a", naturalTop: 0, boundaryBottom: 200, height: 20, order: 0 },
          { id: "b", naturalTop: 250, boundaryBottom: 500, height: 20, order: 1 },
        ],
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "depth": 0,
          "id": "a",
          "state": "released",
          "top": -250,
          "visible": false,
        },
        {
          "depth": 0,
          "id": "b",
          "state": "stuck",
          "top": 80,
          "visible": true,
        },
      ]
    `)
  })

  test("scales natural positions and heights by camera zoom", () => {
    expect(
      stackGroupHeaders({
        graph: headerGraph(),
        camera: camera({ scale: 2 }),
        inset: 80,
        gap: 4,
        headers: [
          { id: "outer", naturalTop: 0, boundaryBottom: 300, height: 20, order: 0 },
          { id: "inner", naturalTop: 30, boundaryBottom: 200, height: 18, order: 0 },
        ],
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "depth": 0,
          "id": "outer",
          "state": "stuck",
          "top": 80,
          "visible": true,
        },
        {
          "depth": 1,
          "id": "inner",
          "state": "stuck",
          "top": 124,
          "visible": true,
        },
      ]
    `)
  })

  test("keeps a child natural while its ancestor has not stuck", () => {
    expect(
      stackGroupHeaders({
        graph: headerGraph(),
        camera: camera(),
        inset: 80,
        gap: 4,
        headers: [
          { id: "outer", naturalTop: 120, boundaryBottom: 300, height: 20, order: 0 },
          { id: "inner", naturalTop: 140, boundaryBottom: 260, height: 18, order: 0 },
        ],
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "depth": 0,
          "id": "outer",
          "state": "natural",
          "top": 120,
          "visible": true,
        },
        {
          "depth": 1,
          "id": "inner",
          "state": "natural",
          "top": 140,
          "visible": true,
        },
      ]
    `)
  })

  test("does not borrow a sticky slot from an unrelated sibling ancestor", () => {
    expect(
      stackGroupHeaders({
        graph: {
          outer: { id: "outer", type: "node" },
          sibling: { id: "sibling", type: "node" },
          siblingChild: { id: "siblingChild", type: "node", parentId: "sibling" },
        },
        camera: camera(),
        inset: 80,
        gap: 4,
        headers: [
          { id: "outer", naturalTop: 0, boundaryBottom: 400, height: 20, order: 0 },
          { id: "sibling", naturalTop: 120, boundaryBottom: 400, height: 20, order: 1 },
          { id: "siblingChild", naturalTop: 50, boundaryBottom: 300, height: 18, order: 0 },
        ],
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "depth": 0,
          "id": "outer",
          "state": "stuck",
          "top": 80,
          "visible": true,
        },
        {
          "depth": 0,
          "id": "sibling",
          "state": "natural",
          "top": 120,
          "visible": true,
        },
        {
          "depth": 1,
          "id": "siblingChild",
          "state": "natural",
          "top": 50,
          "visible": true,
        },
      ]
    `)
  })

  test("releases a replaced sibling and its nested header", () => {
    expect(
      stackGroupHeaders({
        graph: {
          first: { id: "first", type: "node" },
          firstChild: { id: "firstChild", type: "node", parentId: "first" },
          second: { id: "second", type: "node" },
          secondChild: { id: "secondChild", type: "node", parentId: "second" },
        },
        camera: camera(),
        inset: 80,
        gap: 4,
        headers: [
          { id: "first", naturalTop: 0, boundaryBottom: 400, height: 20, order: 0 },
          { id: "firstChild", naturalTop: 10, boundaryBottom: 300, height: 18, order: 0 },
          { id: "second", naturalTop: 0, boundaryBottom: 400, height: 20, order: 1 },
          { id: "secondChild", naturalTop: 10, boundaryBottom: 300, height: 18, order: 0 },
        ],
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "depth": 0,
          "id": "first",
          "state": "released",
          "top": 0,
          "visible": false,
        },
        {
          "depth": 0,
          "id": "second",
          "state": "stuck",
          "top": 80,
          "visible": true,
        },
        {
          "depth": 1,
          "id": "firstChild",
          "state": "released",
          "top": 10,
          "visible": false,
        },
        {
          "depth": 1,
          "id": "secondChild",
          "state": "stuck",
          "top": 104,
          "visible": true,
        },
      ]
    `)
  })
})
