/**
 * Extraction boundary for a future @hafley66/virtualizations package.
 *
 * Candidate public surface:
 * - findScrollOwner(element: HTMLElement | null): HTMLElement | null
 * - measureContentOrigin(root: HTMLElement, owner: HTMLElement | null): number
 * - localVirtualOffset(scrollOffset: number, contentOrigin: number, extent: number): number
 * - visibleVirtualRange(options: VisibleRangeOptions): VirtualRange
 * - viewportCapStyle(extent: number): { height: string; maxHeight: string }
 * - useExternalVirtualizerLifecycle(options): { owner, origin, viewport }
 *
 * This boundary owns scroll ownership, geometry, resize lifecycle, and range
 * math. Grid owns TanStack row materialization, table markup, row measurement,
 * sorting, pagination, and mapping a virtual index to a table row.
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
