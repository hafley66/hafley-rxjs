// Project graph frames through one renderer resource for each stream lifetime.
import { defer, finalize, tap } from "rxjs"
import type { GraphId } from "@hafley66/grapht-model"
import type { GraphFrame } from "./0_frame.js"
import type { GraphRenderer } from "./7_operatorTypes.js"

/** ID membership changes between frames; update IDs include every retained item, regardless of content equality. */
export type GraphRenderReceipt = {
  enterIds: readonly GraphId[]
  updateIds: readonly GraphId[]
  exitIds: readonly GraphId[]
}

/** A renderer-owned resource that accepts frames and releases its listeners and elements through unsubscribe. */
export type GraphFrameResource<NodeData = unknown, EdgeData = unknown> = {
  render(frame: GraphFrame<NodeData, EdgeData>, receipt: GraphRenderReceipt): void
  unsubscribe(): void
}

function sortedIds(frame: GraphFrame): GraphId[] {
  return Object.keys(frame.graph).sort()
}

/** Compare current graph IDs with the prior set and return sorted enter, update, and exit lists. */
export function graphRenderReceipt(previousIds: ReadonlySet<GraphId>, frame: GraphFrame): GraphRenderReceipt {
  const currentIds = new Set(sortedIds(frame))
  return {
    enterIds: [...currentIds].filter(id => !previousIds.has(id)).sort(),
    updateIds: [...currentIds].filter(id => previousIds.has(id)).sort(),
    exitIds: [...previousIds].filter(id => !currentIds.has(id)).sort(),
  }
}

/**
 * Return a renderer operator that acquires its resource when the caller activates the stream.
 * Each frame carries an ID receipt; completion, error, or unsubscription releases the resource.
 * The returned stream leaves activation and cancellation at the caller's boundary.
 */
export function graphRenderer<NodeData = unknown, EdgeData = unknown>(
  acquire: (host: HTMLElement) => GraphFrameResource<NodeData, EdgeData>,
): GraphRenderer<NodeData, EdgeData> {
  return host =>
    source$ =>
      defer(() => {
        const resource = acquire(host)
        let previousIds = new Set<GraphId>()
        return source$.pipe(
          tap(frame => {
            const receipt = graphRenderReceipt(previousIds, frame)
            resource.render(frame, receipt)
            previousIds = new Set(sortedIds(frame))
          }),
          finalize(() => resource.unsubscribe()),
        )
      })
}
