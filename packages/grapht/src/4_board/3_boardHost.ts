// The board as signals: a board in, a journal out, and the folded board as a memo.
//
// Nothing here writes a placement. A gesture writes a move into the journal and the placements a
// renderer draws are folded from the retained prefix, so undo is a cursor and not an inverse: an
// undone gesture does not need to know what it moved, only that it is no longer retained.
//
// The preview is deliberately not an event. It lives in its own signal, so a drag in flight moves
// what is drawn while `history` stays exactly the committed record a board file is written from —
// a page that is closed mid-drag has no half-gesture to explain.
import { Signal, type Signal$ } from "@hafley66/signals"
import type { GraphMove, MoveHistory } from "../2_graph/23_manualMovement.js"
import { type Board, foldMoves, placementOf } from "./0_board.js"

/** A gesture in progress. Deltas are the pointer's travel plus `offset`, in board coordinates,
 * exactly as `GraphMove` reads them: one gesture contributes one event whose delta is
 * start-to-finish. */
export type BoardGesture = {
	readonly itemId: string
	/** Where the pointer went down, in board coordinates. */
	readonly from: BoardPoint
	/** How far the item was drawn from the position the journal reads it at, at the moment the
	 * gesture opened. Zero for an item the board has placed. An item nobody placed draws in the
	 * reading-order stack while `moveItems` reads its position as the origin, so without this the
	 * first move of a drag teleports it to the top of the stack. */
	readonly offset: BoardPoint
}

/** A point in board coordinates, the space a placement lives in. */
export type BoardPoint = { readonly x: number; readonly y: number }

export type BoardHost = {
	/** The board this host is a journal over. Replaced wholesale by a reload or a reconcile. */
	readonly board: Signal$<Board>
	/** The committed record: what `writeBoardFile` folds and writes. */
	readonly history: Signal$<MoveHistory>
	/** The gesture in flight, or null. Never retained, so it never reaches a file. */
	readonly preview: Signal$<GraphMove | null>
	/** Placements folded from the retained prefix plus the preview: what a renderer draws. */
	readonly placed: Signal$<Board>
	/** Start a gesture on an item. `from` is the caller's, because only it knows whether the pointer
	 * began at the card's corner or its centre; `drawn` is the position the item was drawn at, which
	 * only the caller can see — for an item the board has placed it is that placement. */
	begin(itemId: string, from: BoardPoint, drawn: BoardPoint): BoardGesture
	/** Move the gesture. Writes the preview and nothing else. */
	previewTo(gesture: BoardGesture, at: BoardPoint): void
	/** Finish the gesture: one event, the whole gesture's delta, and the redo tail is dropped
	 * because a new gesture branches from what is retained. */
	commitTo(gesture: BoardGesture, at: BoardPoint): void
	/** Abandon the gesture. No event, nothing to undo, because nothing was retained. */
	cancel(gesture: BoardGesture): void
	/** Retain one event less. Returns false at the floor, so a caller can say so instead of guessing. */
	undo(): boolean
	/** Retain one event more. Returns false at the ceiling. */
	redo(): boolean
	/** Whether anything is left to undo. */
	canUndo(): boolean
	/** Swap the board — a reconcile onto new prose, or a reload from file. The journal is cleared,
	 * because its events name item ids that the new revision may no longer have. */
	replace(board: Board): void
}

const delta = (gesture: BoardGesture, at: BoardPoint): { dx: number; dy: number } => ({
	dx: Math.trunc(gesture.offset.x + at.x - gesture.from.x),
	dy: Math.trunc(gesture.offset.y + at.y - gesture.from.y),
})

const moveOf = (gesture: BoardGesture, at: BoardPoint, phase: GraphMove["phase"]): GraphMove => ({
	id: gesture.itemId,
	...delta(gesture, at),
	phase,
})

/**
 * A board, journalled. The returned signals are the whole API: a renderer draws `placed`, a saver
 * writes `foldMoves(board, history)`, and neither of them computes a position of its own.
 */
export function boardHost(initial: Board): BoardHost {
	const board = Signal<Board>(initial)
	const history = Signal<MoveHistory>({ events: [], cursor: 0 })
	const preview = Signal<GraphMove | null>(null)

	// Reads every input it folds, so a renderer subscribed to `placed` hears about a committed
	// gesture, an undone one, and a drag in flight without knowing which of the three it was.
	const placed = Signal(() => {
		const { events, cursor } = history.$()
		const retained = events.slice(0, Math.max(0, Math.min(cursor, events.length)))
		const live = preview.$()
		const folded = live ? [...retained, live] : retained
		return foldMoves(board.$(), { events: folded, cursor: folded.length })
	})

	return {
		board: board.$,
		history: history.$,
		preview: preview.$,
		placed: placed.$,
		begin: (itemId, from, drawn) => {
			// The journal, not the board: a delta lands on the folded placement, so the offset is what
			// turns the pointer's travel into the delta that fold needs.
			const existing = placementOf(foldMoves(board.$(), history.$()), itemId)
			return {
				itemId,
				from,
				offset: { x: drawn.x - (existing?.x ?? 0), y: drawn.y - (existing?.y ?? 0) },
			}
		},
		previewTo: (gesture, at) => {
			preview.$(moveOf(gesture, at, "preview"))
		},
		commitTo: (gesture, at) => {
			preview.$(null)
			const { events, cursor } = history.$()
			const retained = events.slice(0, Math.max(0, Math.min(cursor, events.length)))
			const next = [...retained, moveOf(gesture, at, "commit")]
			history.$({ events: next, cursor: next.length })
		},
		cancel: () => {
			preview.$(null)
		},
		undo: () => {
			const { events, cursor } = history.$()
			if (cursor <= 0) return false
			history.$({ events, cursor: cursor - 1 })
			return true
		},
		redo: () => {
			const { events, cursor } = history.$()
			if (cursor >= events.length) return false
			history.$({ events, cursor: cursor + 1 })
			return true
		},
		canUndo: () => history.$().cursor > 0,
		replace: next => {
			preview.$(null)
			history.$({ events: [], cursor: 0 })
			board.$(next)
		},
	}
}

/** The board as a file writes it: the journal folded, so a reader meets placements, not gestures. */
export function boardForFile(host: BoardHost): Board {
	return foldMoves(host.board(), host.history())
}
