// The board's file, over the dev server. A static build cannot write, so the page asks a Vite
// middleware to do it — and that middleware calls the package's own `writeBoardFile`, so the
// browser never re-implements the atomic write or the validation a reader depends on.
//
// Every response carries the anomalies the package reported, because a refusal with a reason is
// the only kind a page can show. This module keeps no state: it is a fetch and a shape.
import type { Board } from "../src/index.js"

export type BoardFetch = {
	readonly path: string
	readonly board: Board | null
	readonly anomalies: readonly string[]
}

export type BoardSave = {
	readonly ok: boolean
	readonly path?: string
	readonly anomalies?: readonly string[]
}

/** The endpoint the dev-only middleware installs, under whatever base the site was built for. */
export const boardEndpoint = (name: string): string => `${import.meta.env.BASE_URL}__board/${name}`

/** The board beside the document, or null when nothing has been saved there yet. */
export async function loadBoardFile(name: string): Promise<BoardFetch> {
	const response = await fetch(boardEndpoint(name))
	const body = (await response.json()) as BoardFetch
	// 422 is a board that exists and is invalid: the payload is still the answer, not an exception.
	return body
}

/** Writes only what the server would accept. A refusal comes back with the anomalies, unchanged. */
export async function saveBoardFile(name: string, board: Board): Promise<BoardSave> {
	const response = await fetch(boardEndpoint(name), {
		method: "PUT",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(board),
	})
	return (await response.json()) as BoardSave
}
