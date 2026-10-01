import type { Graph } from "@hafley66/grapht-model"
import { FS } from "../../../src/2_graph/12a_fs.js"
import { zigzag } from "../../../src/2_graph/12b_zigzag.js"
import { fcoseGraphLayout } from "../../../src/2_graph/12_layout.js"
import { layout, graphLabelsOf } from "../../../src/2_graph/9_operators.js"
import { fitGraphCamera } from "../../../src/2_graph/1_fitCamera.js"
import type { GraphFrame } from "../../../src/2_graph/0_frame.js"
import { firstValueFrom, of } from "rxjs"

// Containment is expressed as graph edges here, so each directory remains a visible node.
export const layoutGraph: Graph = {
  ...Object.fromEntries(["app", "src", "main", "lib", "tests"].map(id => [id, { id, type: "node" as const, data: { label: id, kind: "shape" } }])),
  ...Object.fromEntries([["app", "src"], ["src", "main"], ["src", "lib"], ["app", "tests"]].map(([fromId, toId]) => {
    const id = `${fromId}/${toId}`
    return [id, { id, type: "edge" as const, fromId, toId, direction: "none" as const }]
  })),
  link: { id: "link", type: "edge", fromId: "tests", toId: "lib", direction: "forward", data: { label: "symlink" } },
}

const hints = { entrypoints: ["app"], order: ["src", "main", "lib", "tests"], symlinks: ["link"] }
export const layoutAlgorithms = { FS: FS(hints), zigzag: zigzag(hints), fCoSE: fcoseGraphLayout }

export async function layoutFrame(name: keyof typeof layoutAlgorithms, viewport: { width: number; height: number }): Promise<GraphFrame> {
  const result = await firstValueFrom(of(layoutGraph).pipe(layout(layoutAlgorithms[name])))
  const camera = fitGraphCamera(result.geometry, { x: 0, y: 0, ...viewport }, 96)
  const ratio = Math.min(1, 2 / camera.scale)
  camera.x = viewport.width / 2 + (camera.x - viewport.width / 2) * ratio
  camera.y = viewport.height / 2 + (camera.y - viewport.height / 2) * ratio
  camera.scale *= ratio
  return {
    ...result,
    camera,
    presentation: { stickyHeaders: [], hiddenIds: new Set(), focusedIds: new Set(), labelsById: {
      ...graphLabelsOf(layoutGraph),
      ...Object.fromEntries(Object.values(layoutGraph).filter(item => item.type === "edge" && item.id !== "link").map(item => [item.id, { text: "" }])),
    }, sealedSvgArtifactsByRootId: {} },
  }
}
