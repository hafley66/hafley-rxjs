export type ScrollAxis = "x" | "y"

export type ScrollSyncOptions = {
  axis?: ScrollAxis
  bidirectional?: boolean
}

const SCROLL_KEY: Record<ScrollAxis, "scrollLeft" | "scrollTop"> = {
  x: "scrollLeft",
  y: "scrollTop",
}

// Keeps one element's scroll offset mirrored on another for a single axis.
// Value-guarded: each side remembers the last value it wrote, so an event
// echoing our own write is ignored instead of re-propagating (no ping-pong).
// Listens passively; returns a dispose function. Creates no DOM.
export function syncScroll(
  source: HTMLElement,
  target: HTMLElement,
  { axis = "x", bidirectional = false }: ScrollSyncOptions = {},
) {
  const key = SCROLL_KEY[axis]
  let lastSource = source[key]
  let lastTarget = target[key]

  const onSource = () => {
    const value = source[key]
    if (value === lastSource) return
    lastSource = value
    lastTarget = value
    target[key] = value
  }
  const onTarget = () => {
    const value = target[key]
    if (value === lastTarget) return
    lastTarget = value
    lastSource = value
    source[key] = value
  }

  source.addEventListener("scroll", onSource, { passive: true })
  if (bidirectional) target.addEventListener("scroll", onTarget, { passive: true })

  return () => {
    source.removeEventListener("scroll", onSource)
    if (bidirectional) target.removeEventListener("scroll", onTarget)
  }
}
