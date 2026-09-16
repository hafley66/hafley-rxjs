// What the board and message work looks like when you run it, end to end, through the built package.
// This is the acceptance for phases 4, 6 and 7 in one pass: a document becomes a board, items are
// placed and moved, the board survives a write and a read and an edit above what was pinned, a
// message is written against a revision, and grapht-doc-history names the commit that resolved it.
//
// It runs against `dist`, so it tests what the package ships, not what the test files import.
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { mdDocument } from "@hafley66/grapht-model"
import {
  boardFromDocuments,
  foldMoves,
  messagesToJsonl,
  parseBoard,
  placeItem,
  printBoard,
  readBoardFile,
  reconcileBoard,
  validateBoard,
  withFence,
  withMessageId,
  writeBoardFile,
} from "../dist/index.js"
import { docHistoryMain } from "../dist/7_docHistory/2_cli.js"

const say = (label, value) => console.log(`  ${label}: ${value}`)

const TEXT = [
  "# Release notes",
  "",
  "The fence below is the thing we pinned.",
  "",
  "```mermaid",
  "sequenceDiagram",
  "  Alice->>Bob: ship it",
  "```",
  "",
  "## Later",
  "",
  "A paragraph someone will ask about.",
  "",
].join("\n")

/** The smallest frame a fence can carry; grapht does not parse mermaid, the host hands the frame in. */
const frame = ids => ({
  graph: Object.fromEntries(ids.map(id => [id, { id, type: "node" }])),
  geometry: { revisionId: "geometry", boundsById: {}, endpointAnchorById: {}, routesById: {}, headerBoundsById: {} },
  camera: { x: 0, y: 0, scale: 1, viewport: { x: 0, y: 0, width: 800, height: 600 } },
  presentation: { stickyHeaders: [], hiddenIds: new Set(), focusedIds: new Set(), labelsById: {}, sealedSvgArtifactsByRootId: {} },
})

const git = (directory, args) =>
  execFileSync("git", args, {
    cwd: directory,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "smoke",
      GIT_AUTHOR_EMAIL: "smoke@localhost",
      GIT_COMMITTER_NAME: "smoke",
      GIT_COMMITTER_EMAIL: "smoke@localhost",
    },
  }).trim()

const work = mkdtempSync(join(tmpdir(), "grapht-board-smoke-"))
const document = join(work, "notes.md")
const fence = () => TEXT.slice(TEXT.indexOf("```mermaid"), TEXT.indexOf("```\n\n## Later") + 3)

try {
  writeFileSync(document, TEXT, "utf8")
  const before = mdDocument("notes.md", TEXT)

  console.log("\n1. a document becomes a board")
  const board = await boardFromDocuments("demo", [before])
  say("items", board.items.length)
  say("sources", board.sources.map(source => `${source.path}@${source.docHash.slice(0, 8)}`).join(" "))
  say("an item id is its address's locator", board.items[0].itemId === board.items[0].address.locatorHash)

  console.log("\n2. pin the fence, place two items, gesture, fold the journal")
  const fenceBlock = before.blocks.find(block => before.text.slice(block.span.start, block.span.end) === fence())
  const paragraph = before.blocks.find(block => block.kind === "paragraph" && before.text.slice(block.span.start, block.span.end).startsWith("A paragraph"))
  const fenceItem = board.items.find(item => item.blockId === fenceBlock.id)
  const paragraphItem = board.items.find(item => item.blockId === paragraph.id)
  let placed = withFence(placeItem(placeItem(board, fenceItem.itemId, { x: 120, y: 40 }), paragraphItem.itemId, { x: 20, y: 300 }), {
    blockId: fenceBlock.id,
    frame: frame(["m1", "m2"]),
  })
  const ledger = { events: [{ id: fenceItem.itemId, dx: 60, dy: -10 }, { id: paragraphItem.itemId, dx: 0, dy: 25 }], cursor: 2 }
  placed = foldMoves(placed, ledger)
  say("placements after the gesture", placed.placements.map(p => `${p.itemId.slice(0, 6)} (${p.x},${p.y})`).join(" "))
  say("undo both gestures", JSON.stringify(foldMoves(placed, { ...ledger, cursor: 0 }).placements.length))

  console.log("\n3. the board goes to disk and comes back")
  const boardPath = `${document}.board.json`
  writeBoardFile(boardPath, placed)
  const reloaded = readBoardFile(boardPath)
  say("bytes", readFileSync(boardPath, "utf8").split("\n").length + " lines of JSON")
  say("placements survived", JSON.stringify(reloaded.placements) === JSON.stringify(placed.placements))
  say("a fence item still carries its frame", Object.keys(reloaded.items.find(item => item.kind === "fence").frame.graph).join(","))

  console.log("\n4. someone inserts a block above the fence")
  // An insertion, not an in-place edit: the fence's ordinal shifts, so its item id shifts with it,
  // and the placement has to follow. This is the case the whole address design exists for.
  const edited = TEXT.replace("The fence below", "A new paragraph, added above everything.\n\nThe fence below")
  writeFileSync(document, edited, "utf8")
  const { board: reconciled, moved, orphaned } = await reconcileBoard(reloaded, [mdDocument("notes.md", edited)])
  say("relocations", moved.map(entry => `${entry.blockId}: ${entry.from.slice(0, 6)} -> ${entry.to.slice(0, 6)}`).join(" ") || "none")
  say("orphans", orphaned.length)
  say("the pin followed the prose", reconciled.placements.map(p => `${p.itemId.slice(0, 6)} (${p.x},${p.y})`).join(" "))
  say("placed on the old ids", placed.placements.map(p => p.itemId.slice(0, 6)).join(" "))
  say("placed on the new ids", reconciled.placements.map(p => p.itemId.slice(0, 6)).join(" "))
  say("positions unchanged", JSON.stringify(reconciled.placements.map(p => [p.x, p.y])) === JSON.stringify(placed.placements.map(p => [p.x, p.y])))
  say("board validation", JSON.stringify(validateBoard(reconciled)))

  console.log("\n5. a message about the paragraph, and a commit that resolves it")
  git(work, ["init", "--initial-branch=main"])
  git(work, ["add", "-A"])
  git(work, ["commit", "-m", "notes: the document and its board"])
  const written = git(work, ["rev-parse", "HEAD"])
  const target = reconciled.items.find(item => item.kind === "block" && item.blockId === paragraph.id) ?? reconciled.items[0]
  const message = withMessageId({
    thread: "t1",
    author: { kind: "agent", id: "claude", model: "opus" },
    at: new Date().toISOString(),
    kind: "question",
    target: target.address,
    body: "Does this paragraph still say what it said?",
    baseRevision: written,
  })
  writeFileSync(`${document}.messages.jsonl`, messagesToJsonl({ format: "grapht-messages/0", artifact: "notes.md", messages: [message] }), "utf8")
  git(work, ["add", "-A"])
  git(work, ["commit", "-m", `notes: ask about the paragraph\n\nGrapht-Artifacts: notes.md\nGrapht-Messages: ${message.id}`])
  const resolved = git(work, ["rev-parse", "HEAD"])
  say("message id", message.id.slice(0, 8))

  console.log("\n6. grapht-doc-history, in the repository that just made those commits")
  const cwd = process.cwd()
  process.chdir(work)
  const code = await docHistoryMain(["notes.md"])
  process.chdir(cwd)
  say("exit code", code)
  say("expected", `wrote-against ${written.slice(0, 8)}, resolved-by ${resolved.slice(0, 8)}`)

  console.log("\n7. reading is not trusting")
  const tampered = readFileSync(`${document}.messages.jsonl`, "utf8").replace("still say what it said", "say something else")
  try {
    parseBoard(printBoard(tampered))
    say("a board that is not JSON", "no error — WRONG")
  } catch (error) {
    say("a board that is not JSON", String(error.message).slice(0, 48))
  }
  const { readMessageLog } = await import("../dist/index.js")
  writeFileSync(`${document}.messages.jsonl`, tampered, "utf8")
  try {
    readMessageLog(`${document}.messages.jsonl`)
    say("a rewritten message body", "accepted — WRONG")
  } catch (error) {
    say("a rewritten message body", String(error.message).split(":").slice(-1)[0].trim().slice(0, 40))
  }
  console.log("")
} finally {
  rmSync(work, { recursive: true, force: true })
}
