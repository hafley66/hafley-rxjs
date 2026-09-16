// What a caller can see of a drawn board: which nodes exist, what data rides on them, where they
// land, what the camera did, and whether the geometry revision answers "did anything move?".
//
// The layout rule for items nobody placed is asserted as an observable — where they land, in what
// order, without overlapping — rather than by pinning the arithmetic that picks the place.
import { describe, expect, test } from "vitest"
import { type Board, BOARD_FORMAT, boardFrame, type BoardFrameOptions, type BoardItem, type BoardPlacement, type GraphFrame } from "../../src/index.js"

const VIEWPORT = { width: 400, height: 300 }
const SIZE = { width: 120, height: 40 }

/** A board nobody has gestured: items, and no placements at all. */
const board = (items: readonly BoardItem[], placements: readonly BoardPlacement[] = []): Board => ({
  format: BOARD_FORMAT,
  id: "board-1",
  sources: [],
  items,
  placements,
})

const sticky = (itemId: string, text = itemId): BoardItem => ({ kind: "sticky", itemId, text })

const options = (overrides: Partial<BoardFrameOptions> = {}): BoardFrameOptions => ({
  size: item => (item.kind === "sticky" ? { ...SIZE, label: item.text } : SIZE),
  viewport: VIEWPORT,
  ...overrides,
})

const boundsOf = (frame: GraphFrame<BoardItem>, itemId: string) => frame.geometry.boundsById[itemId]

describe("boardFrame", () => {
  test("draws one node per item, each carrying the item itself", () => {
    const items = [sticky("a"), sticky("b")]
    const frame = boardFrame(board(items), options())

    expect(Object.keys(frame.graph)).toEqual(["a", "b"])
    expect(frame.graph["a"]?.type).toBe("node")
    expect(frame.graph["a"]?.data).toBe(items[0])
    expect(frame.graph["b"]?.data).toBe(items[1])
    // A board has no links of its own: `markdownGraph` owns those, so no routes exist to paint.
    expect(frame.geometry.routesById).toEqual({})
    expect(frame.geometry.endpointAnchorById).toEqual({})
  })

  test("takes an item's bounds from its placement", () => {
    const frame = boardFrame(board([sticky("a")], [{ itemId: "a", x: 40, y: 25, z: 3 }]), options())

    expect(boundsOf(frame, "a")).toEqual({ x: 40, y: 25, width: 120, height: 40 })
  })

  test("still draws a board nobody has gestured, stacking items in board order", () => {
    const frame = boardFrame(board([sticky("a"), sticky("b"), sticky("c")]), options())
    const first = boundsOf(frame, "a")
    const second = boundsOf(frame, "b")
    const third = boundsOf(frame, "c")

    expect(Object.keys(frame.geometry.boundsById)).toEqual(["a", "b", "c"])
    expect(first.y).toBe(0)
    for (const [above, below] of [
      [first, second],
      [second, third],
    ] as const) {
      expect(below.y).toBeGreaterThanOrEqual(above.y + above.height)
    }
    expect(frame.camera.scale).toBeGreaterThan(0)
  })

  test("labels an item only when the size function measured one", () => {
    const labelled = boardFrame(board([sticky("a", "Alpha")]), options())
    const bare = boardFrame(board([sticky("a")]), options({ size: () => SIZE }))

    expect(labelled.presentation.labelsById).toEqual({ a: { text: "Alpha" } })
    expect(bare.presentation.labelsById).toEqual({})
  })

  test("holds the geometry revision still until the geometry moves", () => {
    const items = [sticky("a"), sticky("b")]
    const placed = board(items, [{ itemId: "a", x: 0, y: 0, z: 0 }])
    const revision = boardFrame(placed, options()).geometry.revisionId

    expect(boardFrame(placed, options()).geometry.revisionId).toBe(revision)
    // The board did not move, so the geometry revision answers for the board, not the window.
    expect(boardFrame(placed, options({ viewport: { width: 1000, height: 800 } })).geometry.revisionId).toBe(revision)
    expect(boardFrame(board(items, [{ itemId: "a", x: 10, y: 0, z: 0 }]), options()).geometry.revisionId).not.toBe(
      revision,
    )
  })

  test("fits the board's bounds into the viewport", () => {
    const frame = boardFrame(board([sticky("a")], [{ itemId: "a", x: 0, y: 0, z: 0 }]), options())
    const bounds = boundsOf(frame, "a")

    expect(frame.camera.viewport).toEqual({ x: 0, y: 0, width: 400, height: 300 })
    expect(frame.camera.scale).toBeGreaterThan(0)
    expect(frame.camera.x + (bounds.x + bounds.width / 2) * frame.camera.scale).toBeCloseTo(VIEWPORT.width / 2)
    expect(frame.camera.y + (bounds.y + bounds.height / 2) * frame.camera.scale).toBeCloseTo(VIEWPORT.height / 2)
  })
})