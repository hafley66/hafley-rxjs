import { readFile } from "node:fs/promises"
import { indexGraph, validateGraph } from "@hafley66/grapht-model"
import { describe, expect, test } from "vitest"
import { parseMermaidSequence } from "./1_parse"
import { mermaidGraph } from "./5_graph"

const fixtureDirectory = new URL("../../../fixtures/sequence/", import.meta.url)

function summary(graph: ReturnType<typeof mermaidGraph>) {
  return {
    valid: validateGraph(graph),
    kinds: Object.values(graph)
      .map(item => (item.type === "edge" ? "edge" : item.data?.kind))
      .sort(),
    edges: Object.values(graph)
      .filter((item): item is Extract<typeof item, { type: "edge" }> => item.type === "edge")
      .map(item => ({ id: item.id, fromId: item.fromId, toId: item.toId, direction: item.direction }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    childrenByParent: Object.fromEntries(
      [...indexGraph(graph).childrenByParent].map(([key, value]) => [key, [...value]]),
    ),
  }
}

describe("Mermaid sequence to canonical graph", () => {
  test("emits nodes for participants, groups, notes, activations and edges for messages", async () => {
    const source = await readFile(new URL("0_mermaid.mmd", fixtureDirectory), "utf8")
    expect(summary(mermaidGraph(parseMermaidSequence(source)))).toMatchInlineSnapshot(`
      {
        "childrenByParent": {
          "mermaid:092e83e2:group:alt:nested review#1": [
            "mermaid:092e83e2:activation:activate:bob#3",
            "mermaid:092e83e2:activation:deactivate:bob#7",
            "mermaid:092e83e2:message:alice->>bob:repeat#2",
            "mermaid:092e83e2:message:alice->>bob:repeat#6",
            "mermaid:092e83e2:message:bob->>bob:inspect#4",
            "mermaid:092e83e2:note:right of:bob:local note#5",
          ],
          "mermaid:092e83e2:group:loop:outer exchange#0": [
            "mermaid:092e83e2:group:alt:nested review#1",
          ],
        },
        "edges": [
          {
            "direction": "forward",
            "fromId": "mermaid:092e83e2:participant:alice#0",
            "id": "mermaid:092e83e2:message:alice->>bob:repeat#2",
            "toId": "mermaid:092e83e2:participant:bob#1",
          },
          {
            "direction": "forward",
            "fromId": "mermaid:092e83e2:participant:alice#0",
            "id": "mermaid:092e83e2:message:alice->>bob:repeat#6",
            "toId": "mermaid:092e83e2:participant:bob#1",
          },
          {
            "direction": "forward",
            "fromId": "mermaid:092e83e2:participant:bob#1",
            "id": "mermaid:092e83e2:message:bob->>archive:archive#8",
            "toId": "mermaid:092e83e2:participant:archive#2",
          },
          {
            "direction": "forward",
            "fromId": "mermaid:092e83e2:participant:bob#1",
            "id": "mermaid:092e83e2:message:bob->>bob:inspect#4",
            "toId": "mermaid:092e83e2:participant:bob#1",
          },
        ],
        "kinds": [
          "activation",
          "activation",
          "actor",
          "actor",
          "actor",
          "edge",
          "edge",
          "edge",
          "edge",
          "group",
          "group",
          "note",
        ],
        "valid": [],
      }
    `)
  })
})
