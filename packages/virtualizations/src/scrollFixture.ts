// Test-only geometry for the scroll primitives. A real browser clamps a
// scrollLeft write that has nowhere to go, so the fixtures build actual scroll
// containers: a fixed box with overflowing content.

/** A fixed-size scroll container with content that overflows it. */
export function scrollBox(axis: "x" | "y", client = 200, extent = 1000): HTMLElement {
  const box = document.createElement("div")
  box.style.cssText =
    axis === "x"
      ? `position:absolute;top:0;left:0;width:${client}px;height:20px;overflow:hidden`
      : `position:absolute;top:0;left:0;width:20px;height:${client}px;overflow:hidden`
  const inner = document.createElement("div")
  inner.style.cssText = axis === "x" ? `width:${extent}px;height:1px` : `width:1px;height:${extent}px`
  box.append(inner)
  document.body.append(box)
  return box
}

/** A host box sized like a scrollbar strip, for the phantom track to live in. */
export function trackHost(): HTMLElement {
  const host = document.createElement("div")
  host.style.cssText = "position:absolute;top:0;left:0;width:200px;height:20px;overflow:hidden"
  document.body.append(host)
  return host
}
