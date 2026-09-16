// The board on disk: one artefact beside its document, written whole or not at all.
//
// A reader must never meet a half-written board, and a reader must never draw a board its own
// validation rejects, so the write goes through a sibling temp file and the read ends in
// `validateBoard`. The path rule is the plan's: the board is a sibling of the document it
// describes, named after it, so a document and its board travel through git together.
import { readFileSync } from "node:fs"
import { writeArtifactFile } from "../lib/2_artifactFile.js"
import { type Board, parseBoard, printBoard, validateBoard } from "./0_board.js"

/** The board artefact for a document: `<document>.board.json`, beside it. */
export function boardPathFor(documentPath: string): string {
  if (documentPath.length === 0) throw new Error("a board path needs the document path it sits beside")
  return `${documentPath}.board.json`
}

/** Writes the board as its document's sibling, whole or not at all. */
export function writeBoardFile(path: string, board: Board): void {
  writeArtifactFile(path, printBoard(board))
}

/**
 * Reads a board and returns it only when it validates. Every refusal names the path, because the
 * caller holds paths, not boards, and an anomaly without its board is not actionable.
 */
export function readBoardFile(path: string): Board {
  const text = readFileSync(path, "utf8")
  let board: Board
  try {
    board = parseBoard(text)
  } catch (error) {
    throw new Error(`board ${path}: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
  const anomalies = validateBoard(board)
  if (anomalies.length > 0) {
    throw new Error(`board ${path} is invalid: ${anomalies.map(anomaly => `${anomaly.kind} ${anomaly.detail}`).join("; ")}`)
  }
  return board
}