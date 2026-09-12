import { Subject } from "rxjs"
import { createDocumentGraphFrameResource } from "../8_documentRenderer.ts"
import { fitGraphCamera } from "../../../src/2_graph/1_fitCamera.ts"
import type { GraphCamera, GraphFrame } from "../../../src/2_graph/0_frame.ts"

// The camera state lives here; whichever renderer is mounted draws from it.
const cameraInput$ = new Subject<GraphCamera>()
const focusInput$ = new Subject<ReadonlySet<string>>()
const selectionInput$ = new Subject<ReadonlySet<string>>()

const host = document.querySelector<HTMLElement>("#host") as HTMLElement
const readout = document.querySelector<HTMLElement>("#readout") as HTMLElement

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

type Mode = "document" | "cytoscape"
let mode: Mode = "document"
let resource: { render: (frame: GraphFrame, receipt: unknown) => void; unsubscribe: () => void } | undefined

async function mount(next: Mode): Promise<void> {
  resource?.unsubscribe()
  host.replaceChildren()
  mode = next
  resource =
    next === "document"
      ? createDocumentGraphFrameResource(host, { cameraInput$ })
      : (await import("../6_graphRenderer.ts")).createCytoscapeGraphFrameResource(host, { cameraInput$, focusInput$, selectionInput$ })
  resource.render(artifactFrame, { enterIds: ["epic"], updateIds: [], exitIds: [] })
}

mount("document")

cameraInput$.subscribe(camera => {
  readout.textContent = `${mode} | camera x ${camera.x.toFixed(0)} y ${camera.y.toFixed(0)} scale ${camera.scale.toFixed(3)}`
})

document.querySelector("#document")?.addEventListener("click", () => mount("document"))
document.querySelector("#cytoscape")?.addEventListener("click", () => mount("cytoscape"))
document.querySelector("#fit")?.addEventListener("click", () => {
  resource?.render(artifactFrame, { enterIds: ["epic"], updateIds: [], exitIds: [] })
})
