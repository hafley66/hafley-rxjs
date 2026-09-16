// The host's claims: a gesture writes a journal entry, the drawn board is folded, and a preview is
// never part of what a file would get. Every assertion is about what a caller can observe — the
// placements drawn, the events retained, what `boardForFile` would write — not about the fold.
import { describe, expect, test } from "vitest"
import { mdDocument } from "@hafley66/grapht-model"
import { boardForFile, boardFromDocuments, boardHost, type Board, placeItem, validateBoard } from "../../src/index.js"

const TEXT = ["# Notes", "", "Intro paragraph.", "", "## Usage", "", "```mermaid", "sequenceDiagram", "```", ""].join("\n")

const at = (board: Board, itemId: string) => board.placements.find(placement => placement.itemId === itemId)

/** A board with two placed items, because a placement is what a gesture moves. */
async function placedBoard(): Promise<{ board: Board; first: string; second: string }> {
	const built = await boardFromDocuments("b1", [mdDocument("docs/example.md", TEXT)])
	const [first, second] = built.items
	const board = placeItem(placeItem(built, first.itemId, { x: 100, y: 100, z: 0 }), second.itemId, { x: 200, y: 100, z: 0 })
	return { board, first: first.itemId, second: second.itemId }
}

describe("board host", () => {
	test("draws the board as it was built while nobody has gestured", async () => {
		const { board, first } = await placedBoard()
		const host = boardHost(board)

		expect(at(host.placed(), first)).toEqual(at(board, first))
		expect(host.history().events).toEqual([])
		expect(host.canUndo()).toBe(false)
	})

	test("a gesture in flight moves what is drawn and nothing that is retained", async () => {
		const { board, first } = await placedBoard()
		const host = boardHost(board)
		const before = at(board, first)

		const gesture = host.begin(first, { x: 100, y: 100 })
		host.previewTo(gesture, { x: 140, y: 130 })

		expect(at(host.placed(), first)).toEqual({ itemId: first, x: 140, y: 130, z: before?.z ?? 0 })
		expect(host.history().events).toEqual([])
		expect(host.canUndo()).toBe(false)
		// A page closed mid-drag has no half-gesture to explain.
		expect(at(boardForFile(host), first)).toEqual(before)

		host.cancel(gesture)
		expect(at(host.placed(), first)).toEqual(before)
	})

	test("a committed gesture is one event, and undo un-moves the board", async () => {
		const { board, first } = await placedBoard()
		const host = boardHost(board)

		const gesture = host.begin(first, { x: 100, y: 100 })
		host.commitTo(gesture, { x: 40, y: 25 })

		expect(host.history().events).toEqual([{ id: first, dx: -60, dy: -75, phase: "commit" }])
		expect(host.history().cursor).toBe(1)
		expect(at(host.placed(), first)).toEqual({ itemId: first, x: 40, y: 25, z: 0 })
		expect(at(boardForFile(host), first)).toEqual({ itemId: first, x: 40, y: 25, z: 0 })

		expect(host.undo()).toBe(true)
		expect(at(host.placed(), first)).toEqual({ itemId: first, x: 100, y: 100, z: 0 })
		expect(host.canUndo()).toBe(false)
		expect(host.undo()).toBe(false)

		expect(host.redo()).toBe(true)
		expect(at(host.placed(), first)).toEqual({ itemId: first, x: 40, y: 25, z: 0 })
		expect(host.redo()).toBe(false)
	})

	test("a gesture after an undo branches, dropping the redo tail", async () => {
		const { board, first } = await placedBoard()
		const host = boardHost(board)

		host.commitTo(host.begin(first, { x: 100, y: 100 }), { x: 300, y: 100 })
		host.undo()
		host.commitTo(host.begin(first, { x: 100, y: 100 }), { x: 100, y: 300 })

		expect(host.history().events).toEqual([{ id: first, dx: 0, dy: 200, phase: "commit" }])
		expect(host.history().cursor).toBe(1)
		expect(at(host.placed(), first)).toEqual({ itemId: first, x: 100, y: 300, z: 0 })
	})

	test("two gestures on one item accumulate, because each delta starts at its own beginning", async () => {
		const { board, first } = await placedBoard()
		const host = boardHost(board)

		host.commitTo(host.begin(first, { x: 100, y: 100 }), { x: 150, y: 100 })
		host.commitTo(host.begin(first, { x: 150, y: 100 }), { x: 150, y: 170 })

		expect(at(host.placed(), first)).toEqual({ itemId: first, x: 150, y: 170, z: 0 })
		expect(host.history().events).toHaveLength(2)
	})

	test("two items move independently, and what a file gets still validates", async () => {
		const { board, first, second } = await placedBoard()
		const host = boardHost(board)

		host.commitTo(host.begin(first, { x: 100, y: 100 }), { x: 120, y: 100 })
		host.commitTo(host.begin(second, { x: 200, y: 100 }), { x: 200, y: 60 })

		expect(at(host.placed(), first)?.x).toBe(120)
		expect(at(host.placed(), second)?.y).toBe(60)
		expect(validateBoard(boardForFile(host))).toEqual([])
	})

	test("a replaced board clears the journal, because its events name ids the new revision may not have", async () => {
		const { board, first } = await placedBoard()
		const host = boardHost(board)
		host.commitTo(host.begin(first, { x: 100, y: 100 }), { x: 160, y: 100 })
		expect(host.canUndo()).toBe(true)

		const next = placeItem(board, first, { x: 500, y: 500, z: 0 })
		host.replace(next)

		expect(host.history()).toEqual({ events: [], cursor: 0 })
		expect(host.canUndo()).toBe(false)
		expect(at(host.placed(), first)).toEqual({ itemId: first, x: 500, y: 500, z: 0 })
	})
})
