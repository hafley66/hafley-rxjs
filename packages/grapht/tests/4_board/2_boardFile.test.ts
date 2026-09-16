// The board on disk: the path rule, a round trip that keeps the movements, and the two refusals —
// a file that is not a board, and a board whose own validation fails. Every refusal names the path,
// because that is what a caller holds when a reload goes wrong.
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "vitest"
import { type MdDocument, mdDocument } from "@hafley66/grapht-model"
import {
  type Board,
  boardFromDocuments,
  boardPathFor,
  foldMoves,
  type GraphFrame,
  placeItem,
  printBoard,
  readBoardFile,
  validateBoard,
  withFence,
  writeBoardFile,
} from "../../src/index.js"

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

/**
 * The smallest frame a fence can carry. A fence's frame is the host's; this one exists so the board
 * has a fence item to persist, not to model a rendering.
 */
const fenceFrame = (): GraphFrame => ({
  graph: { part: { id: "part", type: "node" } },
  geometry: { revisionId: "fence", boundsById: {}, endpointAnchorById: {}, routesById: {}, headerBoundsById: {} },
  camera: { x: 0, y: 0, scale: 1, viewport: { x: 0, y: 0, width: 1, height: 1 } },
  presentation: { stickyHeaders: [], hiddenIds: new Set(), focusedIds: new Set(), labelsById: {}, sealedSvgArtifactsByRootId: {} },
})

/** A temp directory per test, gone whether the test passed or failed. */
async function inTempDirectory<T>(run: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "grapht-board-"))
  try {
    return await run(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

const read = (path: string, text: string): MdDocument => mdDocument(path, text)

/** Every item of a board placed on one row, so a reload has positions to lose. */
const placedInARow = (board: Board): Board =>
  board.items.reduce((next, item, index) => placeItem(next, item.itemId, { x: index * 200, y: 0 }), board)

/** A board whose items were placed and then moved, with and without the document's fence promoted. */
async function movedBoard(document: MdDocument, fenced = false): Promise<Board> {
  const projected = await boardFromDocuments("board-1", [document])
  const fenceId = document.blocks.find(block => block.language === "mermaid")?.id
  const built = !fenced || fenceId === undefined ? projected : withFence(projected, { blockId: fenceId, frame: fenceFrame() })
  const first = built.items[0]
  if (!first) throw new Error("the fixture document produced no board items")
  return foldMoves(placedInARow(built), { events: [{ id: first.itemId, dx: 32, dy: -8 }], cursor: 1 })
}

/** The message a refusal carries, so the test can read what the caller would read. */
function refusalOf(path: string): string {
  try {
    readBoardFile(path)
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  throw new Error(`readBoardFile accepted ${path}`)
}

test("derives the board path as the document's sibling", () => {
  expect(boardPathFor("docs/example.md")).toBe("docs/example.md.board.json")
  expect(boardPathFor("docs/plans/2026-09-15.md")).toBe("docs/plans/2026-09-15.md.board.json")
})

test("round-trips a moved board through disk", async () => {
  await inTempDirectory(async directory => {
    const documentPath = join(directory, "example.md")
    const board = await movedBoard(read(documentPath, TEXT))
    const path = boardPathFor(documentPath)

    writeBoardFile(path, board)
    const reloaded = readBoardFile(path)

    expect(reloaded).toEqual(board)
    expect(validateBoard(reloaded)).toEqual([])
    expect(reloaded.placements.length).toBe(board.items.length)
    expect(await readFile(path, "utf8")).toBe(printBoard(board))
    // The temp file that carries the write is renamed away, not left beside the document.
    expect(await readdir(directory)).toEqual(["example.md.board.json"])
  })
})

test("reloads a board that holds a fence, positions and all", async () => {
  await inTempDirectory(async directory => {
    const documentPath = join(directory, "example.md")
    const board = await movedBoard(read(documentPath, TEXT), true)
    const path = boardPathFor(documentPath)
    expect(board.items.some(item => item.kind === "fence")).toBe(true)

    writeBoardFile(path, board)
    const reloaded = readBoardFile(path)

    // What a reload promises is the board's own content: the same items, and the same places the
    // gestures left them in. What a fence's frame contains is the host's business.
    expect(reloaded.items.map(item => [item.kind, item.itemId])).toEqual(board.items.map(item => [item.kind, item.itemId]))
    expect(reloaded.placements).toEqual(board.placements)
    expect(validateBoard(reloaded)).toEqual([])
  })
})

test("refuses a file that is not a board", async () => {
  await inTempDirectory(async directory => {
    const broken = join(directory, "broken.board.json")
    await writeFile(broken, "{ not json at all", "utf8")
    expect(refusalOf(broken)).toContain(broken)

    const foreign = join(directory, "foreign.board.json")
    await writeFile(foreign, JSON.stringify({ format: "grapht-board/1" }), "utf8")
    const refusal = refusalOf(foreign)
    expect(refusal).toContain(foreign)
    expect(refusal).toContain("grapht-board/1")
  })
})

test("reads a board nobody has gestured, and refuses one that is actually wrong", async () => {
  await inTempDirectory(async directory => {
    const documentPath = join(directory, "example.md")
    const board = await boardFromDocuments("board-1", [read(documentPath, TEXT)])
    const path = boardPathFor(documentPath)

    // An item with no placement is a young board, not a broken one: it still reads back.
    await writeFile(path, printBoard(board), "utf8")
    expect(readBoardFile(path)).toEqual(board)

    // A placement for an item the board does not hold is broken, and says so by name.
    const wrong = { ...board, placements: [{ itemId: "not-an-item", x: 0, y: 0, z: 0 }] }
    await writeFile(path, printBoard(wrong), "utf8")
    const refusal = refusalOf(path)
    expect(refusal).toContain(path)
    expect(refusal).toContain("placement-without-item not-an-item")
  })
})