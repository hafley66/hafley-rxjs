import { expect, it } from "vitest"
import { moveGraphFrame, movementOffsets } from "../../src/2_graph/23_manualMovement.js"
import { fitGraphCamera } from "../../src/2_graph/1_fitCamera.js"
import type { GraphFrame } from "../../src/2_graph/0_frame.js"

it("replays gesture history, keeps actor lanes and message endpoints attached, and restores source on undo", () => {
  const frame: GraphFrame = {
    graph: { a: { id: "a", type: "node" }, b: { id: "b", type: "node" }, e: { id: "e", type: "edge", fromId: "a", toId: "b", direction: "forward", data: { kind: "message" } } },
    geometry: { revisionId: "source", boundsById: { a: { x: 0, y: 0, width: 10, height: 10 } }, columnBoundsById: { a: { x: 0, y: 0, width: 10, height: 100 } }, endpointAnchorById: {}, headerBoundsById: {}, routesById: { e: new Float32Array([5, 50, 55, 50, 105, 50]) } },
    camera: { x: 0, y: 0, scale: 1, viewport: { x: 0, y: 0, width: 200, height: 200 } },
    presentation: { stickyHeaders: [], hiddenIds: new Set(), focusedIds: new Set(), labelsById: {}, sealedSvgArtifactsByRootId: {} },
  }
  const events = [{ id: "a", dx: 20, dy: 80 }, { id: "e", dx: 40, dy: 15 }]
  const states = [0, 1, 2, 1, 0].map(cursor => {
    const moved = moveGraphFrame(frame, movementOffsets(frame, { events, cursor }), true)
    return { laneX: moved.geometry.columnBoundsById!.a.x, laneY: moved.geometry.columnBoundsById!.a.y, route: [...moved.geometry.routesById.e] }
  })
  expect(states).toEqual([
    { laneX: 0, laneY: 0, route: [5, 50, 55, 50, 105, 50] },
    { laneX: 20, laneY: 0, route: [25, 50, 65, 50, 105, 50] },
    { laneX: 20, laneY: 0, route: [25, 65, 65, 65, 105, 65] },
    { laneX: 20, laneY: 0, route: [25, 50, 65, 50, 105, 50] },
    { laneX: 0, laneY: 0, route: [5, 50, 55, 50, 105, 50] },
  ])
  expect([...frame.geometry.routesById.e]).toEqual([5, 50, 55, 50, 105, 50])
  const wide = { ...frame.geometry, boundsById: { root: { x: 0, y: 0, width: 25000, height: 4000 } }, routesById: {} }
  expect(["contain", "width", "height", "readable"].map(mode => fitGraphCamera(wide, frame.camera.viewport, 0, mode as "contain").scale)).toEqual([0.008, 0.008, 0.05, 0.75])
})
