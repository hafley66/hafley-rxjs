import { describe, expect, it } from "vitest"
import type { MarbleEvent } from "./0_types.js"
import { aggregateExtents, displayDuration, flameDepth, flameNodes } from "./1c_aggregate.js"

function event(id: string, start: number | null, duration: number | null, children?: MarbleEvent[]): MarbleEvent {
  return {
    id,
    name: `event ${id}`,
    method: "GET",
    status: 200,
    type: id.startsWith("child") ? "tool" : "request",
    initiator: "root",
    size: "1 kB",
    start,
    duration,
    from: "root",
    to: "peer",
    preview: `preview ${id}`,
    phases: [],
    children,
  }
}

describe("aggregateExtents", () => {
  it("spans both children when the parent carries no timing of its own", () => {
    const tree = [event("parent", null, null, [event("child-a", 100, 50), event("child-b", 400, 120)])]
    const extents = aggregateExtents(tree)
    expect(extents.get("parent")).toEqual({ id: "parent", depth: 0, start: 100, end: 520, duration: 420 })
    expect(extents.get("child-a")).toEqual({ id: "child-a", depth: 1, start: 100, end: 150, duration: 50 })
  })

  it("widens a parent whose own span is narrower than its subtree", () => {
    const tree = [event("parent", 200, 40, [event("child-a", 180, 20), event("child-b", 300, 90)])]
    expect(extents(tree, "parent")).toEqual({ start: 180, end: 390, duration: 210 })
  })

  it("keeps a parent's own span when it already contains the subtree", () => {
    const tree = [event("parent", 0, 1000, [event("child-a", 100, 20)])]
    expect(extents(tree, "parent")).toEqual({ start: 0, end: 1000, duration: 1000 })
  })

  it("carries grandchildren up through an untimed middle row", () => {
    const tree = [event("parent", null, null, [event("middle", null, null, [event("leaf", 700, 30)])])]
    expect(extents(tree, "parent")).toEqual({ start: 700, end: 730, duration: 30 })
    expect(aggregateExtents(tree).get("leaf")?.depth).toBe(2)
  })

  it("leaves an entirely untimed subtree null", () => {
    const tree = [event("parent", null, null, [event("child-a", null, null)])]
    expect(extents(tree, "parent")).toEqual({ start: null, end: null, duration: null })
  })

  it("treats a started row with no duration as a zero-width span", () => {
    expect(extents([event("solo", 40, null)], "solo")).toEqual({ start: 40, end: 40, duration: 0 })
  })
})

function extents(tree: MarbleEvent[], id: string) {
  const extent = aggregateExtents(tree).get(id)
  return extent && { start: extent.start, end: extent.end, duration: extent.duration }
}

describe("displayDuration", () => {
  it("falls back to the aggregate when own duration is null", () => {
    const tree = [event("parent", null, null, [event("child-a", 100, 50)])]
    expect(displayDuration(tree[0], aggregateExtents(tree).get("parent"))).toBe(50)
  })

  it("prefers the aggregate when it is wider than own duration", () => {
    const tree = [event("parent", 200, 40, [event("child-a", 300, 90)])]
    expect(displayDuration(tree[0], aggregateExtents(tree).get("parent"))).toBe(190)
  })

  it("keeps own duration when it already covers the subtree", () => {
    const tree = [event("parent", 0, 1000, [event("child-a", 100, 20)])]
    expect(displayDuration(tree[0], aggregateExtents(tree).get("parent"))).toBe(1000)
  })
})

describe("flameNodes", () => {
  it("emits one pre-order node per timed row with its tree depth", () => {
    const tree = [
      event("parent", null, null, [event("child-a", 100, 50), event("child-b", 400, 120)]),
      event("other", 900, 10),
    ]
    const nodes = flameNodes(tree)
    expect(nodes.map((node) => [node.id, node.depth, node.start, node.end])).toEqual([
      ["parent", 0, 100, 520],
      ["child-a", 1, 100, 150],
      ["child-b", 1, 400, 520],
      ["other", 0, 900, 910],
    ])
    expect(flameDepth(nodes)).toBe(2)
  })

  it("drops rows with no resolvable extent", () => {
    expect(flameNodes([event("ghost", null, null)])).toEqual([])
    expect(flameDepth([])).toBe(1)
  })
})
