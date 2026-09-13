import { Subject } from "rxjs"
import { Signal } from "@hafley66/signals"
import { createDocumentGraphFrameResource } from "../8_documentRenderer.ts"
import { fitGraphCamera } from "../../../src/2_graph/1_fitCamera.ts"
import type { Graph, GraphId } from "@hafley66/grapht-model"
import type { GraphCamera, GraphFrame, GraphGeometry } from "../../../src/2_graph/0_frame.ts"
import sequenceFixture from "../../../fixtures/sequence/large.json"
import sequenceSvgUrl from "../../../fixtures/sequence/large.svg?url"

type Mode = "document" | "cytoscape"
type Source = "arch" | "sequence"
type FixtureRect = { id: string; label: string; left: number; width: number; top: number; bottom: number }

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

/** The smallest group that strictly contains this one, which is its header's parent in the stack. */
function containerOf(group: FixtureRect, groups: readonly FixtureRect[]): string | undefined {
  return groups
    .filter(other => other.id !== group.id && other.top <= group.top && other.bottom >= group.bottom && other.left <= group.left)
    .sort((left, right) => left.bottom - left.top - (right.bottom - right.top))
    .at(0)?.id
}

async function sequenceFrame(viewport: { width: number; height: number }): Promise<GraphFrame> {
  const svg = await (await fetch(sequenceSvgUrl)).text()
  const box = sequenceFixture.viewBox
  const actors = sequenceFixture.actors as FixtureRect[]
  const groups = sequenceFixture.groups as FixtureRect[]
  const bounds = { x: box.x, y: box.y, width: box.width, height: box.height }

  const graph: Record<string, unknown> = {
    seq: { id: "seq", type: "node", layout: { mode: "sealed", bounds, geometryRevisionId: "seq:geometry:1" } },
  }
  for (const actor of actors) graph[actor.id] = { id: actor.id, type: "node", parentId: "seq" }
  for (const group of groups) graph[group.id] = { id: group.id, type: "node", parentId: containerOf(group, groups) ?? "seq" }

  const geometry: GraphGeometry = {
    revisionId: "seq:1",
    boundsById: {
      seq: bounds,
      ...Object.fromEntries(groups.map(group => [group.id, { x: group.left, y: group.top, width: group.width, height: group.bottom - group.top }])),
    },
    endpointAnchorById: { seq: { x: box.x + box.width / 2, y: box.y + box.height / 2 } },
    routesById: {},
    headerBoundsById: Object.fromEntries(groups.map(group => [group.id, { x: group.left, y: group.top, width: group.width, height: 22 }])),
    columnBoundsById: Object.fromEntries(actors.map(actor => [actor.id, { x: actor.left, y: actor.top, width: actor.width, height: actor.bottom - actor.top }])),
  }

  return {
    graph: graph as Graph,
    geometry,
    camera: fitGraphCamera(geometry, { x: 0, y: 0, width: viewport.width, height: viewport.height }, 24),
    presentation: {
      stickyHeaders: [],
      hiddenIds: new Set<GraphId>(),
      focusedIds: new Set<GraphId>(),
      labelsById: Object.fromEntries([...actors, ...groups].map(item => [item.id, { text: item.label }])),
      sealedSvgArtifactsByRootId: {
        seq: {
          rootId: "seq",
          revisionId: "seq:svg:1",
          geometryRevisionId: "seq:geometry:1",
          svg,
          sourceBounds: bounds,
          fit: "contain",
        },
      },
    },
  }
}

const ui = Signal({ mode: "document" as Mode, source: "arch" as Source, fps: 0 })
const camera = Signal(cameraInput$, artifactFrame.camera)
const readout = Signal(() => {
  const current = camera.$()
  return `${ui.source.$()} | ${ui.mode.$()} | fps ${ui.fps.$()} | camera x ${current.x.toFixed(0)} y ${current.y.toFixed(0)} scale ${current.scale.toFixed(3)}`
})
// The page entry is the runtime boundary; this subscription is its only one.
readout.$.subscribe(text => {
  readoutElement.textContent = text
})

let resource: { render: (frame: GraphFrame, receipt: unknown) => void; unsubscribe: () => void } | undefined

async function importCytoscape(host: HTMLElement) {
  try {
    const { createCytoscapeGraphFrameResource } = await import("../6_graphRenderer.ts")
    return createCytoscapeGraphFrameResource(host, { cameraInput$, focusInput$, selectionInput$ })
  } catch (error) {
    readout.textContent = `cytoscape renderer failed to load: ${String(error).slice(0, 140)}`
    return undefined
  }
}

const ribbonToggle = document.querySelector<HTMLInputElement>("#ribbon") as HTMLInputElement
const groupsToggle = document.querySelector<HTMLInputElement>("#groups") as HTMLInputElement
let frame = artifactFrame

async function mount(next: Mode): Promise<void> {
  resource?.unsubscribe()
  host.replaceChildren()
  ui.mode.$(next)
  resource =
    next === "document"
      ? createDocumentGraphFrameResource(
          host,
          { cameraInput$ },
          { ribbon: ribbonToggle.checked, groups: groupsToggle.checked, inset: 44, fullWidth: 70, chipWidth: 34, gap: 4 },
        )
      : await importCytoscape(host)
  const rootId = ui.source.$() === "arch" ? "epic" : "seq"
  resource?.render(frame, { enterIds: [rootId], updateIds: [], exitIds: [] })
  cameraInput$.next(frame.camera)
}

async function useSource(next: Source): Promise<void> {
  ui.source.$(next)
  frame = next === "arch" ? artifactFrame : await sequenceFrame({ width: window.innerWidth, height: window.innerHeight })
  document.body.setAttribute("data-source", next)
  document.querySelector("#arch")?.setAttribute("aria-pressed", String(next === "arch"))
  document.querySelector("#sequence")?.setAttribute("aria-pressed", String(next === "sequence"))
  await mount(ui.mode.$())
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
document.querySelector("#arch")?.addEventListener("click", () => void useSource("arch"))
document.querySelector("#sequence")?.addEventListener("click", () => void useSource("sequence"))
ribbonToggle.addEventListener("change", () => void mount(ui.mode.$()))
groupsToggle.addEventListener("change", () => void mount(ui.mode.$()))
document.querySelector("#fit")?.addEventListener("click", () => {
  const rootId = ui.source.$() === "arch" ? "epic" : "seq"
  resource?.render(frame, { enterIds: [rootId], updateIds: [], exitIds: [] })
  cameraInput$.next(frame.camera)
})
