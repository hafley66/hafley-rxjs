// The board view, driven the way a person drives it: real pointer events on a real element, in the
// one environment that has a pointer, a hit test and a layout. Nothing here calls the host to move a
// card — the drag is the only thing that writes a gesture, and every assertion reads the DOM back.
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { describe, expect, it } from "vitest"
import { mdDocument } from "@hafley66/grapht-model"
import { boardFromDocuments, placeItem, type Board } from "../0_board.js"
import { boardHost } from "../3_boardHost.js"
import { BoardView } from "./index.js"

declare global {
	// `act` refuses to batch without it, and every call warns on the console instead.
	var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const TEXT = [
	"# Notes",
	"",
	"Intro paragraph.",
	"",
	"## Usage",
	"",
	"```mermaid",
	"sequenceDiagram",
	"```",
	"",
].join("\n")

/** Two placed items, because a placement is the only thing a drag can move. */
async function placedPair(): Promise<{ board: Board; first: string }> {
	const built = await boardFromDocuments("b1", [mdDocument("docs/example.md", TEXT)])
	const [first, second] = built.items
	const board = placeItem(
		placeItem(built, first.itemId, { x: 100, y: 100, z: 0 }),
		second.itemId,
		{ x: 320, y: 100, z: 1 },
	)
	return { board, first: first.itemId }
}

const mount = (): { container: HTMLElement; root: Root } => {
	const container = document.createElement("div")
	container.style.inlineSize = "600px"
	container.style.blockSize = "400px"
	document.body.append(container)
	return { container, root: createRoot(container) }
}

const cardOf = (container: HTMLElement, itemId: string): HTMLElement => {
	const card = container.querySelector<HTMLElement>(`[data-board-item="${itemId}"]`)
	if (card === null) throw new Error(`no card for ${itemId}`)
	return card
}

/**
 * One whole drag, as a pointer delivers it: a press on the card, a move, and a release. The caller
 * names the offset, so an assertion can say what the placement should have become.
 */
function drag(card: HTMLElement, dx: number, dy: number): void {
	const box = card.getBoundingClientRect()
	const from = { x: box.left + 5, y: box.top + 5 }
	card.dispatchEvent(
		new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1, clientX: from.x, clientY: from.y }),
	)
	window.dispatchEvent(
		new PointerEvent("pointermove", { bubbles: true, pointerId: 1, clientX: from.x + dx, clientY: from.y + dy }),
	)
	window.dispatchEvent(
		new PointerEvent("pointerup", { bubbles: true, pointerId: 1, clientX: from.x + dx, clientY: from.y + dy }),
	)
}

describe("BoardView", () => {
	it("drags a card by real pointer events, draws the placement, and puts it back on undo", async () => {
		const { board, first } = await placedPair()
		const host = boardHost(board)
		const { container, root } = mount()
		await act(async () => {
			root.render(createElement(BoardView, { host }))
		})

		const card = cardOf(container, first)
		expect(card.dataset.boardX).toBe("100")
		expect(card.dataset.boardY).toBe("100")
		expect(card.dataset.boardKind).toBe("block")
		// The board owns the coordinate space, not the viewport: the card is where the placement says.
		expect(card.getBoundingClientRect().left - container.getBoundingClientRect().left).toBeCloseTo(100, 0)

		await act(async () => drag(card, 40, 25))
		expect(card.dataset.boardX).toBe("140")
		expect(card.dataset.boardY).toBe("125")
		expect(host.history().events).toHaveLength(1)

		expect(host.undo()).toBe(true)
		expect(card.dataset.boardX).toBe("100")
		expect(card.dataset.boardY).toBe("100")

		await act(async () => {
			root.unmount()
		})
		expect(container.querySelectorAll("[data-board-item]")).toHaveLength(0)
		container.remove()
	})

	it("moves the same card element when a placement changes, and still draws every item", async () => {
		const { board, first } = await placedPair()
		const host = boardHost(board)
		const { container, root } = mount()
		await act(async () => {
			root.render(createElement(BoardView, { host }))
		})

		const before = cardOf(container, first)
		const drawn = container.querySelectorAll("[data-board-item]").length
		expect(drawn).toBe(board.items.length)

		await act(async () => drag(before, 60, 0))
		expect(cardOf(container, first)).toBe(before)
		expect(container.querySelectorAll("[data-board-item]")).toHaveLength(drawn)

		await act(async () => {
			root.unmount()
		})
		container.remove()
	})

	it("drags the stacked card the pointer landed on, not the one the journal reads at the origin", async () => {
		const built = await boardFromDocuments("b1", [mdDocument("docs/example.md", TEXT)])
		const third = built.items[2]
		if (third === undefined) throw new Error("the fixture has fewer than three items")
		const host = boardHost(built)
		const { container, root } = mount()
		await act(async () => {
			root.render(createElement(BoardView, { host, card: { height: 84, gap: 24 } }))
		})

		const card = cardOf(container, third.itemId)
		expect(card.dataset.boardY).toBe("216")
		// A real hit test, in the layout the browser gives the page: the third card is the element at
		// the third card's centre, which is the whole point of the stack being drawn rather than assumed.
		const box = card.getBoundingClientRect()
		expect(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)).toBe(card)

		await act(async () => drag(card, 40, 25))
		expect(card.dataset.boardX).toBe("40")
		expect(card.dataset.boardY).toBe("241")
		// The item above it in the stack stayed where it was drawn, which is what the defect broke.
		const first = built.items[0]
		if (first === undefined) throw new Error("the fixture has no first item")
		expect(cardOf(container, first.itemId).dataset.boardY).toBe("0")
		expect(host.history().events).toEqual([{ id: third.itemId, dx: 40, dy: 241, phase: "commit" }])

		await act(async () => {
			root.unmount()
		})
		container.remove()
	})

	it("abandons a gesture on Escape instead of dropping the card where it stopped", async () => {
		const { board, first } = await placedPair()
		const host = boardHost(board)
		const { container, root } = mount()
		await act(async () => {
			root.render(createElement(BoardView, { host }))
		})

		const card = cardOf(container, first)
		const box = card.getBoundingClientRect()
		await act(async () => {
			card.dispatchEvent(
				new PointerEvent("pointerdown", {
					bubbles: true,
					button: 0,
					pointerId: 1,
					clientX: box.left + 5,
					clientY: box.top + 5,
				}),
			)
			window.dispatchEvent(
				new PointerEvent("pointermove", { bubbles: true, pointerId: 1, clientX: box.left + 95, clientY: box.top + 5 }),
			)
			window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }))
		})

		expect(card.dataset.boardX).toBe("100")
		expect(host.history().events).toHaveLength(0)
		await act(async () => {
			root.unmount()
		})
		container.remove()
	})
})
