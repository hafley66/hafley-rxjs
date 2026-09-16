// The board's own claims: identity is the address, a placement follows the prose, and nothing is
// moved silently. Every assertion here is about what a caller can observe — item ids, placements,
// what relocation reports — rather than about how the walk is written.
import { describe, expect, test } from "vitest"
import { type MdDocument, mdDocument } from "@hafley66/grapht-model"
import {
  type Board,
  type BoardBlockItem,
  type BoardItem,
  boardFromDocuments,
  foldMoves,
  type GraphFrame,
  parseBoard,
  placeItem,
  printBoard,
  reconcileBoard,
  validateBoard,
  withFence,
} from "../../src/index.js"

/** A frame is the one thing the board cannot build itself, so the tests build the smallest one. */
function frame(ids: readonly string[]): GraphFrame {
  return {
    graph: Object.fromEntries(ids.map(id => [id, { id, type: "node" as const }])),
    geometry: {
      revisionId: "geometry",
      boundsById: {},
      endpointAnchorById: {},
      routesById: {},
      headerBoundsById: {},
    },
    camera: { x: 0, y: 0, scale: 1, viewport: { x: 0, y: 0, width: 1, height: 1 } },
    presentation: {
      stickyHeaders: [],
      hiddenIds: new Set(),
      focusedIds: new Set(),
      labelsById: {},
      sealedSvgArtifactsByRootId: {},
    },
  }
}

const TEXT = [
  "# Board notes",
  "",
  "Intro paragraph with a [link](#usage).",
  "",
  "## Usage",
  "",
  "```mermaid",
  "sequenceDiagram",
  "  Alice->>Bob: hi",
  "```",
  "",
  "### Details",
  "",
  "Nested body text.",
].join("\n")

/** The same document with a paragraph inserted above the fence: block count changes, the fence moves. */
const INSERTED = (text: string): string => text.replace("## Usage\n", "## Usage\n\nAdded above the fence.\n")

const read = (text: string, path = "docs/example.md"): MdDocument => mdDocument(path, text)

const blockIdOfFence = (document: MdDocument): string =>
  document.blocks.find(block => block.language === "mermaid")?.id ?? ""

const isBlock = (item: BoardItem): item is BoardBlockItem => item.kind === "block"
const blocksOf = (board: Board): BoardBlockItem[] => board.items.filter(isBlock)

describe("board", () => {
  test("addresses every block by the locator its address derives", async () => {
    const document = read(TEXT)
    const board = await boardFromDocuments("b1", [document])

    expect(board.format).toBe("grapht-board/0")
    expect(board.items).toHaveLength(document.blocks.length)
    expect(blocksOf(board).every(item => item.itemId === item.address.locatorHash)).toBe(true)
    expect(board.sources.map(source => source.path)).toEqual(["docs/example.md"])
    // Nothing has been placed yet, and the board says so for every item rather than staying quiet.
    expect(validateBoard(board).map(anomaly => anomaly.kind)).toEqual(
      document.blocks.map(() => "item-without-placement"),
    )
  })

  test("keeps two documents' blocks apart, because the path is in the locator", async () => {
    const [first, second] = await Promise.all([
      boardFromDocuments("b1", [read(TEXT, "docs/a.md")]),
      boardFromDocuments("b1", [read(TEXT, "docs/b.md")]),
    ])
    const ids = new Set(first.items.map(item => item.itemId))
    expect(second.items.filter(item => ids.has(item.itemId))).toEqual([])
    expect(blocksOf(first).map(item => item.blockId)).toEqual(blocksOf(second).map(item => item.blockId))
  })

  test("gives a fence its frame without moving it, and refuses a block it does not hold", async () => {
    const document = read(TEXT)
    const blockId = blockIdOfFence(document)
    const projected = await boardFromDocuments("b1", [document])
    const item = blocksOf(projected).find(candidate => candidate.blockId === blockId)
    const placed = placeItem(projected, item?.itemId ?? "", { x: 40, y: 12, z: 2 })
    const boarded = withFence(placed, { blockId, frame: frame(["m1", "m2"]) })

    const promoted = boarded.items.find(candidate => candidate.kind === "fence")
    expect(promoted?.itemId).toBe(item?.itemId)
    if (promoted?.kind !== "fence") throw new Error("expected a fence item")
    expect(Object.keys(promoted.frame.graph)).toEqual(["m1", "m2"])
    expect(boarded.placements).toEqual([{ itemId: item?.itemId, x: 40, y: 12, z: 2 }])
    expect(() => withFence(boarded, { blockId: "usage/99", frame: frame(["x"]) })).toThrow(/no block usage\/99/)
  })

  test("folds the movement journal into placements, cursor included", async () => {
    const document = read(TEXT)
    const start = await boardFromDocuments("b1", [document])
    const fence = blocksOf(start).find(item => item.blockId === blockIdOfFence(document))
    const paragraph = document.blocks.find(block => document.text.slice(block.span.start, block.span.end) === "Nested body text.")
    const text = blocksOf(start).find(item => item.blockId === paragraph?.id)
    if (!fence || !text || fence.itemId === text.itemId) throw new Error("fixture changed")
    const placed = placeItem(placeItem(start, fence.itemId, { x: 100, y: 100 }), text.itemId, { x: 10, y: 10 })

    const events = [
      { id: fence.itemId, dx: 30, dy: 0 },
      { id: text.itemId, dx: 0, dy: -5 },
    ]
    const at = (cursor: number) => foldMoves(placed, { events, cursor }).placements
    expect(at(0)).toEqual(placed.placements)
    expect(at(1).find(p => p.itemId === fence.itemId)?.x).toBe(130)
    expect(at(2).find(p => p.itemId === text.itemId)?.y).toBe(5)
    // The journal's cursor is a prefix length, so an undone gesture un-moves the board.
    expect(at(3)).toEqual(at(2))
    expect(at(1).find(p => p.itemId === text.itemId)?.y).toBe(10)
  })

  test("carries a placement onto the new address when the document is edited above it", async () => {
    const before = read(TEXT)
    const fenceId = blockIdOfFence(before)
    const projected = await boardFromDocuments("b1", [before])
    const fence = blocksOf(projected).find(item => item.blockId === fenceId)
    if (!fence) throw new Error("fixture changed")
    const placed = placeItem(projected, fence.itemId, { x: 7, y: 9, z: 1 })

    const after = read(INSERTED(TEXT))
    const { board, moved, orphaned } = await reconcileBoard(placed, [after])

    expect(orphaned).toEqual([])
    expect(moved).toHaveLength(1)
    const relocated = moved[0]
    expect(relocated?.from).toBe(fence.itemId)
    expect(relocated?.to).not.toBe(fence.itemId)
    // The fence's own bytes are untouched, so the item keeps its place at its new id.
    expect(board.placements).toEqual([{ itemId: relocated?.to, x: 7, y: 9, z: 1 }])
    expect(board.sources[0]?.docHash).not.toBe(placed.sources[0]?.docHash)
    // Only the fence was placed, so that is the one item the board must not complain about.
    expect(validateBoard(board).filter(anomaly => anomaly.detail === relocated?.to)).toEqual([])
  })

  test("reports an orphan instead of moving it", async () => {
    const before = read(TEXT)
    const projected = await boardFromDocuments("b1", [before])
    const paragraph = before.blocks.find(block => before.text.slice(block.span.start, block.span.end) === "Nested body text.")
    const placedItem = blocksOf(projected).find(item => item.blockId === paragraph?.id)
    if (!paragraph || !placedItem) throw new Error("fixture changed")
    const placed = placeItem(projected, placedItem.itemId, { x: 1, y: 2, z: 0 })

    // The placed paragraph's own text changes, so no block in the next revision carries its hash.
    const after = read(TEXT.replace("Nested body text.", "Rewritten body text."))
    const { board, orphaned } = await reconcileBoard(placed, [after])

    expect(orphaned.map(orphan => orphan.reason)).toEqual(["missing"])
    expect(orphaned[0]?.item.itemId).toBe(placedItem.itemId)
    expect(board.items.some(item => item.itemId === placedItem.itemId)).toBe(false)
    expect(board.placements).toEqual([])
    // Everything else in the document survives, at the place it already had.
    expect(board.items).toHaveLength(projected.items.length - 1)
  })

  test("names what is wrong with a board", async () => {
    const board = await boardFromDocuments("b1", [read(TEXT)])
    const first = board.items[0]
    if (!first) throw new Error("fixture changed")

    expect(
      validateBoard({
        ...board,
        sources: [...board.sources, ...board.sources],
        placements: [
          { itemId: first.itemId, x: 0, y: 0, z: 0 },
          { itemId: first.itemId, x: 1, y: 0, z: 0 },
          { itemId: "not-an-item", x: 0, y: 0, z: 0 },
        ],
      })
        .filter(anomaly => anomaly.kind !== "item-without-placement")
        .map(anomaly => anomaly.kind)
        .sort(),
    ).toEqual(["duplicate-placement", "duplicate-source", "placement-without-item"].sort())
  })

  test("reads back what it printed, and refuses anything else", async () => {
    const board = await boardFromDocuments("b1", [read(TEXT)])
    expect(parseBoard(printBoard(board))).toEqual(board)
    expect(() => parseBoard(JSON.stringify({ format: "grapht-board/1", id: "x" }))).toThrow(
      /not a grapht-board\/0 board: grapht-board\/1/,
    )
  })
})