import { describe, expect, test } from "vitest"
import { indexGraph, sequenceDocumentToGraph, validateGraph } from "../src/index.js"

const document = {
  language: "mermaid" as const,
  occurrences: [
    { id: "alice", kind: "actor" as const, ordinal: 0, structuralKey: "actor:alice", label: "Alice", authoredId: "alice" },
    { id: "bob", kind: "actor" as const, ordinal: 1, structuralKey: "actor:bob", label: "Bob" },
    { id: "group", kind: "group" as const, ordinal: 0, structuralKey: "group:root/g", label: "g" },
    {
      id: "msg1",
      kind: "message" as const,
      parentId: "group",
      ordinal: 1,
      structuralKey: "message:group/alice->bob",
      label: "hello",
    },
    { id: "activation", kind: "activation" as const, parentId: "group", ordinal: 2, structuralKey: "activation:bob", label: "activate" },
  ],
  relations: [
    { id: "r0", kind: "contains" as const, sourceId: "group", targetId: "msg1", ordinal: 0 },
    { id: "r1", kind: "message" as const, occurrenceId: "msg1", sourceId: "alice", targetId: "bob", ordinal: 1 },
    { id: "r2", kind: "activates" as const, sourceId: "activation", targetId: "bob", ordinal: 2 },
  ],
}

describe("sequence document to canonical graph", () => {
  test("lowers occurrences and relations into nodes and edges", () => {
    const graph = sequenceDocumentToGraph(document)
    expect(graph).toMatchInlineSnapshot(`
      {
        "activation": {
          "data": {
            "activationTarget": "bob",
            "kind": "activation",
            "label": "activate",
            "ordinal": 2,
            "structuralKey": "activation:bob",
          },
          "id": "activation",
          "parentId": "group",
          "type": "node",
        },
        "alice": {
          "data": {
            "authoredId": "alice",
            "kind": "actor",
            "label": "Alice",
            "ordinal": 0,
            "structuralKey": "actor:alice",
          },
          "id": "alice",
          "type": "node",
        },
        "bob": {
          "data": {
            "kind": "actor",
            "label": "Bob",
            "ordinal": 1,
            "structuralKey": "actor:bob",
          },
          "id": "bob",
          "type": "node",
        },
        "group": {
          "data": {
            "kind": "group",
            "label": "g",
            "ordinal": 0,
            "structuralKey": "group:root/g",
          },
          "id": "group",
          "type": "node",
        },
        "msg1": {
          "data": {
            "kind": "message",
            "label": "hello",
            "ordinal": 1,
          },
          "direction": "forward",
          "fromId": "alice",
          "id": "msg1",
          "parentId": "group",
          "toId": "bob",
          "type": "edge",
        },
      }
    `)
  })

  test("derives indexes from the lowered graph", () => {
    const graph = sequenceDocumentToGraph(document)
    const indexes = indexGraph(graph)
    expect({
      valid: validateGraph(graph),
      childrenByParent: Object.fromEntries(
        [...indexes.childrenByParent].map(([key, value]) => [key, [...value]]),
      ),
      outgoingByEndpoint: Object.fromEntries(
        [...indexes.outgoingByEndpoint].map(([key, value]) => [key, [...value]]),
      ),
      incomingByEndpoint: Object.fromEntries(
        [...indexes.incomingByEndpoint].map(([key, value]) => [key, [...value]]),
      ),
    }).toMatchInlineSnapshot(`
      {
        "childrenByParent": {
          "group": [
            "activation",
            "msg1",
          ],
        },
        "incomingByEndpoint": {
          "bob": [
            "msg1",
          ],
        },
        "outgoingByEndpoint": {
          "alice": [
            "msg1",
          ],
        },
        "valid": [],
      }
    `)
  })

  test("rejects a message occurrence without an endpoint relation", () => {
    expect(() => sequenceDocumentToGraph({ ...document, relations: [] })).toThrowErrorMatchingInlineSnapshot(
      `[Error: message occurrence msg1 has no message relation]`,
    )
  })
})
