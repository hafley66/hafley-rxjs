// The board: a grapht artifact, not a graph. A graph is topology; a board is topology plus placed
// items, and an item is placed under the identity its address already has.
//
// Identity is the point of this module. `itemId` is the `locatorHash` of the block an item came
// from, so a placement is keyed to the prose, not to a position in a list: edit above a block and
// the board's item is still the same item, in the same place. `reconcileBoard` carries that across
// revisions, and says out loud when it cannot.
//
// Frames arrive from the host. grapht does not parse mermaid or d2, so a fence block becomes a
// `block` item when a document is projected and becomes a `fence` item when whoever rendered it
// hands the frame over (`withFence`).
import { type MdAddress, type MdDocument, mdAddressIndex, relocateAddress } from "@hafley66/grapht-model"
import type { GraphFrame } from "../2_graph/0_frame.js"
import type { SealedSvgArtifact } from "../2_graph/3_sealedSvgArtifact.js"
import type { MoveHistory } from "../2_graph/23_manualMovement.js"

export const BOARD_FORMAT = "grapht-board/0"

/** One document revision the board was built from. The `docHash` is the one `MdAddress` pins. */
export type BoardSource = { path: string; docHash: string }

/** A block of prose or a heading: addressable, and nothing more until a frame says otherwise. */
export type BoardBlockItem = { kind: "block"; itemId: string; blockId: string; address: MdAddress }

/** A fence whose diagram the host has already rendered. */
export type BoardFenceItem = {
  kind: "fence"
  itemId: string
  blockId: string
  address: MdAddress
  frame: GraphFrame
}

/** Something a person wrote on the board. It may carry an address when it was pinned to prose. */
export type BoardStickyItem = { kind: "sticky"; itemId: string; text: string; address?: MdAddress }

/** A sealed SVG the board holds whole, from a file the host opened rather than a fence. */
export type BoardSvgItem = { kind: "svg"; itemId: string; artifact: SealedSvgArtifact; address?: MdAddress }

export type BoardItem = BoardBlockItem | BoardFenceItem | BoardStickyItem | BoardSvgItem

export type BoardPlacement = { itemId: string; x: number; y: number; z: number }

export type Board = {
  format: typeof BOARD_FORMAT
  id: string
  sources: readonly BoardSource[]
  items: readonly BoardItem[]
  placements: readonly BoardPlacement[]
}

export type BoardAnomaly = { kind: string; detail: string }

/** What relocation did to one item, so a caller can show it rather than guess. */
export type BoardRelocation = { from: string; to: string; blockId: string }
export type BoardOrphan = { item: BoardItem; reason: "missing" | "ambiguous" }

export type BoardReconciliation = {
  board: Board
  moved: readonly BoardRelocation[]
  orphaned: readonly BoardOrphan[]
}

const placementOf = (board: Board, itemId: string): BoardPlacement | undefined =>
  board.placements.find(placement => placement.itemId === itemId)

/** The two item kinds that came from a block, and so can name one. */
type AddressableItem = BoardBlockItem | BoardFenceItem
const isAddressable = (item: BoardItem): item is AddressableItem => item.kind === "block" || item.kind === "fence"

function requireItem(board: Board, itemId: string): BoardItem {
  const item = board.items.find(candidate => candidate.itemId === itemId)
  if (!item) throw new Error(`board ${board.id}: no item ${itemId}`)
  return item
}

/**
 * A document's blocks as board items. Every block becomes a `block` item; a fence becomes one too,
 * until a host that rendered it calls `withFence`. Sections are not items yet: the markdown graph
 * already groups blocks by heading, and a section earns a board item when a person places one.
 */
export async function boardFromDocuments(id: string, documents: readonly MdDocument[]): Promise<Board> {
  const sources: BoardSource[] = []
  const items: BoardItem[] = []
  for (const document of documents) {
    const index = await mdAddressIndex(document)
    sources.push({ path: index.path, docHash: index.docHash })
    for (const block of document.blocks) {
      const address = index.byBlockId.get(block.id)
      if (!address) continue
      items.push({ kind: "block", itemId: address.locatorHash, blockId: block.id, address })
    }
  }
  return { format: BOARD_FORMAT, id, sources, items, placements: [] }
}

/** Promote a block to a fence, keeping its place: the frame sharpens the item, it does not replace it. */
export function withFence(board: Board, fence: { blockId: string; frame: GraphFrame }): Board {
  const item = board.items.find(
    (candidate): candidate is AddressableItem => isAddressable(candidate) && candidate.blockId === fence.blockId,
  )
  if (!item) throw new Error(`board ${board.id}: no block ${fence.blockId} to give a frame`)
  const promoted: BoardFenceItem = {
    kind: "fence",
    itemId: item.itemId,
    blockId: item.blockId,
    address: item.address,
    frame: fence.frame,
  }
  return { ...board, items: board.items.map(candidate => (candidate.itemId === item.itemId ? promoted : candidate)) }
}

/** Put an item somewhere. An item already placed moves; one that was not gains a placement. */
export function placeItem(board: Board, itemId: string, at: { x: number; y: number; z?: number }): Board {
  requireItem(board, itemId)
  const existing = placementOf(board, itemId)
  const placement: BoardPlacement = { itemId, x: at.x, y: at.y, z: at.z ?? existing?.z ?? 0 }
  const placements = existing
    ? board.placements.map(candidate => (candidate.itemId === itemId ? placement : candidate))
    : [...board.placements, placement]
  return { ...board, placements }
}

/** Nudge placed items. An item with no placement yet is placed at its delta, because a gesture on it moved it from nowhere. */
export function moveItems(board: Board, moves: readonly { itemId: string; dx: number; dy: number }[]): Board {
  let next = board
  for (const move of moves) {
    const existing = placementOf(next, move.itemId)
    next = placeItem(next, move.itemId, {
      x: (existing?.x ?? 0) + move.dx,
      y: (existing?.y ?? 0) + move.dy,
      z: existing?.z,
    })
  }
  return next
}

/**
 * The movement journal folded into placements — the call a board makes when it writes itself out.
 * The cursor is a prefix length, exactly as `movementOffsets` reads it, so an undone gesture
 * un-moves the board.
 */
export function foldMoves(board: Board, history: MoveHistory): Board {
  const replayed = history.events.slice(0, Math.max(0, Math.min(history.cursor, history.events.length)))
  return moveItems(
    board,
    replayed.map(event => ({ itemId: event.id, dx: event.dx, dy: event.dy })),
  )
}

/**
 * Carry a board onto new document revisions. An item whose text still hashes the same keeps its id
 * and its placement; one that moved inside its document is re-anchored and its placement follows the
 * new id; one that cannot be found is reported as an orphan and dropped, never silently moved.
 */
export async function reconcileBoard(previous: Board, documents: readonly MdDocument[]): Promise<BoardReconciliation> {
  const byPath = new Map<string, MdDocument>()
  for (const document of documents) byPath.set(document.path, document)

  const sources: BoardSource[] = []
  const indexes = new Map<string, Awaited<ReturnType<typeof mdAddressIndex>>>()
  for (const document of documents) {
    const index = await mdAddressIndex(document)
    indexes.set(document.path, index)
    sources.push({ path: index.path, docHash: index.docHash })
  }

  const items: BoardItem[] = []
  const moved: BoardRelocation[] = []
  const orphaned: BoardOrphan[] = []
  /** Placements are re-keyed through the same walk, so a renamed id does not lose its position. */
  const keying = new Map<string, string>()

  /** A block keeps its placement by taking the new id; a sticky keeps its own id and follows the block. */
  const rebuilt = (item: BoardItem, next: MdAddress): BoardItem => {
    if (item.kind === "sticky" || item.kind === "svg") return { ...item, address: next }
    return { ...item, itemId: next.locatorHash, blockId: next.blockId, address: next }
  }

  for (const item of previous.items) {
    const address = "address" in item ? item.address : undefined
    const document = address ? byPath.get(address.path) : undefined
    if (!address || !document) {
      items.push(item)
      continue
    }
    const relocation = await relocateAddress(address, document)
    if (relocation.state === "orphaned") {
      orphaned.push({ item, reason: relocation.reason })
      continue
    }
    const next = relocation.address
    if (isAddressable(item) && next.locatorHash !== item.itemId) {
      keying.set(item.itemId, next.locatorHash)
      moved.push({ from: item.itemId, to: next.locatorHash, blockId: next.blockId })
    }
    items.push(rebuilt(item, next))
  }

  const placementFor = (placement: BoardPlacement): BoardPlacement => {
    const itemId = keying.get(placement.itemId) ?? placement.itemId
    return { ...placement, itemId }
  }
  const placements = previous.placements
    .filter(placement => items.some(item => item.itemId === (keying.get(placement.itemId) ?? placement.itemId)))
    .map(placementFor)

  return { board: { ...previous, sources, items, placements }, moved, orphaned }
}

/**
 * What is wrong with a board, named. A placement for an item that is not there, an item nobody
 * placed, a source listed twice, two items under one id, an item claiming a document the sources do
 * not name. Reading is when a board is checked; drawing it is not the place to discover this.
 */
export function validateBoard(board: Board): BoardAnomaly[] {
  const anomalies: BoardAnomaly[] = []
  if (board.format !== BOARD_FORMAT) anomalies.push({ kind: "format", detail: `unknown format ${String(board.format)}` })

  const ids = new Set<string>()
  for (const item of board.items) {
    if (ids.has(item.itemId)) anomalies.push({ kind: "duplicate-item", detail: item.itemId })
    ids.add(item.itemId)
  }

  const placed = new Set<string>()
  for (const placement of board.placements) {
    if (placed.has(placement.itemId)) anomalies.push({ kind: "duplicate-placement", detail: placement.itemId })
    placed.add(placement.itemId)
    if (!ids.has(placement.itemId)) anomalies.push({ kind: "placement-without-item", detail: placement.itemId })
  }
  for (const item of board.items) {
    if (!placed.has(item.itemId)) anomalies.push({ kind: "item-without-placement", detail: item.itemId })
  }

  const paths = new Set<string>()
  for (const source of board.sources) {
    if (paths.has(source.path)) anomalies.push({ kind: "duplicate-source", detail: source.path })
    paths.add(source.path)
  }
  for (const item of board.items) {
    if ("address" in item && item.address && !paths.has(item.address.path)) {
      anomalies.push({ kind: "item-without-source", detail: `${item.itemId} → ${item.address.path}` })
    }
  }
  return anomalies
}

/** One artifact on one line per board, so a diff of a board reads as a diff of what changed. */
export function printBoard(board: Board): string {
  return `${JSON.stringify(board, null, 2)}\n`
}

/** Reads a board and refuses anything else. What a caller draws is what the file said, or an error. */
export function parseBoard(text: string): Board {
  const parsed: unknown = JSON.parse(text)
  const format = (parsed as { format?: unknown } | null)?.format
  if (format !== BOARD_FORMAT) throw new Error(`not a ${BOARD_FORMAT} board: ${String(format)}`)
  return parsed as Board
}
