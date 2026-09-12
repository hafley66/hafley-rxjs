import { defer, finalize, tap } from "rxjs"
import type { GraphId } from "@hafley66/grapht-model"
import type { GraphFrame } from "./0_frame.js"
import type { GraphRenderer } from "./7_operatorTypes.js"

export type GraphRenderReceipt = {
  enterIds: readonly GraphId[]
  updateIds: readonly GraphId[]
  exitIds: readonly GraphId[]
}

export type GraphFrameResource<NodeData = unknown, EdgeData = unknown> = {
  render(frame: GraphFrame<NodeData, EdgeData>, receipt: GraphRenderReceipt): void
  unsubscribe(): void
}

function sortedIds(frame: GraphFrame): GraphId[] {
  return Object.keys(frame.graph).sort()
}

export function graphRenderReceipt(previousIds: ReadonlySet<GraphId>, frame: GraphFrame): GraphRenderReceipt {
  const currentIds = new Set(sortedIds(frame))
  return {
    enterIds: [...currentIds].filter(id => !previousIds.has(id)).sort(),
    updateIds: [...currentIds].filter(id => previousIds.has(id)).sort(),
    exitIds: [...previousIds].filter(id => !currentIds.has(id)).sort(),
  }
}

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
