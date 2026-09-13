import { performanceReadout } from "../../../../docs-kit/src/3a_performanceReadout.ts"
import { BehaviorSubject, EMPTY, merge, Subject, switchMap, tap } from "rxjs"
import { Signal, StorageSignal } from "@hafley66/signals"
import { createDocumentGraphFrameResource } from "../8_documentRenderer.ts"
import { fitGraphCamera } from "../../../src/2_graph/1_fitCamera.ts"
import type { Graph, GraphId } from "@hafley66/grapht-model"
import type { Observable } from "rxjs"
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

const ui = Signal({ mode: "document" as Mode, source: "arch" as Source })
const camera = Signal(cameraInput$, artifactFrame.camera)
/** One store for the view switches, kept across reloads by the signals library's storage backend. */
const view = StorageSignal("grapht.proof.view", { ribbon: true, groups: true, legend: false })

const failure = Signal("")

const readout = Signal(() => {
  const current = camera.$()
  const broken = failure.$()
  if (broken !== "") return broken
  return `${ui.source.$()} | ${ui.mode.$()} | camera x ${current.x.toFixed(0)} y ${current.y.toFixed(0)} scale ${current.scale.toFixed(3)}`
})
type StickyResource = {
  render: (frame: GraphFrame, receipt: unknown) => void
  unsubscribe: () => void
  applySticky?: (sticky: { ribbon: boolean; groups: boolean }) => void
  legend?: { setOpen: (open: boolean) => void; toggled$: Observable<boolean> }
}

// Every mount replaces the renderer, so the view effects follow the current one rather than a
// captured reference; switchMap drops the previous renderer's wiring with it.
const mounted$ = new BehaviorSubject<StickyResource | undefined>(undefined)

const perf = performanceReadout(host)
perf.el.style.cssText += ";position:fixed;right:8px;bottom:8px;z-index:10"
document.body.appendChild(perf.el)

const painted$ = merge(
  perf.painted$,
  readout.$.pipe(tap(text => { readoutElement.textContent = text })),
  view.ribbon.$.pipe(tap(on => { ribbonToggle.checked = on })),
  view.groups.$.pipe(tap(on => { groupsToggle.checked = on })),
  mounted$.pipe(
    switchMap(current =>
      merge(
        view.$.pipe(tap(next => current?.applySticky?.({ ribbon: next.ribbon, groups: next.groups }))),
        view.legend.$.pipe(tap(open => current?.legend?.setOpen(open))),
        current?.legend?.toggled$.pipe(tap(open => view.legend.$(open))) ?? EMPTY,
      ),
    ),
  ),
)

let resource: StickyResource | undefined

async function importCytoscape(host: HTMLElement) {
  try {
    const { createCytoscapeGraphFrameResource } = await import("../6_graphRenderer.ts")
    return createCytoscapeGraphFrameResource(host, { cameraInput$, focusInput$, selectionInput$ }, { ...view.$(), inset: 44, fullWidth: 70, chipWidth: 34, gap: 4 })
  } catch (error) {
    failure.$(`cytoscape renderer failed: ${String(error).slice(0, 180)}`)
    return undefined
  }
}

const ribbonToggle = document.querySelector<HTMLInputElement>("#ribbon") as HTMLInputElement
const groupsToggle = document.querySelector<HTMLInputElement>("#groups") as HTMLInputElement
let frame = artifactFrame

async function mount(next: Mode): Promise<void> {
  resource?.unsubscribe()
  host.replaceChildren()
  failure.$("")
  ui.mode.$(next)
  resource =
    next === "document"
      ? createDocumentGraphFrameResource(host, { cameraInput$ }, { ...view.$(), inset: 44, fullWidth: 70, chipWidth: 34, gap: 4 })
      : await importCytoscape(host)
  const rootId = ui.source.$() === "arch" ? "epic" : "seq"
  resource?.render(frame, { enterIds: [rootId], updateIds: [], exitIds: [] })
  cameraInput$.next(frame.camera)
  mounted$.next(resource)
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
// The page entry is the runtime boundary; this subscription is its only one.
painted$.subscribe()

document.querySelector("#document")?.addEventListener("click", () => void mount("document"))
document.querySelector("#renderer-cytoscape")?.addEventListener("click", () => void mount("cytoscape"))
document.querySelector("#arch")?.addEventListener("click", () => void useSource("arch"))
document.querySelector("#sequence")?.addEventListener("click", () => void useSource("sequence"))
ribbonToggle.addEventListener("change", () => view.ribbon.$(ribbonToggle.checked))
groupsToggle.addEventListener("change", () => view.groups.$(groupsToggle.checked))
document.querySelector("#fit")?.addEventListener("click", () => {
  const rootId = ui.source.$() === "arch" ? "epic" : "seq"
  resource?.render(frame, { enterIds: [rootId], updateIds: [], exitIds: [] })
  cameraInput$.next(frame.camera)
})
