import { describe, expect, test } from "vitest"
import { indexGraph, validateGraph } from "@hafley66/grapht-model"
import { filesystemGraph } from "../../src/index.js"

describe("filesystem ingest", () => {
  test("builds a parent-linked tree from directory and file entries", () => {
    const graph = filesystemGraph([
      { path: "src", name: "src", isDirectory: true },
      { path: "src/index.ts", name: "index.ts", isDirectory: false },
      { path: "src/graph", name: "graph", isDirectory: true },
      { path: "src/graph/model.ts", name: "model.ts", isDirectory: false },
      { path: "README.md", name: "README.md", isDirectory: false },
    ])

    expect(graph).toMatchInlineSnapshot(`
      {
        "README.md": {
          "data": {
            "kind": "file",
            "name": "README.md",
            "path": "README.md",
          },
          "id": "README.md",
          "type": "node",
        },
        "src": {
          "data": {
            "kind": "directory",
            "name": "src",
            "path": "src",
          },
          "id": "src",
          "type": "node",
        },
        "src/graph": {
          "data": {
            "kind": "directory",
            "name": "graph",
            "path": "src/graph",
          },
          "id": "src/graph",
          "parentId": "src",
          "type": "node",
        },
        "src/graph/model.ts": {
          "data": {
            "kind": "file",
            "name": "model.ts",
            "path": "src/graph/model.ts",
          },
          "id": "src/graph/model.ts",
          "parentId": "src/graph",
          "type": "node",
        },
        "src/index.ts": {
          "data": {
            "kind": "file",
            "name": "index.ts",
            "path": "src/index.ts",
          },
          "id": "src/index.ts",
          "parentId": "src",
          "type": "node",
        },
      }
    `)
  })

  test("derives nesting depth and validity", () => {
    const graph = filesystemGraph([
      { path: "a", name: "a", isDirectory: true },
      { path: "a/b", name: "b", isDirectory: true },
      { path: "a/b/c.txt", name: "c.txt", isDirectory: false },
    ])

    expect({
      valid: validateGraph(graph),
      childrenByParent: Object.fromEntries(
        [...indexGraph(graph).childrenByParent].map(([key, value]) => [key, [...value]]),
      ),
    }).toMatchInlineSnapshot(`
      {
        "childrenByParent": {
          "a": [
            "a/b",
          ],
          "a/b": [
            "a/b/c.txt",
          ],
        },
        "valid": [],
      }
    `)
  })
})
