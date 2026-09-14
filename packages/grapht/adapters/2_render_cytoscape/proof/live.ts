import { GRAPH_STYLES, graphHoverColor, type GraphStyleInput } from "../../../src/lib/0_graphStyle.ts"
import { svgFrame, type SvgFrameInput } from "../../../src/2_graph/21_svgFrame.ts"
import { DEFAULT_WHEEL_SETTINGS, wheelSettingsOf, type WheelSettings } from "../../../src/lib/1_wheelCamera.ts"
import archSource from "../../../0_rendered_artifact_state_epic.d2?raw"
import { groupSequenceActors } from "../../../src/2_graph/20_groupActors.ts"
import { sequenceNeighborhood } from "../../../src/2_graph/19_sequenceNeighborhood.ts"
import type { SequenceGraph } from "@hafley66/grapht-model"
import { collapseSequenceFrame } from "../../../src/2_graph/18_sequenceCollapse.ts"
import { graphNeighborhood, hoverOpacity, type HoverMode } from "../../../src/2_graph/16_neighborhood.ts"
import { performanceReadout } from "../../../../docs-kit/src/3a_performanceReadout.ts"
import { BehaviorSubject, EMPTY, merge, Subject, switchMap, tap } from "rxjs"
import { Signal, StorageSignal, storageSignal, urlAdapter, sync } from "@hafley66/signals"
import { createDocumentGraphFrameResource } from "../8_documentRenderer.ts"
import { fitGraphCamera } from "../../../src/2_graph/1_fitCamera.ts"
import type { Observable } from "rxjs"
import type { GraphCamera, GraphFrame } from "../../../src/2_graph/0_frame.ts"
import { sequenceFrame } from "./0_sequenceFrame.ts"

type Mode = "document" | "cytoscape"
type Source = "arch" | "sequence" | "svg"

const cameraInput$ = new Subject<GraphCamera>()
const focusInput$ = new Subject<ReadonlySet<string>>()
const collapseInput$ = new Subject<string>()
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
        source: { language: "d2", text: archSource, locator: "0_rendered_artifact_state_epic.d2" },
        sourceBounds: { x: 0, y: 0, width, height },
        fit: "contain",
      },
    },
  },
}

const ui = Signal({ mode: "document" as Mode, source: "arch" as Source })
const camera = Signal(cameraInput$, artifactFrame.camera)
/** One store for the view switches, kept across reloads by the signals library's storage backend. */
const view = StorageSignal("grapht.proof.view", { ribbon: true, groups: true, legend: false, dark: true })

const hoverColors = StorageSignal("grapht.proof.hop-colors", false)
const hoverColorToggle = document.querySelector<HTMLInputElement>("#hover-color-mode")!
hoverColorToggle.addEventListener("change", () => hoverColors.$(hoverColorToggle.checked))
const hoverStyle = () => ({ ...GRAPH_STYLES[view.dark.$() === false ? "light" : "dark"], hopMode: hoverColors.$() ? "color" as const : "fade" as const })

const wheelSettings = StorageSignal("grapht.proof.wheel", { ...DEFAULT_WHEEL_SETTINGS }, { parse: text => wheelSettingsOf(JSON.parse(text)) })
const wheelRoute = storageSignal(urlAdapter("wheel"), wheelSettings.$(), { parse: text => wheelSettingsOf(JSON.parse(text)) })
const wheelSync = sync(wheelSettings, wheelRoute, { to: wheelSettingsOf, from: wheelSettingsOf })
const wheelControls = document.querySelector<HTMLElement>("#wheel-settings")!
for (const input of wheelControls.querySelectorAll<HTMLInputElement>("input[data-wheel]")) {
  input.addEventListener("input", () => {
    const key = input.dataset.wheel as keyof WheelSettings
    wheelSettings.$(wheelSettingsOf({ ...wheelSettings.$(), [key]: input.type === "checkbox" ? input.checked : Number(input.value) }))
  })
}
document.querySelector("#reset-wheel")!.addEventListener("click", () => wheelSettings.$({ ...DEFAULT_WHEEL_SETTINGS }))
window.addEventListener("pagehide", () => { wheelSync.unsubscribe(); wheelRoute.close() })

const failure = Signal("")

const readout = Signal(() => {
  const current = camera.$()
  const broken = failure.$()
  if (broken !== "") return broken
  return `${ui.source.$()} | ${ui.mode.$()} | camera x ${current.x.toFixed(0)} y ${current.y.toFixed(0)} scale ${current.scale.toFixed(3)}`
})
type StickyResource = {
  applyWheelSettings?: (settings: WheelSettings) => void
  applyHover?: (hops: Readonly<Record<string, number>>) => void
  render: (frame: GraphFrame, receipt: unknown) => void
  unsubscribe: () => void
  applySticky?: (sticky: { ribbon: boolean; groups: boolean }) => void
  applyTheme?: (theme: GraphStyleInput) => void
  legend?: { setOpen: (open: boolean) => void; toggled$: Observable<boolean> }
}

// Every mount replaces the renderer, so the view effects follow the current one rather than a
// captured reference; switchMap drops the previous renderer's wiring with it.
const mounted$ = new BehaviorSubject<StickyResource | undefined>(undefined)

const perf = performanceReadout(host)
perf.el.style.cssText += ";position:fixed;right:8px;bottom:8px;z-index:10"
document.body.appendChild(perf.el)

let layoutLab: ReturnType<typeof import("./1_groupLayoutLab.ts").createGroupLayoutLab> | undefined

const painted$ = merge(
  perf.painted$,
  wheelSettings.$.pipe(tap(settings => {
    for (const input of wheelControls.querySelectorAll<HTMLInputElement>("input[data-wheel]")) {
      const value = settings[input.dataset.wheel as keyof WheelSettings]
      if (input.type === "checkbox") input.checked = Boolean(value)
      else input.value = String(value)
      const output = input.parentElement?.querySelector("output")
      if (output) output.textContent = String(value)
    }
  })),
  collapseInput$.pipe(tap(id => {
    if (collapsedIds.has(id)) collapsedIds.delete(id); else collapsedIds.add(id)
    frame = collapseSequenceFrame(document, originalFrame, collapsedIds)
    paintInteraction(true)
    rebuildGroupControls()
  })),
  hoverColors.$.pipe(tap(on => { hoverColorToggle.checked = on; paintHopLegend() })),
  focusInput$.pipe(tap(ids => { hoveredIds = ids; paintInteraction() })),
  readout.$.pipe(tap(text => { readoutElement.textContent = text })),
  view.ribbon.$.pipe(tap(on => { ribbonToggle.checked = on })),
  view.groups.$.pipe(tap(on => { groupsToggle.checked = on })),
  view.dark.$.pipe(tap(on => { darkToggle.checked = on !== false; layoutLab?.applyTheme(on === false ? "light" : "dark")
    paintHopLegend()
  })),
  mounted$.pipe(
    switchMap(current =>
      merge(
        wheelSettings.$.pipe(tap(settings => current?.applyWheelSettings?.(settings))),
        view.$.pipe(tap(next => current?.applySticky?.({ ribbon: next.ribbon, groups: next.groups }))),
        merge(view.dark.$, hoverColors.$).pipe(tap(() => current?.applyTheme?.(hoverStyle()))),
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
    const resource = createCytoscapeGraphFrameResource(host, { cameraInput$, focusInput$, selectionInput$, collapseInput$ }, { ...view.$(), inset: 44, fullWidth: 70, chipWidth: 34, gap: 4 })
    resource.applyTheme(hoverStyle())
    return resource
  } catch (error) {
    failure.$(`cytoscape renderer failed: ${String(error).slice(0, 180)}`)
    return undefined
  }
}

const ribbonToggle = document.querySelector<HTMLInputElement>("#ribbon") as HTMLInputElement
const groupsToggle = document.querySelector<HTMLInputElement>("#groups") as HTMLInputElement
const darkToggle = document.querySelector<HTMLInputElement>("#dark") as HTMLInputElement
let originalFrame = artifactFrame
const collapsedIds = new Set<string>()
let frame = artifactFrame
let hoveredIds: ReadonlySet<string> = new Set()
const hoverMode = document.querySelector<HTMLSelectElement>("#hover-mode")!
const hoverRelations = document.querySelector<HTMLSelectElement>("#hover-relations")!
const hoverDepth = document.querySelector<HTMLInputElement>("#hover-depth")!
const hoverDebug = document.querySelector<HTMLInputElement>("#hover-debug")!
const inspector = document.querySelector<HTMLElement>("#hover-inspector")!

function paintHopLegend(): void {
  const palette = hoverStyle()
  document.querySelector("#hop-colors")!.replaceChildren("Hops: ", ...["focus", "1", "2", "3", "4+"].map((label, hop) => {
    const span = document.createElement("span")
    span.textContent = `${label}  `; span.style.color = graphHoverColor(palette, hop); span.style.opacity = String(hoverOpacity(hop, true))
    return span
  }))
}

function paintInteraction(renderFrame = false): void {
  const options = { mode: hoverMode.value as HoverMode, depth: Number(hoverDepth.value), components: collapsedIds }
  const hops = hoverRelations.value === "sequence" ? sequenceNeighborhood(frame.graph as SequenceGraph, hoveredIds, options) : graphNeighborhood(frame.graph, hoveredIds, options)
  if (renderFrame) resource?.render({ ...frame, camera: camera.$(), presentation: { ...frame.presentation, hopsById: hops } }, { enterIds: [], updateIds: [], exitIds: [] })
  else resource?.applyHover?.(hops)
  if (!hoverDebug.checked) { inspector.hidden = true; return }
  if (!hoveredIds.size) return
  inspector.hidden = false
  inspector.textContent = "Last hover\n" + [...hoveredIds].map(id => {
    const item = frame.graph[id]
    const data = item?.data as { kind?: string; label?: string; sourceSpan?: { lineStart: number; lineEnd: number } } | undefined
    const route = frame.geometry.routesById[id]
    const artifacts = Object.values(frame.presentation.sealedSvgArtifactsByRootId)
    const bindings = artifacts.flatMap(artifact => artifact.bindings?.filter(binding => binding.graphId === id) ?? [])
    const relations = Object.values(frame.graph).filter(other => other.parentId === id || other.type === "edge" && (other.fromId === id || other.toId === id))
    return [
      `${data?.kind ?? item?.type ?? "unknown"}: ${data?.label ?? frame.presentation.labelsById[id]?.text ?? ""}`,
      `id: ${id}`, `parent: ${item?.parentId ?? "none"}`, `hop: ${hops[id] ?? "outside mode/depth"}`,
      `bounds: ${JSON.stringify(frame.geometry.boundsById[id] ?? null)}`,
      `anchor: ${JSON.stringify(frame.geometry.endpointAnchorById[id] ?? null)}`,
      ...(item?.type === "edge" ? [`from: ${item.fromId}`, `to: ${item.toId}`] : []),
      ...(route ? [`route start: ${JSON.stringify([...route.slice(0, 2)])}`, `route end: ${JSON.stringify([...route.slice(-2)])}`, `route points: ${route.length / 2}`] : []),
      ...(data?.sourceSpan ? [`source lines: ${data.sourceSpan.lineStart}..${data.sourceSpan.lineEnd}`] : []),
      '"bindings":', ...bindings.map(binding => `  ${binding.role}: ${binding.elementId}`),
      "relations:", ...relations.map(other => other.type === "edge" ? `  ${other.id}: ${other.fromId} -> ${other.toId}` : `  contains ${other.id}`),
    ].join("\n")
  }).join("\n\n")
}
for (const input of [hoverMode, hoverRelations, hoverDepth, hoverDebug]) input.addEventListener("change", () => paintInteraction())
document.querySelector("#source-text")!.addEventListener("click", () => {
  const preview = document.querySelector<HTMLElement>("#source-preview")!
  preview.hidden = !preview.hidden
  preview.textContent = Object.values(frame.presentation.sealedSvgArtifactsByRootId).map(artifact => artifact.source?.text ?? "Source text unavailable for this artifact.").join("\n")
})

function rebuildGroupControls(): void {
  const controls = document.querySelector<HTMLElement>("#collapse-controls")!
  controls.replaceChildren()
  for (const id of Object.keys(frame.geometry.headerBoundsById)) {
    const label = document.createElement("label")
    label.style.display = "block"
    const input = document.createElement("input")
    input.type = "checkbox"
    input.dataset.collapseId = id
    input.checked = collapsedIds.has(id)
    label.append(input, `Collapse ${frame.presentation.labelsById[id]?.text ?? id}`)
    input.addEventListener("change", () => {
      if (input.checked) collapsedIds.add(id); else collapsedIds.delete(id)
      frame = collapseSequenceFrame(document, originalFrame, collapsedIds)
      paintInteraction(true)
    })
    controls.appendChild(label)
  }
  const actors = document.querySelector<HTMLSelectElement>("#actor-members")!
  actors.replaceChildren(...Object.keys(originalFrame.geometry.columnBoundsById ?? {}).map(id => {
    const option = document.createElement("option")
    option.value = id; option.textContent = originalFrame.presentation.labelsById[id]?.text ?? id
    return option
  }))
}
let actorGroupOrdinal = 0
document.querySelector("#group-actors")!.addEventListener("click", () => {
  const actors = document.querySelector<HTMLSelectElement>("#actor-members")!
  const name = document.querySelector<HTMLInputElement>("#actor-group-name")!.value
  try {
    originalFrame = groupSequenceActors(originalFrame, `view-actor-group:${++actorGroupOrdinal}`, [...actors.selectedOptions].map(option => option.value), name)
    frame = collapseSequenceFrame(document, originalFrame, collapsedIds)
    rebuildGroupControls()
    paintInteraction(true)
    failure.$("")
  } catch (error) { failure.$(String(error)) }
})

async function mount(next: Mode): Promise<void> {
  if (next === "cytoscape" && !Object.values(frame.presentation.sealedSvgArtifactsByRootId).some(artifact => artifact.bindings?.length)) return
  resource?.unsubscribe()
  host.replaceChildren()
  failure.$("")
  ui.mode.$(next)

  resource =
    next === "document"
      ? createDocumentGraphFrameResource(host, { cameraInput$, focusInput$, collapseInput$ }, { ...view.$(), inset: 44, fullWidth: 70, chipWidth: 34, gap: 4 })
      : await importCytoscape(host)
  resource?.applyWheelSettings?.(wheelSettings.$())
  resource?.applyTheme?.(hoverStyle())
  const rootId = Object.keys(frame.presentation.sealedSvgArtifactsByRootId)[0]
  resource?.render(frame, { enterIds: [rootId], updateIds: [], exitIds: [] })
  cameraInput$.next(frame.camera)
  mounted$.next(resource)
}

async function useSource(next: "arch" | "sequence"): Promise<void> {
  ui.source.$(next)
  frame = next === "arch" ? artifactFrame : await sequenceFrame({ width: window.innerWidth, height: window.innerHeight })
  originalFrame = frame
  collapsedIds.clear()
  hoveredIds = new Set()
  inspector.hidden = true
  rebuildGroupControls()
  document.body.setAttribute("data-source", next)
  document.querySelector("#arch")?.setAttribute("aria-pressed", String(next === "arch"))
  document.querySelector("#sequence")?.setAttribute("aria-pressed", String(next === "sequence"))
  const cytoButton = document.querySelector<HTMLButtonElement>("#renderer-cytoscape")!
  cytoButton.disabled = next === "arch"
  cytoButton.title = next === "arch" ? "Native Cytoscape is available for the large sequence; architecture has no native graph bindings yet." : "Native Cytoscape nodes and edges"
  await mount(next === "arch" ? "document" : ui.mode.$())
}

document.querySelector<HTMLInputElement>("#svg-import")!.addEventListener("change", async event => {
  const files = [...(event.target as HTMLInputElement).files ?? []]
  const source = files.find(file => file.name.toLowerCase().endsWith(".svg"))
  if (!source) return
  try {
    const metadata = files.find(file => file.name.toLowerCase().endsWith(".json"))
    const bindingInput: Pick<SvgFrameInput, "graph" | "bindings"> = metadata ? JSON.parse(await metadata.text()) : {}
    frame = svgFrame(document, { svg: await source.text(), locator: source.name, graph: bindingInput.graph, bindings: bindingInput.bindings, viewport: { width: innerWidth, height: innerHeight } })
    originalFrame = frame
    collapsedIds.clear(); hoveredIds = new Set(); inspector.hidden = true
    ui.source.$("svg")
    document.body.dataset.source = "svg"
    for (const id of ["arch", "sequence"]) document.querySelector(`#${id}`)?.setAttribute("aria-pressed", "false")
    rebuildGroupControls()
    const cyto = document.querySelector<HTMLButtonElement>("#renderer-cytoscape")!
    cyto.disabled = !bindingInput.bindings?.length
    cyto.title = cyto.disabled ? "Supply graph and SVG element bindings for native Cytoscape interaction." : "Native Cytoscape nodes and edges"
    await mount("document")
  } catch (error) { failure.$(String(error)) }
})

await useSource("sequence")
// The page entry is the runtime boundary; this subscription is its only one.
painted$.subscribe()

document.querySelector("#document")?.addEventListener("click", () => void mount("document"))
document.querySelector("#renderer-cytoscape")?.addEventListener("click", () => void mount("cytoscape"))
document.querySelector("#arch")?.addEventListener("click", () => void useSource("arch"))
document.querySelector("#sequence")?.addEventListener("click", () => void useSource("sequence"))
ribbonToggle.addEventListener("change", () => view.ribbon.$(ribbonToggle.checked))
groupsToggle.addEventListener("change", () => view.groups.$(groupsToggle.checked))
darkToggle.addEventListener("change", () => view.dark.$(darkToggle.checked))
document.querySelector("#fit")?.addEventListener("click", () => {
  const rootId = Object.keys(frame.presentation.sealedSvgArtifactsByRootId)[0]
  resource?.render(frame, { enterIds: [rootId], updateIds: [], exitIds: [] })
  cameraInput$.next(frame.camera)
})


let openingLab = false
document.querySelector("#layout-lab")?.addEventListener("click", async () => {
  if (openingLab) return
  if (layoutLab) { layoutLab.el.hidden = false; layoutLab.applyTheme(view.dark.$() === false ? "light" : "dark"); return }
  openingLab = true
  try {
    const { createGroupLayoutLab } = await import("./1_groupLayoutLab.ts")
    layoutLab = createGroupLayoutLab(document.body, view.dark.$() === false ? "light" : "dark")
  } finally { openingLab = false }
})
window.addEventListener("pagehide", () => { layoutLab?.unsubscribe(); layoutLab = undefined })
