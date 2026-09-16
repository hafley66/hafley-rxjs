// React mounts the box. Every node inside it belongs to `renderBoard`, for the same reason
// signal-grid's `GridView` hands its grid to `render` and nothing else: a card per item per React
// render would rebuild exactly the DOM the keyed reconcile exists to move.
import { createElement, useEffect, useRef, type CSSProperties, type ReactElement } from "react"
import type { BoardItem } from "../0_board.js"
import type { BoardHost } from "../3_boardHost.js"
import { renderBoard } from "../4_boardRender.js"

export interface BoardViewProps {
	readonly host: BoardHost
	readonly className?: string
	readonly style?: CSSProperties
	/** What one item reads as, from whoever still holds the document the board was built from. */
	readonly excerpt?: (item: BoardItem) => string
	/** What one card measures, so items nobody placed draw in reading order rather than at the origin. */
	readonly card?: { readonly height: number; readonly gap?: number }
}

/**
 * The whole React surface for a board. `renderBoard` decorates the element it is handed and returns
 * the teardown, which is exactly an effect's contract, so the adapter is the effect and nothing else.
 *
 * The host is the identity: pass the same `host` across re-renders and the board is never rebuilt,
 * because a host holds the journal a drag wrote and a second one would throw that work away.
 */
export function BoardView({ host, className, style, excerpt, card }: BoardViewProps): ReactElement {
	const hostRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const el = hostRef.current
		if (el === null) return
		return renderBoard(host, el, { ...(excerpt === undefined ? {} : { excerpt }), ...(card === undefined ? {} : { card }) }).stop
		// The host is the identity, so `excerpt` and `card` are deliberately not dependencies: a new
		// closure renders the same board, and re-running the effect would tear the DOM down and build
		// it back.
	}, [host])
	return createElement("div", { ref: hostRef, className, style })
}
