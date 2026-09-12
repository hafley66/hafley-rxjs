import { Subject } from "rxjs"
import { createCytoscapeGraphFrameResource } from "../6_graphRenderer.ts"
import { fitGraphCamera } from "../../../src/2_graph/1_fitCamera.ts"
import type { GraphCamera, GraphFrame } from "../../../src/2_graph/0_frame.ts"

// Cytoscape publishes pointer input through the interaction subjects; the
// frame is rebuilt and redrawn. This subscription is the app boundary.
const cameraInput$ = new Subject<GraphCamera>()
const focusInput$ = new Subject<ReadonlySet<string>>()
const selectionInput$ = new Subject<ReadonlySet<string>>()

const host = document.querySelector<HTMLElement>("#host") as HTMLElement
const readout = document.querySelector<HTMLElement>("#readout") as HTMLElement

const archSvg = await (await fetch("./arch.svg")).text()
const [, , width, height] = (/viewBox="([^"]+)"/.exec(archSvg)?.[1] ?? "")
  .split(/\s+/)
  .map(Number)

function artifactFrame(svg: string, source: { x: number; y: number; width: number; height: number }): GraphFrame {
  return {
    graph: {
      epic: {
        id: "epic",
        type: "node",
        layout: { mode: "sealed", bounds: { x: 0, y: 0, width, height }, geometryRevisionId: "epic:geometry:1" },
      },
    },
    geometry: {
      revisionId: "epic:1",
      boundsById: { epic: { x: 0, y: 0, width: source.width, height: source.height } },
      endpointAnchorById: { epic: { x: source.width / 2, y: source.height / 2 } },
      routesById: {},
      headerBoundsById: {},
    },
    camera: fitGraphCamera(
      {
        revisionId: "epic:1",
        boundsById: { epic: { x: 0, y: 0, width: source.width, height: source.height } },
        endpointAnchorById: { epic: { x: source.width / 2, y: source.height / 2 } },
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
          revisionId: `epic:svg:${source.x}:${source.y}:${source.width}`,
          geometryRevisionId: "epic:geometry:1",
          svg,
          sourceBounds: source,
          fit: "contain",
        },
      },
    },
  }
}

function croppedClusterArtifact(): { svg: string; source: { x: number; y: number; width: number; height: number } } | null {
  const probeHost = document.createElement("div")
  probeHost.setAttribute("style", "position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none")
  const root = new DOMParser().parseFromString(archSvg, "image/svg+xml").documentElement
  probeHost.appendChild(root)
  document.body.appendChild(probeHost)
  const measured = [...root.querySelectorAll("text")]
    .filter(node => (node.textContent?.trim() ?? "").length > 0)
    .map(node => {
      const box = (node as SVGTextElement).getBBox()
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    })
    .sort((left, right) => left.x + left.y - (right.x + right.y))
  probeHost.remove()
  if (measured.length === 0) return null
  const seed = measured[0]
  const cluster = measured.filter(box => Math.abs(box.x - seed.x) < 900 && Math.abs(box.y - seed.y) < 500)
  const left = Math.max(Math.min(...cluster.map(box => box.x)) - 60, 0)
  const top = Math.max(Math.min(...cluster.map(box => box.y)) - 60, 0)
  const right = Math.min(Math.max(...cluster.map(box => box.x + box.width)) + 60, width)
  const bottom = Math.min(Math.max(...cluster.map(box => box.y + box.height)) + 60, height)
  root.setAttribute("viewBox", `${left} ${top} ${right - left} ${bottom - top}`)
  root.removeAttribute("width")
  root.removeAttribute("height")
  return { svg: new XMLSerializer().serializeToString(root), source: { x: left, y: top, width: right - left, height: bottom - top } }
}

let frame = artifactFrame(archSvg, { x: 0, y: 0, width, height })
const resource = createCytoscapeGraphFrameResource(host, { cameraInput$, focusInput$, selectionInput$ })
resource.render(frame, { enterIds: ["epic"], updateIds: [], exitIds: [] })

cameraInput$.subscribe(camera => {
  readout.textContent = `camera x ${camera.x.toFixed(0)} y ${camera.y.toFixed(0)} scale ${camera.scale.toFixed(3)}`
  resource.render({ ...frame, camera }, { enterIds: [], updateIds: ["epic"], exitIds: [] })
})
focusInput$.subscribe(focusedIds => {
  frame = { ...frame, presentation: { ...frame.presentation, focusedIds } }
  resource.render(frame, { enterIds: [], updateIds: ["epic"], exitIds: [] })
})
selectionInput$.subscribe(selectedIds => {
  readout.textContent = `${readout.textContent.split(" | ")[0]} | selected ${[...selectedIds].join(", ") || "-"}`
})

document.querySelector("#fit")?.addEventListener("click", () => {
  frame = artifactFrame(archSvg, { x: 0, y: 0, width, height })
  resource.render(frame, { enterIds: ["epic"], updateIds: [], exitIds: [] })
})
document.querySelector("#crop")?.addEventListener("click", () => {
  const cropped = croppedClusterArtifact()
  if (!cropped) return
  frame = artifactFrame(cropped.svg, cropped.source)
  resource.render(frame, { enterIds: ["epic"], updateIds: [], exitIds: [] })
})
