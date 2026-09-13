import { performanceReadout } from "../../../../docs-kit/src/3a_performanceReadout.ts"
import { BehaviorSubject, EMPTY, merge, Subject, switchMap, tap } from "rxjs"
import { Signal, StorageSignal } from "@hafley66/signals"
import { createDocumentGraphFrameResource } from "../8_documentRenderer.ts"
import { fitGraphCamera } from "../../../src/2_graph/1_fitCamera.ts"
import type { Observable } from "rxjs"
import type { GraphCamera, GraphFrame } from "../../../src/2_graph/0_frame.ts"
import { sequenceFrame } from "./0_sequenceFrame.ts"

type Mode = "document" | "cytoscape"
type Source = "arch" | "sequence"

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
  if (next === "cytoscape" && ui.source.$() === "arch") return
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
  const cytoButton = document.querySelector<HTMLButtonElement>("#renderer-cytoscape")!
  cytoButton.disabled = next === "arch"
  cytoButton.title = next === "arch" ? "Native Cytoscape is available for the large sequence; architecture has no native graph bindings yet." : "Native Cytoscape nodes and edges"
  await mount(next === "arch" ? "document" : ui.mode.$())
}

await useSource("sequence")
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
