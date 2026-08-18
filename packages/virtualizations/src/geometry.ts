/**
 * Pure scroll geometry for virtualized content.
 *
 * This module owns scroll ownership, parent-offset translation, and visible
 * range math. It never touches rows, DOM elements (other than reading computed
 * overflow), or TanStack. Consumers (grids, lists, trees) supply extents and
 * viewport sizes and get indexes and offsets back.
 */

export type VirtualRange = { start: number; end: number }

export function findScrollOwner(element: HTMLElement | null) {
  for (let parent = element?.parentElement; parent; parent = parent.parentElement) {
    const overflowY = getComputedStyle(parent).overflowY
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") return parent
  }
  return null
}

export function localVirtualOffset(scrollOffset: number, contentOrigin: number, extent: number) {
  return Math.max(0, Math.min(extent, scrollOffset - contentOrigin))
}

export function visibleVirtualRange({
  count,
  estimateSize,
  offset,
  viewportHeight,
  leading = 0,
  trailing = 0,
}: {
  count: number
  estimateSize: number
  offset: number
  viewportHeight: number
  leading?: number
  trailing?: number
}): VirtualRange {
  if (!count) return { start: -1, end: -1 }
  const start = Math.min(count - 1, Math.floor(offset / estimateSize))
  const visibleHeight = Math.max(0, viewportHeight - leading - trailing)
  return {
    start,
    end: Math.min(count - 1, Math.max(start, Math.ceil((offset + visibleHeight) / estimateSize) - 1)),
  }
}

export function viewportCapStyle(extent: number) {
  return { height: `min(100dvh, ${extent}px)`, maxHeight: "100vh" }
}
