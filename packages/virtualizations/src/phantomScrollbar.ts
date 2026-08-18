import { syncScroll, type ScrollAxis } from "./scrollSync"

export type PhantomScrollbarOptions = {
  host: HTMLElement
  content: HTMLElement
  axis?: ScrollAxis
  onOverflowChange?: (overflowing: boolean) => void
}

export type PhantomScrollbar = {
  track: HTMLDivElement
  update: () => void
  dispose: () => void
}

const EXTENT_KEY: Record<ScrollAxis, "scrollWidth" | "scrollHeight"> = {
  x: "scrollWidth",
  y: "scrollHeight",
}
const CLIENT_KEY: Record<ScrollAxis, "clientWidth" | "clientHeight"> = {
  x: "clientWidth",
  y: "clientHeight",
}
const SIZE_KEY: Record<ScrollAxis, "width" | "height"> = {
  x: "width",
  y: "height",
}

// Creates a native scrollbar strip that mirrors `content`'s extent. The strip
// lives in `host` (anywhere, portal-friendly) while `content` stays clipped
// and non-scrollable. Scrolling the strip pans `content`; x-swipe wheel
// gestures over `content` forward to the strip. Hides itself when `content`
// fits. Returns the track element plus update/dispose handles.
export function attachPhantomScrollbar({
  host,
  content,
  axis = "x",
  onOverflowChange,
}: PhantomScrollbarOptions): PhantomScrollbar {
  const extentKey = EXTENT_KEY[axis]
  const clientKey = CLIENT_KEY[axis]
  const sizeKey = SIZE_KEY[axis]
  const scrollKey = axis === "x" ? "scrollLeft" : "scrollTop"

  const track = document.createElement("div")
  track.style.overflowX = axis === "x" ? "auto" : "hidden"
  track.style.overflowY = axis === "x" ? "hidden" : "auto"
  track.dataset.scrollAxis = axis
  const sizer = document.createElement("div")
  sizer.style.cssText = "pointer-events:none"
  if (axis === "x") sizer.style.height = "1px"
  else sizer.style.width = "1px"
  track.append(sizer)
  host.append(track)

  let reported: boolean | null = null
  const update = () => {
    // Mirror the content's resolved scrollbar styling so the strip looks like
    // the bar the content would have drawn. Only the standard properties are
    // readable; `::-webkit-scrollbar` pseudo styles are not, so webkit themes
    // target `[data-scroll-axis]` in CSS instead.
    const resolved = getComputedStyle(content)
    track.style.scrollbarWidth = resolved.scrollbarWidth
    track.style.scrollbarColor = resolved.scrollbarColor
    const extent = content[extentKey] || 0
    sizer.style[sizeKey] = `${extent}px`
    const overflowing = extent > content[clientKey]
    // Always reflect the current visibility; the sizer extent forces the strip
    // to the clipped width, and a non-overflowing content hides the strip.
    track.style.display = overflowing ? "" : "none"
    if (overflowing !== reported) {
      reported = overflowing
      onOverflowChange?.(overflowing)
    }
  }

  const disposeScrollSync = syncScroll(content, track, { axis, bidirectional: true })

  const onWheel = (event: WheelEvent) => {
    if (!reported) return
    const delta = axis === "x" ? event.deltaX : event.deltaY
    const cross = axis === "x" ? event.deltaY : event.deltaX
    if (Math.abs(delta) > Math.abs(cross)) {
      track[scrollKey] += delta
      event.preventDefault()
    }
  }
  content.addEventListener("wheel", onWheel, { passive: false })

  let observer: ResizeObserver | undefined
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(update)
    observer.observe(content)
    observer.observe(track)
  }

  update()

  return {
    track,
    update,
    dispose: () => {
      disposeScrollSync()
      content.removeEventListener("wheel", onWheel)
      observer?.disconnect()
      track.remove()
    },
  }
}
