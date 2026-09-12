import { Subject } from "rxjs"
import { Signal } from "@hafley66/signals"
import { createDocumentGraphFrameResource } from "../8_documentRenderer.ts"
import { fitGraphCamera } from "../../../src/2_graph/1_fitCamera.ts"
import type { GraphCamera, GraphFrame } from "../../../src/2_graph/0_frame.ts"

type Mode = "document" | "cytoscape"

const cameraInput$ = new Subject<GraphCamera>()
const focusInput$ = new Subject<ReadonlySet<string>>()
const selectionInput$ = new Subject<ReadonlySet<string>>()

const host = document.querySelector<HTMLElement>("#host") as HTMLElement
const readoutElement = document.querySelector<HTMLElement>("#readout") as HTMLElement

const archSvg = await (await fetch("./arch.svg")).text()
const [, , width, height] = (/viewBox="([^"]+)"/.exec(archSvg)?.[1] ?? "")
  .split(/\s+/)
  .map(Number)

const artifactFrame: GraphFrame = {
  graph: {
    epic: {
      id: "epic",
      type: "node",
      layout: { mode: "sealed", bounds: { x: 0, y: 0, width, height }, geometryRevisionId: "epic:geometry:1" },
    },
  },
  geometry: {
    revisionId: "epic:1",
    boundsById: { epic: { x: 0, y: 0, width, height } },
    endpointAnchorById: { epic: { x: width / 2, y: height / 2 } },
    routesById: {},
    headerBoundsById: {},
  },
  camera: fitGraphCamera(
    {
      revisionId: "epic:1",
      boundsById: { epic: { x: 0, y: 0, width, height } },
      endpointAnchorById: { epic: { x: width / 2, y: height / 2 } },
      routesById: {},
      headerBoundsById: {},
    },
    { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
    24,
  ),
  presentation: {
    stickyHeaders: [],
    hiddenIds: new Set(),
    focusedIds: new Set(),
    labelsById: {},
    sealedSvgArtifactsByRootId: {
      epic: {
        rootId: "epic",
        revisionId: "epic:svg:1",
        geometryRevisionId: "epic:geometry:1",
        svg: archSvg,
        sourceBounds: { x: 0, y: 0, width, height },
        fit: "contain",
      },
    },
  },
}

const ui = Signal({ mode: "document" as Mode, fps: 0 })
const camera = Signal(cameraInput$, artifactFrame.camera)
const readout = Signal(() => {
  const current = camera.$()
  return `${ui.mode.$()} | fps ${ui.fps.$()} | camera x ${current.x.toFixed(0)} y ${current.y.toFixed(0)} scale ${current.scale.toFixed(3)}`
})
// The page entry is the runtime boundary; this subscription is its only one.
readout.$.subscribe(text => {
  readoutElement.textContent = text
})

let resource: { render: (frame: GraphFrame, receipt: unknown) => void; unsubscribe: () => void } | undefined

async function mount(next: Mode): Promise<void> {
  resource?.unsubscribe()
  host.replaceChildren()
  ui.mode.$(next)
  resource =
    next === "document"
      ? createDocumentGraphFrameResource(host, { cameraInput$ })
      : (await import("../6_graphRenderer.ts")).createCytoscapeGraphFrameResource(host, { cameraInput$, focusInput$, selectionInput$ })
  resource.render(artifactFrame, { enterIds: ["epic"], updateIds: [], exitIds: [] })
}

await mount("document")

let frames = 0
let windowStart = performance.now()
requestAnimationFrame(function tick() {
  frames += 1
  const now = performance.now()
  if (now - windowStart >= 500) {
    ui.fps.$(Math.round((frames * 1000) / (now - windowStart)))
    frames = 0
    windowStart = now
  }
  requestAnimationFrame(tick)
})

document.querySelector("#document")?.addEventListener("click", () => void mount("document"))
document.querySelector("#cytoscape")?.addEventListener("click", () => void mount("cytoscape"))
document.querySelector("#fit")?.addEventListener("click", () => {
  resource?.render(artifactFrame, { enterIds: ["epic"], updateIds: [], exitIds: [] })
})
