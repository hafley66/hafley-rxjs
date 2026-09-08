import type { MarbleEvent } from "./0_types.js"
import type { TimeRange } from "./0a_TimeViewport.js"

// Flamegraph extents: own span unioned with every descendant span, so a null-timed parent still
// draws. Depth comes from the source tree, not the expanded row model, so collapsing moves nothing.
export type AggregateExtent = {
  id: string
  depth: number
  start: number | null
  end: number | null
  duration: number | null
}

export type FlameNode = {
  id: string
  name: string
  type: string
  depth: number
  start: number
  end: number
  event: MarbleEvent
}

function ownEnd(event: MarbleEvent): number | null {
  if (event.start === null) return null
  return event.duration === null ? event.start : event.start + event.duration
}

export function aggregateExtents(rows: readonly MarbleEvent[]): Map<string, AggregateExtent> {
  const extents = new Map<string, AggregateExtent>()
  const visit = (event: MarbleEvent, depth: number): AggregateExtent => {
    let start = event.start
    let end = ownEnd(event)
    for (const child of event.children ?? []) {
      const childExtent = visit(child, depth + 1)
      if (childExtent.start !== null) start = start === null ? childExtent.start : Math.min(start, childExtent.start)
      if (childExtent.end !== null) end = end === null ? childExtent.end : Math.max(end, childExtent.end)
    }
    const extent: AggregateExtent = {
      id: event.id,
      depth,
      start,
      end,
      duration: start === null || end === null ? null : end - start,
    }
    extents.set(event.id, extent)
    return extent
  }
  for (const row of rows) visit(row, 0)
  return extents
}

// Time column: the aggregate wins when a row's own duration is missing or narrower than its subtree.
export function displayDuration(event: MarbleEvent, extent?: AggregateExtent): number | null {
  const aggregate = extent?.duration ?? null
  if (event.duration === null) return aggregate
  if (aggregate !== null && aggregate > event.duration) return aggregate
  return event.duration
}

// Pre-order walk: children follow their parent, so a flame strip reads top-down like the tree.
export function flameNodes(rows: readonly MarbleEvent[], extents: ReadonlyMap<string, AggregateExtent> = aggregateExtents(rows)): FlameNode[] {
  const nodes: FlameNode[] = []
  const walk = (level: readonly MarbleEvent[]) => {
    for (const event of level) {
      const extent = extents.get(event.id)
      if (extent && extent.start !== null && extent.end !== null) {
        nodes.push({ id: event.id, name: event.name, type: event.type, depth: extent.depth, start: extent.start, end: extent.end, event })
      }
      if (event.children?.length) walk(event.children)
    }
  }
  walk(rows)
  return nodes
}

export function flameDepth(nodes: readonly FlameNode[]): number {
  return nodes.reduce((max, node) => Math.max(max, node.depth + 1), 1)
}

// eventRange only sees top-level rows; a viewport built from a tree has to include the descendants.
export function extentRange(rows: readonly MarbleEvent[]): TimeRange {
  let start: number | null = null
  let end: number | null = null
  for (const extent of aggregateExtents(rows).values()) {
    if (extent.start !== null) start = start === null ? extent.start : Math.min(start, extent.start)
    if (extent.end !== null) end = end === null ? extent.end : Math.max(end, extent.end)
  }
  return start === null || end === null ? [0, 1] : [start, end]
}
