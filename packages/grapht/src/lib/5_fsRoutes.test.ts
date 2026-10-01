import { expect, test } from "vitest"
import { fsRoutes } from "./5_fsRoutes.js"

test("symlinks route beyond both node rectangles with center endpoints for renderer clipping", () => {
  const anchors = { tests: { x: 128, y: 198 }, lib: { x: 160, y: 158 } }
  const routes = fsRoutes({ link: { id: "link", type: "edge", fromId: "tests", toId: "lib", direction: "forward" } }, {
    tests: { x: 56, y: 184, width: 144, height: 28 },
    lib: { x: 88, y: 144, width: 144, height: 28 },
  }, anchors, new Set(["link"]))
  expect([...routes.link]).toEqual([128, 198, 272, 198, 272, 158, 160, 158])
})
