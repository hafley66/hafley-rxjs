// Chromium under `vitest.browser.config.ts`. `scripts/examples.mjs` proves every example mounts and
// tears down without leaking, and it counts painted nodes, so an example whose own panel came up
// empty still passed it. What only a real engine can answer is whether the box an example builds
// ends up holding anything.
import { afterEach, beforeEach, expect, test } from "vitest"
import "./theme.css"
import { detailNestedGrid } from "../examples/14_detail_nested_grid.js"

let host: HTMLElement
let stop: (() => void) | null = null

beforeEach(() => {
  host = document.createElement("div")
  host.style.inlineSize = "700px"
  document.body.append(host)
})

afterEach(() => {
  stop?.()
  stop = null
  host.remove()
})

const twoFrames = (): Promise<void> =>
  new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))

// The panel belongs to the `detail` slot. A detail row is one full-width box and holds no cells at
// all, so an example that drew the panel from a column's cell put it in a seat never built and the
// row came up blank with every count still green.
test("the open detail panel holds the nested grid over that row's lines", async () => {
  stop = detailNestedGrid.mount(host)
  await twoFrames()
  const panel = host.querySelector(".sg-detail-panel")
  expect(panel).not.toBe(null)
  const inner = panel?.querySelector('[data-route="g"]')
  expect(inner?.getAttribute("data-grid-id")).toBe("lines-r0")
  expect(inner?.querySelectorAll(".sg-row").length).toBe(4)
})
