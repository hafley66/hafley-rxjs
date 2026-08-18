import { useLayoutEffect, useRef, useState } from "react"
import { useVirtualizer, useWindowVirtualizer } from "@tanstack/react-virtual"
import {
  findScrollOwner,
  localVirtualOffset,
  visibleVirtualRange,
} from "./geometry"

export type ScrollMode = "external" | "internal"

export type UseExternalVirtualizerOptions = {
  count: number
  estimateSize: number
  enabled: boolean
  scrollElement?: HTMLElement | null
  /** Buffer rows per side, in rows. Defaults to ~1 viewport of rows. */
  overscan?: number
}

type Metrics = {
  owner: HTMLElement | null
  scrollMargin: number
  viewportHeight: number
  headerHeight: number
}

const FALLBACK_HEADER_HEIGHT = 36
const FOOTER_HEIGHT = 33

function equalMetrics(a: Metrics, b: Metrics) {
  return a.owner === b.owner
    && a.scrollMargin === b.scrollMargin
    && a.viewportHeight === b.viewportHeight
    && a.headerHeight === b.headerHeight
}

// Framework-free adapter over TanStack react-virtual. Owns scroll-owner
// discovery, geometry/resize lifecycle, the overscan buffer policy, and the
// window translate math, so consumers get a render-ready item window and the
// sub-row translate needed for smooth buffered scrolling. The `tanstack` field
// is the raw virtualizer as an escape hatch.
export function useExternalVirtualizer({
  count,
  estimateSize,
  enabled,
  scrollElement,
  overscan,
}: UseExternalVirtualizerOptions) {
  const rootRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLTableSectionElement>(null)
  const [metrics, setMetrics] = useState<Metrics>({
    owner: null,
    scrollMargin: 0,
    viewportHeight: typeof window === "undefined" ? 0 : window.innerHeight,
    headerHeight: FALLBACK_HEADER_HEIGHT,
  })

  useLayoutEffect(() => {
    let frame = 0
    const update = () => {
      const root = rootRef.current
      const owner = scrollElement ?? findScrollOwner(root)
      const rootRect = root?.getBoundingClientRect()
      const ownerRect = owner?.getBoundingClientRect()
      const next: Metrics = {
        owner,
        // TanStack's scrollMargin moves a document or ancestor offset into the
        // virtualizer's coordinate system. It changes with preceding content.
        scrollMargin: rootRect
          ? owner && ownerRect
            ? rootRect.top - ownerRect.top + owner.scrollTop
            : rootRect.top + window.scrollY
          : 0,
        viewportHeight: owner?.clientHeight ?? window.innerHeight,
        headerHeight: Math.ceil(headerRef.current?.getBoundingClientRect().height ?? FALLBACK_HEADER_HEIGHT),
      }
      setMetrics((previous) => equalMetrics(previous, next) ? previous : next)
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("resize", schedule)
    window.addEventListener("scroll", schedule, true)
    const observer = new ResizeObserver(schedule)
    if (rootRef.current) observer.observe(rootRef.current)
    if (headerRef.current) observer.observe(headerRef.current)
    if (scrollElement) observer.observe(scrollElement)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", schedule)
      window.removeEventListener("scroll", schedule, true)
      observer.disconnect()
    }
  }, [scrollElement])

  const bufferOverscan = overscan ?? Math.max(4, Math.ceil(metrics.viewportHeight / Math.max(1, estimateSize)))
  const common = {
    count,
    estimateSize: () => estimateSize,
    getItemKey: (index: number) => index,
    overscan: bufferOverscan,
    scrollMargin: metrics.scrollMargin,
  }
  const ancestorVirtualizer = useVirtualizer<HTMLElement, HTMLTableRowElement>({
    ...common,
    enabled: enabled && metrics.owner !== null,
    getScrollElement: () => metrics.owner,
  })
  const documentVirtualizer = useWindowVirtualizer<HTMLTableRowElement>({
    ...common,
    enabled: enabled && metrics.owner === null,
  })
  const tanstack = metrics.owner ? ancestorVirtualizer : documentVirtualizer

  const scrollOffset = metrics.owner?.scrollTop ?? window.scrollY
  const totalSize = tanstack.getTotalSize()
  const localOffset = localVirtualOffset(
    scrollOffset,
    metrics.scrollMargin,
    totalSize,
  )

  // Buffered window: render the full item list (visible ± overscan), not the
  // strictly-visible subset. Buffered/partial rows above the clip get a
  // negative translate so sub-row scroll positions land correctly.
  const items = enabled && count ? tanstack.getVirtualItems() : []
  const firstItem = items[0]
  const translateY = firstItem ? Math.min(0, firstItem.start - metrics.scrollMargin - localOffset) : 0

  // Preserves the "terminal range shrinks to intrinsic height" behavior: as
  // the local offset approaches the extent, the window collapses around the
  // remaining rows instead of floating above empty space.
  const liveViewportHeight = Math.min(
    metrics.viewportHeight,
    metrics.headerHeight + Math.max(0, totalSize - localOffset) + FOOTER_HEIGHT,
  )

  const estimatedRange = visibleVirtualRange({
    count,
    estimateSize,
    offset: localOffset,
    viewportHeight: metrics.viewportHeight,
    leading: metrics.headerHeight,
    trailing: FOOTER_HEIGHT,
  })
  const visibleHeight = Math.max(0, metrics.viewportHeight - metrics.headerHeight - FOOTER_HEIGHT)
  const range = count ? {
    // TanStack stores measurement starts in scroll-owner coordinates when a
    // scrollMargin is supplied. The fallback range remains grid-local.
    start: tanstack.getVirtualItemForOffset(scrollOffset)?.index ?? estimatedRange.start,
    end: tanstack.getVirtualItemForOffset(scrollOffset + visibleHeight)?.index ?? estimatedRange.end,
  } : estimatedRange

  return {
    rootRef,
    headerRef,
    virtual: enabled,
    items,
    translateY,
    totalSize,
    estimatedSize: count * estimateSize,
    scrollOwner: metrics.owner ? "ancestor" as const : "window" as const,
    scrollMargin: metrics.scrollMargin,
    viewportHeight: metrics.viewportHeight,
    headerHeight: metrics.headerHeight,
    visibleStart: range.start,
    visibleEnd: range.end,
    footerHeight: FOOTER_HEIGHT,
    liveViewportHeight,
    measureElement: tanstack.measureElement,
    tanstack,
  }
}
