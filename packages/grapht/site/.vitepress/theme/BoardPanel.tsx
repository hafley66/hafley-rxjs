// The board page. React owns this: the host, the toolbar, the file. Vue mounts it and nothing else.
//
// Written as JSX on purpose. `signalsJsx` (wired in the site's vite config) points the JSX runtime at
// `@hafley66/signals/jsx-runtime`, which wraps every component in `SignalReact`: a signal read during
// render is recorded and subscribed after commit. So `host.placed()` below is the whole reactivity —
// no hook, no external store, no second copy of the value in React state.
//
// Two halves, because a host does not exist until the board is built or loaded: `BoardPanel` resolves
// one, `BoardBody` is the page that has one.
import { useCallback, useEffect, useState } from "react"
import { mdDocument } from "@hafley66/grapht-model"
import { type BoardItem, boardFromDocuments, reconcileBoard } from "../../../src/4_board/0_board.js"
import { boardForFile, boardHost, type BoardHost } from "../../../src/4_board/3_boardHost.js"
import { BoardView } from "../../../src/4_board/react/index.js"
import { loadBoardFile, saveBoardFile } from "../../boardClient.js"

const NAME = "demo"
const PATH = "notes.md"
/** What a card measures, in the page's own pixels. `board.css` fixes the same height, and the stack
 * an unplaced item draws at is computed from it, so the two have to agree. */
const CARD = { height: 84, gap: 24 }

const HEAD = [
	"# Release notes",
	"",
	"Everything under this line is a block of the document: a heading, a paragraph, a list, a fence.",
	"",
	"## What shipped",
	"",
	"- the address lane: locator, content, and document hashes",
	"- the projection: blocks as nodes, headings as groups",
	"- the board: items in places, placements keyed to the locator",
	"",
]
const FENCE = ["```mermaid", "sequenceDiagram", "  Alice->>Bob: ship it", "```", ""]
const TAIL = ["## What is next", "", "A pin layer, and messages pinned to this prose.", ""]
const SOURCE = [...HEAD, ...FENCE, ...TAIL].join("\n")
/** One paragraph above the fence: the case a placement has to survive. */
const INSERTED = [...HEAD, "An interruption, added above everything else.", "", ...FENCE, ...TAIL].join("\n")

/** The raw prose behind an item, taken off the revision on screen rather than the one on disk. */
function excerptOf(item: BoardItem, text: string): string {
	const span = item.kind === "sticky" || item.kind === "svg" ? item.address?.span : item.address.span
	if (span === undefined) return ""
	const raw = text.slice(span.start, span.end).replace(/\s+/g, " ").trim()
	return raw.length > 92 ? `${raw.slice(0, 92)}…` : raw
}

export function BoardPanel() {
	const [loaded, setLoaded] = useState<{ host: BoardHost; note: string } | null>(null)

	/** Build from the document and lay every item where the file left it, if it left anything. */
	useEffect(() => {
		let live = true
		void (async () => {
			const built = await boardFromDocuments("demo", [mdDocument(PATH, SOURCE)])
			const file = await loadBoardFile(NAME)
			if (!live) return
			if (file.board === null) {
				setLoaded({
					host: boardHost(built),
					note: file.anomalies.length > 0 ? `no board on disk: ${file.anomalies.join("; ")}` : "no board on disk yet — this one is built from the document",
				})
				return
			}
			// A saved board is reconciled onto the document it names, so prose that moved since the
			// save re-anchors instead of being drawn in the wrong place.
			const { board: reconciled, moved, orphaned } = await reconcileBoard(file.board, [mdDocument(PATH, SOURCE)])
			if (!live) return
			setLoaded({
				host: boardHost(reconciled),
				note: moved.length > 0 || orphaned.length > 0 ? `from ${file.path}: ${moved.length} re-anchored, ${orphaned.length} orphaned` : `from ${file.path}: ${reconciled.placements.length} placements`,
			})
		})()
		return () => {
			live = false
		}
	}, [])

	if (loaded === null) return <p className="board-note">loading the board from its file…</p>
	return <BoardBody host={loaded.host} firstNote={loaded.note} />
}

interface BoardBodyProps {
	readonly host: BoardHost
	readonly firstNote: string
}

function BoardBody({ host, firstNote }: BoardBodyProps) {
	const [note, setNote] = useState(firstNote)
	const [busy, setBusy] = useState(false)
	const [text, setText] = useState(SOURCE)

	// Reads, not hooks: SignalReact records them for this render and subscribes after commit, so a
	// committed gesture, an undo or a replaced board all land here without being asked for.
	const placed = host.placed()
	const history = host.history()

	const save = useCallback(async () => {
		setBusy(true)
		const result = await saveBoardFile(NAME, boardForFile(host))
		setBusy(false)
		setNote(result.ok ? `wrote ${result.path}` : `refused: ${(result.anomalies ?? []).join("; ")}`)
	}, [host])

	const insertAbove = useCallback(async () => {
		// The folded board, not `host.board()`: a placement made this session lives in the journal
		// until something folds it, and reconciling the raw board would drop every one of them.
		const { board: reconciled, moved, orphaned } = await reconcileBoard(boardForFile(host), [mdDocument(PATH, INSERTED)])
		host.replace(reconciled)
		setText(INSERTED)
		setNote(
			moved.length > 0
				? `${moved.length} re-anchored onto new ids, positions kept — ${moved.map(entry => `${entry.blockId}: ${entry.from.slice(0, 6)}→${entry.to.slice(0, 6)}`).join(", ")}${orphaned.length > 0 ? `; ${orphaned.length} orphaned` : ""}`
				: "no item changed its address",
		)
	}, [host])

	const reload = useCallback(async () => {
		const file = await loadBoardFile(NAME)
		if (file.board === null) {
			setNote("no board on disk")
			return
		}
		host.replace(file.board)
		setNote(`reloaded ${file.path}`)
	}, [host])

	const excerpt = useCallback((item: BoardItem) => excerptOf(item, text), [text])

	return (
		<div className="board-demo">
			<div className="board-bar">
				<button type="button" onClick={() => setNote(host.undo() ? "undone" : "nothing to undo")}>
					Undo
				</button>
				<button type="button" onClick={() => setNote(host.redo() ? "redone" : "nothing to redo")}>
					Redo
				</button>
				<button type="button" disabled={busy} onClick={() => void save()}>
					Save to file
				</button>
				<button type="button" onClick={() => void insertAbove()}>
					Insert a block above the fence
				</button>
				<button type="button" onClick={() => void reload()}>
					Reload from file
				</button>
				<span className="board-readout">
					{placed.placements.length} placed · {history.cursor}/{history.events.length} gestures
				</span>
			</div>
			<BoardView host={host} excerpt={excerpt} card={CARD} className="board-canvas" />
			<p className="board-note">{note}</p>
			<p className="board-help">
				document: {text.length} chars · drag a card, then Save; the board is {PATH}.board.json beside its document
			</p>
		</div>
	)
}
