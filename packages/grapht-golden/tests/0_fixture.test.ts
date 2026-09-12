import { validateGraph } from "@hafley66/grapht-model"
import { describe, expect, test } from "vitest"
import { goldenGraph } from "../src/0_fixture.js"

describe("golden graph fixture", () => {
  test("contains the canonical nested and edge coverage", () => {
    expect(validateGraph(goldenGraph)).toEqual([])
    expect(goldenGraph["parse-flow"].direction).toBe("forward")
    expect(goldenGraph["shared-shape"].direction).toBe("none")
    expect(goldenGraph["renderer-sync"].direction).toBe("both")
    expect(goldenGraph["renderer-sync-2"].fromId).toBe("canonical")
    expect(goldenGraph["edge-to-edge"]).toMatchObject({ fromId: "parse-flow", toId: "renderer-sync" })
    expect(
      Object.fromEntries(
        Object.values(goldenGraph)
          .filter(item => item.type === "edge")
          .map(item => [item.id, item.parentId]),
      ),
    ).toMatchInlineSnapshot(`
      {
        "edge-to-edge": "platform",
        "feedback-flow": "platform",
        "parse-flow": "platform",
        "renderer-sync": "platform",
        "renderer-sync-2": "platform",
        "shared-shape": "platform",
      }
    `)
    expect(goldenGraph.parsers.parentId).toBe("ingestion")
    expect(goldenGraph.ingestion.parentId).toBe("platform")
  })
})
