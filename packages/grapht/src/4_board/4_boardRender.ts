// A board in the DOM: one element per item, moved rather than rebuilt, and a pointer that writes
// gestures into the host instead of placements of its own.
//
// The host owns every position. A drag writes a gesture, the host journals it, and what is drawn is
// `placed` — the retained prefix plus the preview — so undo redraws the board through exactly the
// path a drag does and this file never computes a coordinate. `placed` is subscribed once, here,
// because this is the boundary: nothing else is allowed to be a second reader of the same signal.
//
// Reconciliation is keyed by `itemId` for the same reason signal-grid's rows are: an item that is
// already on screen is moved, never rebuilt, so a drag run at pointer rate rewrites a transform
// instead of building a card. An item the board no longer holds loses its element.
import { Subscription } from "rxjs"
import { type Board, type BoardItem, type BoardPlacement, unplacedStack } from "./0_board.js"
import type { BoardGesture, BoardHost, BoardPoint } from "./3_boardHost.js"

/** The renderer's teardown. Same contract as signal-grid's `RenderHandle`. */
export interface BoardRenderHandle {
	readonly stop: () => void
}

export interface BoardRenderOptions {
	/** What one item reads as on its card. A board holds items, not prose — a `block` item is an
	 * address — so only a caller that still has the document can say what the card should say. */
	readonly excerpt?: (item: BoardItem) => string
	/** What one card measures, so items nobody placed stack in reading order instead of piling on the
	 * origin. The default is the docs page's card; a host drawing taller cards passes its own, because
	 * only it knows. The rule itself is `unplacedStack`'s, shared with `boardFrame`. */
	readonly card?: { readonly height: number; readonly gap?: number }
}

/** On the root: a board is drawn inside this element. On a card: the item it draws. */
const BOARD_CLASS = "grapht-board"
const CARD_CLASS = "grapht-board-card"

/** The root's board id while a gesture is open, so a caller can style the drag it is inside of. */
const DRAG_ATTR = "data-board-drag"

const ITEM_ATTR = "data-board-item"
const KIND_ATTR = "data-board-kind"
const X_ATTR = "data-board-x"
const Y_ATTR = "data-board-y"
const Z_ATTR = "data-board-z"

/** The card a page draws when it did not say: the docs page's own. */
const CARD = { height: 84, gap: 24 }

/** Attribute and style writes run for every card of every pass, so each one compares first: an
 * attribute set to the value it already holds still invalidates style and layout. */
const setDiffed = (el: Element, name: string, value: string): void => {
	if (el.getAttribute(name) !== value) el.setAttribute(name, value)
}

const setStyleDiffed = (el: HTMLElement, name: "transform" | "zIndex", value: string): void => {
	if (el.style[name] !== value) el.style[name] = value
}

/**
 * Draws a board into `root` and keeps it drawn until `stop`.
 *
 * `root` is the board's coordinate space: a card is placed at `(x, y)`, in root-box pixels with the
 * root's scroll included, and a board point is measured the same way, so a pointer at a card's
 * corner and the placement under it agree.
 */
export function renderBoard(host: BoardHost, root: HTMLElement, options?: BoardRenderOptions): BoardRenderHandle {
	const excerpt = options?.excerpt
	const card = options?.card ?? CARD
	const cards = new Map<string, HTMLElement>()
	/** Where each card was drawn, so a press starts a gesture from the position a person sees and not
	 * from the one a file happens to hold. An item nobody placed is drawn in the stack, and the host
	 * cannot know that: it is this file's `unplacedStack` that put it there. */
	const drawn = new Map<string, BoardPoint>()

	root.classList.add(BOARD_CLASS)
	// Absolute children position against the nearest positioned ancestor, and a point is measured
	// against this element's own box, so a static root would place cards somewhere this file cannot
	// see. Only an inline position this file set is ever removed again; a consumer's is left alone.
	const ownsPosition = getComputedStyle(root).position === "static"
	if (ownsPosition) root.style.position = "relative"

	/** One pass: a card for every item, moved if it is already there, removed if its item is gone. */
	function pass(board: Board): void {
		setDiffed(root, "data-board", board.id)
		const positions = new Map(board.placements.map((placement): [string, BoardPlacement] => [placement.itemId, placement]))
		// Items nobody placed draw in reading order, by the same rule `boardFrame` projects onto a
		// camera. A board that has never been gestured is a column, not a pile at the origin.
		const stack = unplacedStack(board, () => card.height, card.gap)
		const seen = new Set<string>()
		for (const item of board.items) {
			if (seen.has(item.itemId)) continue
			seen.add(item.itemId)
			const cardElement = cards.get(item.itemId) ?? add(item)
			const placement = positions.get(item.itemId)
			const x = placement?.x ?? 0
			const y = placement?.y ?? stack.get(item.itemId) ?? 0
			const z = placement?.z ?? 0
			drawn.set(item.itemId, { x, y })
			setStyleDiffed(cardElement, "transform", `translate(${x}px, ${y}px)`)
			setStyleDiffed(cardElement, "zIndex", String(z))
			setDiffed(cardElement, X_ATTR, String(x))
			setDiffed(cardElement, Y_ATTR, String(y))
			setDiffed(cardElement, Z_ATTR, String(z))
			// The excerpt comes off the caller's document, which can be replaced under a host that
			// stayed the same, so the text is a diffed write and not a build-time one.
			const text = excerpt?.(item) ?? (item.kind === "sticky" ? item.text : item.itemId)
			if (cardElement.textContent !== text) cardElement.textContent = text
		}
		for (const [itemId, card] of cards) {
			if (seen.has(itemId)) continue
			card.remove()
			cards.delete(itemId)
			drawn.delete(itemId)
		}
	}

	function add(item: BoardItem): HTMLElement {
		const card = document.createElement("div")
		card.className = CARD_CLASS
		card.setAttribute(ITEM_ATTR, item.itemId)
		card.setAttribute(KIND_ATTR, item.kind)
		cards.set(item.itemId, card)
		root.append(card)
		return card
	}

	/** A pointer's place in the board's own space: root-box pixels, borders and scroll included. */
	const pointAt = (event: PointerEvent): BoardPoint => {
		const box = root.getBoundingClientRect()
		return {
			x: event.clientX - box.left - root.clientLeft + root.scrollLeft,
			y: event.clientY - box.top - root.clientTop + root.scrollTop,
		}
	}

	let gesture: BoardGesture | null = null

	const abandon = (): void => {
		if (gesture === null) return
		const open = gesture
		gesture = null
		root.removeAttribute(DRAG_ATTR)
		host.cancel(open)
	}

	const onPointerDown = (event: PointerEvent): void => {
		// One gesture at a time, and only the primary button starts one.
		if (gesture !== null || event.button !== 0) return
		// The card the pointer landed on, or nothing: a press on the board itself is not a gesture.
		const itemId =
			event.target instanceof Element ? event.target.closest(`[${ITEM_ATTR}]`)?.getAttribute(ITEM_ATTR) ?? null : null
		if (itemId === null) return
		// Text inside a card would otherwise be selected by the first move of a drag.
		event.preventDefault()
		// The item starts where it is seen. For an item nobody placed that is the stack position, which
		// is not the position the journal folds it to — the gesture carries the difference.
		gesture = host.begin(itemId, pointAt(event), drawn.get(itemId) ?? { x: 0, y: 0 })
		root.setAttribute(DRAG_ATTR, itemId)
	}

	const onPointerMove = (event: PointerEvent): void => {
		if (gesture === null) return
		host.previewTo(gesture, pointAt(event))
	}

	const onPointerUp = (event: PointerEvent): void => {
		if (gesture === null) return
		const finished = gesture
		gesture = null
		root.removeAttribute(DRAG_ATTR)
		host.commitTo(finished, pointAt(event))
	}

	// `pointercancel` and Escape both abandon the gesture rather than commit it, because a pointer
	// the browser took away is not a pointer that meant to drop an item where it stopped.
	const onPointerCancel = (): void => abandon()

	const onKeyDown = (event: KeyboardEvent): void => {
		if (event.key === "Escape") abandon()
	}

	// A move or a release outside the root still belongs to a gesture that began inside it, so the
	// three pointer edges that continue a drag are on the window and only `pointerdown` is on the box.
	const subscription = new Subscription()
	subscription.add(host.placed.subscribe(pass))
	root.addEventListener("pointerdown", onPointerDown)
	window.addEventListener("pointermove", onPointerMove)
	window.addEventListener("pointerup", onPointerUp)
	window.addEventListener("pointercancel", onPointerCancel)
	window.addEventListener("keydown", onKeyDown)
	subscription.add(() => root.removeEventListener("pointerdown", onPointerDown))
	subscription.add(() => window.removeEventListener("pointermove", onPointerMove))
	subscription.add(() => window.removeEventListener("pointerup", onPointerUp))
	subscription.add(() => window.removeEventListener("pointercancel", onPointerCancel))
	subscription.add(() => window.removeEventListener("keydown", onKeyDown))
	// A gesture the renderer opened has no other owner once the renderer is gone, so it is abandoned
	// rather than left in the host's preview: nothing outlives `stop`, including a half-drag.
	subscription.add(() => {
		abandon()
		for (const card of cards.values()) card.remove()
		cards.clear()
		root.classList.remove(BOARD_CLASS)
		root.removeAttribute("data-board")
		if (ownsPosition) root.style.removeProperty("position")
	})

	return { stop: () => subscription.unsubscribe() }
}
