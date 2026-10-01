import { expect, test } from "vitest"
import { treeGraphFrame } from "../../src/2_graph/17a_treeFrame.js"
import { FS } from "../../src/2_graph/12a_fs.js"
import type { GraphFrame } from "../../src/2_graph/0_frame.js"

test("directory projection preserves source ownership and adds a routed branch", () => {
  const graph = { root: { id: "root", type: "node" as const }, child: { id: "child", type: "node" as const, parentId: "root" } }
  const frame: GraphFrame = { graph, geometry: FS()(graph, new AbortController().signal),
    camera: { x: 0, y: 0, scale: 1, viewport: { x: 0, y: 0, width: 800, height: 600 } },
    presentation: { stickyHeaders: [], hiddenIds: new Set(), focusedIds: new Set(), labelsById: {}, sealedSvgArtifactsByRootId: {} },
  }
  const drawn = treeGraphFrame(frame)
  expect([graph.child.parentId, drawn.graph.child.parentId]).toEqual(["root", undefined])
  expect(drawn.graph["containment:child"]).toEqual({ id: "containment:child", type: "edge", fromId: "root", toId: "child", direction: "none" })
  expect([...drawn.geometry.routesById["containment:child"]]).toEqual([96, 38, 32, 58, 32, 78, 128, 78])
  expect(Object.keys(treeGraphFrame({ ...frame, presentation: { ...frame.presentation, hiddenIds: new Set(["child"]) } }).graph)).toEqual(["root", "child"])
})
