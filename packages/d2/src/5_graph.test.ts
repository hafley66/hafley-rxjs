import { readFile } from "node:fs/promises"
import { indexGraph, validateGraph } from "@hafley66/grapht-model"
import { describe, expect, test } from "vitest"
import { parseD2Sequence } from "./1_parse"
import { d2Graph } from "./5_graph"

const fixtureDirectory = new URL("../../../fixtures/sequence/", import.meta.url)

function summary(graph: ReturnType<typeof d2Graph>) {
  return {
    valid: validateGraph(graph),
    items: Object.values(graph)
      .map(item =>
        item.type === "edge"
          ? {
              id: item.id,
              type: item.type,
              fromId: item.fromId,
              toId: item.toId,
              direction: item.direction,
              parentId: item.parentId,
            }
          : { id: item.id, type: item.type, kind: item.data?.kind, parentId: item.parentId },
      )
      .sort((left, right) => left.id.localeCompare(right.id)),
    childrenByParent: Object.fromEntries(
      [...indexGraph(graph).childrenByParent].map(([key, value]) => [key, [...value]]),
    ),
  }
}

describe("D2 sequence to canonical graph", () => {
  test("emits nodes for actors, groups, notes, activations and edges for messages", async () => {
    const source = await readFile(new URL("2_d2.d2", fixtureDirectory), "utf8")
    expect(summary(d2Graph(parseD2Sequence(source)))).toMatchInlineSnapshot(`
      {
        "childrenByParent": {
          "d2:49a15df1:group:nested review#1": [
            "d2:49a15df1:edge:alice->bob.work:repeat#3",
            "d2:49a15df1:edge:alice->bob.work:repeat#6",
            "d2:49a15df1:edge:bob.work->bob.work:inspect#4",
            "d2:49a15df1:note:bob:local note#5",
            "d2:49a15df1:span:bob.work#0",
          ],
          "d2:49a15df1:group:outer exchange#0": [
            "d2:49a15df1:group:nested review#1",
          ],
        },
        "items": [
          {
            "id": "d2:49a15df1:actor:alice#0",
            "kind": "actor",
            "parentId": undefined,
            "type": "node",
          },
          {
            "id": "d2:49a15df1:actor:archive#2",
            "kind": "actor",
            "parentId": undefined,
            "type": "node",
          },
          {
            "id": "d2:49a15df1:actor:bob#1",
            "kind": "actor",
            "parentId": undefined,
            "type": "node",
          },
          {
            "direction": "forward",
            "fromId": "d2:49a15df1:actor:alice#0",
            "id": "d2:49a15df1:edge:alice->bob.work:repeat#3",
            "parentId": "d2:49a15df1:group:nested review#1",
            "toId": "d2:49a15df1:actor:bob#1",
            "type": "edge",
          },
          {
            "direction": "forward",
            "fromId": "d2:49a15df1:actor:alice#0",
            "id": "d2:49a15df1:edge:alice->bob.work:repeat#6",
            "parentId": "d2:49a15df1:group:nested review#1",
            "toId": "d2:49a15df1:actor:bob#1",
            "type": "edge",
          },
          {
            "direction": "forward",
            "fromId": "d2:49a15df1:actor:bob#1",
            "id": "d2:49a15df1:edge:bob->archive:archive#7",
            "parentId": undefined,
            "toId": "d2:49a15df1:actor:archive#2",
            "type": "edge",
          },
          {
            "direction": "forward",
            "fromId": "d2:49a15df1:actor:bob#1",
            "id": "d2:49a15df1:edge:bob.work->bob.work:inspect#4",
            "parentId": "d2:49a15df1:group:nested review#1",
            "toId": "d2:49a15df1:actor:bob#1",
            "type": "edge",
          },
          {
            "id": "d2:49a15df1:group:nested review#1",
            "kind": "group",
            "parentId": "d2:49a15df1:group:outer exchange#0",
            "type": "node",
          },
          {
            "id": "d2:49a15df1:group:outer exchange#0",
            "kind": "group",
            "parentId": undefined,
            "type": "node",
          },
          {
            "id": "d2:49a15df1:note:bob:local note#5",
            "kind": "note",
            "parentId": "d2:49a15df1:group:nested review#1",
            "type": "node",
          },
          {
            "id": "d2:49a15df1:span:bob.work#0",
            "kind": "activation",
            "parentId": "d2:49a15df1:group:nested review#1",
            "type": "node",
          },
        ],
        "valid": [],
      }
    `)
  })
})
