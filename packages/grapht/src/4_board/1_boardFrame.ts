// A board drawn: one node per item, bounds from the placement, and a camera that fits.
//
// The frame is the whole surface. Renderers already take a `GraphFrame`, so a board needs no
// renderer contract of its own — this projection is the one seam between "items in places" and
// "something a renderer paints", and every board surface (node renderer, gesture layer, pin layer)
// reads it.
import { documentFingerprint, type GraphId, type GraphItem } from "@hafley66/grapht-model"
import type { Rect } from "../1_sequence/3_geometry.js"
import type { GraphFrame, GraphGeometry, GraphLabel } from "../2_graph/0_frame.js"
import { fitGraphCamera } from "../2_graph/1_fitCamera.js"
import { EMPTY_SEALED_SVG_ARTIFACTS_BY_ROOT_ID } from "../2_graph/3_sealedSvgArtifact.js"
import type { Board, BoardItem } from "./0_board.js"
import { unplacedStack } from "./0_board.js"

/** Screen-space margin the fitted camera leaves, in world units. */
const VIEWPORT_PADDING = 24

export type BoardFrameOptions = {
  /** Measured size of one item, and the label to paint on it when the host has one. */
  size(item: BoardItem): { width: number; height: number; label?: string }
  viewport: { width: number; height: number }
}

/**
 * Projects a board onto a frame. Nodes are the items themselves, so a per-item renderer paints
 * what the document said; placement supplies position, the host supplies size, and nothing here
 * opens the document.
 */
export function boardFrame(board: Board, options: BoardFrameOptions): GraphFrame<BoardItem> {
  const graph: Record<GraphId, GraphItem<BoardItem>> = {}
  const boundsById: Record<GraphId, Rect> = {}
  const labelsById: Record<GraphId, GraphLabel> = {}
  const placementByItemId = new Map(board.placements.map(placement => [placement.itemId, placement]))

  // Once per item: a host may measure with a layout pass, and the size is needed for bounds and for
  // the stack below. The stack itself is `unplacedStack`'s rule, not a second copy of it.
  const sizes = new Map(board.items.map((item): [string, ReturnType<BoardFrameOptions["size"]>] => [item.itemId, options.size(item)]))
  const stack = unplacedStack(board, item => sizes.get(item.itemId)?.height ?? 0)

  for (const item of board.items) {
    const size = sizes.get(item.itemId)
    if (size === undefined) continue
    const placement = placementByItemId.get(item.itemId)
    const x = placement ? placement.x : 0
    const y = placement ? placement.y : (stack.get(item.itemId) ?? 0)
    graph[item.itemId] = { id: item.itemId, type: "node", data: item }
    boundsById[item.itemId] = { x, y, width: size.width, height: size.height }
    if (size.label !== undefined) labelsById[item.itemId] = { text: size.label }
  }

  // The revision is the placed geometry, sorted by item id and serialized — not a timestamp and not
  // a counter, so two builds of the same board agree and any move disagrees. Upstream memoization
  // keys on this string, which is why the viewport is left out: the camera is derived from the
  // geometry, not part of it.
  const revisionId = `geometry:board:${documentFingerprint(
    Object.keys(boundsById)
      .sort()
      .map(itemId => [itemId, boundsById[itemId], labelsById[itemId]?.text ?? null]),
  )}`

  const geometry: GraphGeometry = {
    revisionId,
    boundsById,
    // A board is items in places, not topology: `markdownGraph` owns the links between blocks, so
    // there is nothing here to anchor, to route, or to pin as a header.
    endpointAnchorById: {},
    routesById: {},
    headerBoundsById: {},
  }

  return {
    graph,
    geometry,
    camera: fitGraphCamera(geometry, { x: 0, y: 0, ...options.viewport }, VIEWPORT_PADDING),
    presentation: {
      stickyHeaders: [],
      hiddenIds: new Set(),
      focusedIds: new Set(),
      // An item carries its own paint — a fence its frame, an SVG item its sealed artifact — so the
      // labels the host measured are the only presentation the board itself computes.
      labelsById,
      sealedSvgArtifactsByRootId: EMPTY_SEALED_SVG_ARTIFACTS_BY_ROOT_ID,
    },
  }
}