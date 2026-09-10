// The recording is the deliverable, so the page has to narrate itself while it is being filmed.
//
// Nothing in this file may reach an assertion. Every element it adds sits outside the grid root,
// carries `pointer-events: none` so playwright's actionability hit test still lands on the cell
// underneath, and uses an id no `selectorFor()` query can match.
import type { Page } from "playwright"

const CAPTION_ID = "sg-caption"
const CURSOR_ID = "sg-cursor"

/** Long enough for a viewer to register the change, short enough to keep a five-scene run honest. */
export const BEAT_MS = 400

/**
 * A fixed banner naming the action that is about to happen.
 *
 * Anchored to the bottom edge: the grid header sits at the top of the mount host, and a banner over
 * it would hide the band that half these scenes are about.
 */
export async function caption(page: Page, text: string): Promise<void> {
  await page.evaluate(
    ([id, message]) => {
      let el = document.getElementById(id)
      if (el === null) {
        el = document.createElement("div")
        el.id = id
        el.style.cssText = [
          "position:fixed",
          "inset-inline:0",
          "inset-block-end:0",
          "z-index:2147483647",
          "pointer-events:none",
          "padding:10px 16px",
          "font:600 16px/1.4 ui-monospace,SFMono-Regular,monospace",
          "color:#f7f9fc",
          "background:rgba(12,14,18,.92)",
          "border-block-start:2px solid #6ea8fe",
        ].join(";")
        document.body.append(el)
      }
      el.textContent = message
    },
    [CAPTION_ID, text] as const,
  )
}

/** A deliberate pause. A state change with no dwell either side reads as one frame of nothing. */
export async function beat(page: Page, ms: number = BEAT_MS): Promise<void> {
  await page.waitForTimeout(ms)
}

/**
 * Caption, dwell, act, dwell. Returns whatever the action returned, so a step can still be the
 * expression a later assertion reads.
 */
export async function step<T>(page: Page, text: string, fn: () => Promise<T>): Promise<T> {
  await caption(page, text)
  await beat(page)
  const result = await fn()
  await beat(page)
  return result
}

/**
 * A drawn cursor tracking the real pointer.
 *
 * `page.mouse` moves the browser's input pointer, which chromium does not paint into a video frame,
 * so a drag would otherwise record as a column that resizes with nothing touching it.
 */
export async function cursor(page: Page): Promise<void> {
  await page.evaluate(id => {
    if (document.getElementById(id) !== null) return
    const dot = document.createElement("div")
    dot.id = id
    dot.style.cssText = [
      "position:fixed",
      "inset-block-start:0",
      "inset-inline-start:0",
      "z-index:2147483646",
      "pointer-events:none",
      "inline-size:18px",
      "block-size:18px",
      "margin:-9px 0 0 -9px",
      "border-radius:50%",
      "border:2px solid #ff5f56",
      "background:rgba(255,95,86,.35)",
      "transform:translate(-100px,-100px)",
    ].join(";")
    document.body.append(dot)
    const follow = (event: MouseEvent | PointerEvent): void => {
      dot.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`
    }
    // Both names: chromium synthesizes pointermove from playwright's mouse.move, and a page that
    // stops propagation on one of the two still leaves the other reaching the document.
    document.addEventListener("mousemove", follow, true)
    document.addEventListener("pointermove", follow, true)
  }, CURSOR_ID)
}
