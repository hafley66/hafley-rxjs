import { useLayoutEffect, useRef, useState } from "react"
import { useVirtualizer, useWindowVirtualizer } from "@tanstack/react-virtual"
import {
  findScrollOwner,
  localVirtualOffset,
  visibleVirtualRange,
} from "./4a_virtualizationBoundary"

export type GridScrollMode = "external" | "internal"

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

// Grid's adapter over the future @hafley66/virtualizations lifecycle. TanStack
// Virtual supplies row measurement and overscan; the boundary module owns the
// parent-scroll geometry that is independent of table rows.
export function useExternalGridVirtualizer({
  count,
  estimateSize,
  enabled,
  scrollElement,
}: {
  count: number
  estimateSize: number
  enabled: boolean
  scrollElement?: HTMLElement | null
}) {
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

  const common = {
    count,
    estimateSize: () => estimateSize,
    getItemKey: (index: number) => index,
    overscan: 4,
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
  const virtualizer = metrics.owner ? ancestorVirtualizer : documentVirtualizer
  const localOffset = localVirtualOffset(
    metrics.owner?.scrollTop ?? window.scrollY,
    metrics.scrollMargin,
    count * estimateSize,
  )
  const range = visibleVirtualRange({
    count,
    estimateSize,
    offset: localOffset,
    viewportHeight: metrics.viewportHeight,
    leading: metrics.headerHeight,
    trailing: FOOTER_HEIGHT,
  })

  return {
    rootRef,
    headerRef,
    virtualizer,
    virtual: enabled,
    viewportHeight: metrics.viewportHeight,
    headerHeight: metrics.headerHeight,
    visibleStart: range.start,
    visibleEnd: range.end,
    footerHeight: FOOTER_HEIGHT,
  }
}
