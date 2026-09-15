import { documentFingerprint } from "@hafley66/grapht-model"
import { moveGraphFrame, movementOffsets, type GraphMove, type MoveHistory } from "../../../src/2_graph/23_manualMovement.ts"
import { d2SvgFrame } from "../../../src/2_graph/22_d2SvgFrame.ts"
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
import { animationFrameScheduler, auditTime, distinctUntilChanged, BehaviorSubject, EMPTY, merge, scan, Subject, switchMap, tap } from "rxjs"
import { Signal, StorageSignal, storageSignal, urlAdapter, sync } from "@hafley66/signals"
import { createDocumentGraphFrameResource } from "../8_documentRenderer.ts"
import { fitGraphCamera } from "../../../src/2_graph/1_fitCamera.ts"
import type { Observable } from "rxjs"
import type { GraphCamera, GraphFrame } from "../../../src/2_graph/0_frame.ts"
import { sequenceFrame } from "./0_sequenceFrame.ts"
import { describeSvgInference, formatSvgInferStep, svgInferSequence, type SvgInferExample } from "./5_svgInfer.ts"
import { svgInferFrame, type SvgInferStep } from "../../../src/2_graph/24_svgInfer.ts"

type Mode = "document" | "cytoscape"
type Source = "arch" | "sequence" | "svg" | "paired-d2" | "paired-mermaid" | SvgInferExample

const cameraInput$ = new Subject<GraphCamera>()
const focusInput$ = new Subject<ReadonlySet<string>>()
const collapseInput$ = new Subject<string>()
const moveInput$ = new Subject<GraphMove>()
const selectionInput$ = new Subject<ReadonlySet<string>>()

const host = document.querySelector<HTMLElement>("#host") as HTMLElement
const readoutElement = document.querySelector<HTMLElement>("#readout") as HTMLElement

const archSvg = await (await fetch("./arch.svg")).text()
const artifactFrame = d2SvgFrame(document, archSvg, archSource, { width: innerWidth, height: innerHeight })

const ui = Signal({ mode: "document" as Mode, source: "arch" as Source })
const camera = Signal(cameraInput$, artifactFrame.camera)
/** One store for the view switches, kept across reloads by the signals library's storage backend. */
const view = StorageSignal("grapht.proof.view", { ribbon: true, groups: true, legend: false, dark: true })

const hoverColors = StorageSignal("grapht.proof.hop-colors", false)
const hoverColorToggle = document.querySelector<HTMLInputElement>("#hover-color-mode")!
hoverColorToggle.addEventListener("change", () => hoverColors.$(hoverColorToggle.checked))
const hopGradient = StorageSignal("grapht.proof.hop-gradient", { enabled: true, from: "#fbbf24", to: "#38bdf8", distance: 6 })
const gradientControls = ["hop-interpolate", "hop-from", "hop-to", "hop-distance"].map(id => document.querySelector<HTMLInputElement>(`#${id}`)!)
for (const input of gradientControls) input.addEventListener("input", () => hopGradient.$({ enabled: gradientControls[0].checked, from: gradientControls[1].value, to: gradientControls[2].value, distance: Math.max(1, Math.min(20, Number(gradientControls[3].value) || 1)) }))
const hoverStyle = () => ({ ...GRAPH_STYLES[view.dark.$() === false ? "light" : "dark"], hopGradient: hopGradient.$().enabled ? hopGradient.$() : undefined, hopMode: hoverColors.$() ? "color" as const : "fade" as const })

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

const fitMode = StorageSignal<"contain" | "width" | "height" | "readable">("grapht.proof.fit-mode", "contain")
const fitSelect = document.querySelector<HTMLSelectElement>("#fit-mode")!
fitSelect.value = fitMode.$()

const failure = Signal("")

// Parse scan history: every inference step of every run, oldest first. Read it with .$().
type InferEntry = { source: Source; step: SvgInferStep }
const inferStep$ = new Subject<InferEntry>()
const inferSteps = Signal(
  inferStep$.pipe(scan((steps: InferEntry[], entry) => [...steps, entry], [] as InferEntry[])),
  [] as InferEntry[],
)
const inferReport = Signal("")
const inferPanel = document.querySelector<HTMLElement>("#infer-panel")!
const inferReportElement = document.querySelector<HTMLElement>("#infer-report")!
const inferStepsElement = document.querySelector<HTMLElement>("#infer-steps")!

declare global {
  interface Window {
    graphtInfer?: { steps: typeof inferSteps; report: typeof inferReport; svgInferFrame: typeof svgInferFrame }
  }
}
window.graphtInfer = { steps: inferSteps, report: inferReport, svgInferFrame }

const readout = Signal(() => {
  const current = camera.$()
  const broken = failure.$()
  if (broken !== "") return broken
  return `${ui.source.$()} | ${ui.mode.$()} | camera x ${current.x.toFixed(0)} y ${current.y.toFixed(0)} scale ${current.scale.toFixed(3)}`
})
type StickyResource = {
  applyWheelSettings?: (settings: WheelSettings) => void
  applyHover?: (hops: Readonly<Record<string, number>>) => void
  render: import("../../../src/2_graph/10_renderer.ts").GraphFrameResource["render"]
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


let resource: StickyResource | undefined

async function importCytoscape(host: HTMLElement, generation: number) {
  try {
    const { createCytoscapeGraphFrameResource } = await import("../6_graphRenderer.ts")
    if (generation !== mountGeneration) return undefined
    const resource = createCytoscapeGraphFrameResource(host, { cameraInput$, focusInput$, selectionInput$, collapseInput$, moveInput$ }, { ...view.$(), inset: 44, fullWidth: 70, chipWidth: 34, gap: 4 })
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
// An atomic document write owns source and collapse state. Camera and hover do not invalidate geometry.
const documentState = Signal({ original: artifactFrame, collapsed: new Set<string>() })
const collapsedFrame = Signal(() => collapseSequenceFrame(document, documentState.$().original, documentState.$().collapsed))
const editing = Signal(false)
const movePreview = Signal<GraphMove | undefined>(undefined)
const movementHistory = StorageSignal<Record<string, MoveHistory>>("grapht.proof.movement-history", {})
const movementKey = Signal(() => documentFingerprint(Object.values(documentState.$().original.presentation.sealedSvgArtifactsByRootId).map(artifact => artifact.source)))
const activeHistory = Signal(() => movementHistory.$()[movementKey.$()] ?? { events: [], cursor: 0 })
const frame = Signal(() => {
  const current = collapsedFrame.$()
  return moveGraphFrame(current, movementOffsets(current, activeHistory.$(), movePreview.$()), editing.$())
})
const hoveredIds = Signal<ReadonlySet<string>>(new Set<string>())
const hoverOptions = Signal({ mode: "both" as HoverMode, depth: 2, relations: "actors", debug: false })
const hops = Signal(() => {
  const current = frame.$()
  const options = { ...hoverOptions.$(), components: documentState.$().collapsed }
  return options.relations === "sequence" ? sequenceNeighborhood(current.graph as SequenceGraph, hoveredIds.$(), options) : graphNeighborhood(current.graph, hoveredIds.$(), options)
})
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

function paintInspector(): void {
  const currentHops = hops.$()
  if (!hoverOptions.$().debug) { inspector.hidden = true; return }
  if (!hoveredIds.$().size) return
  inspector.hidden = false
  inspector.textContent = "Last hover\n" + [...hoveredIds.$()].map(id => {
    const item = frame.$().graph[id]
    const data = item?.data as { kind?: string; label?: string; sourceSpan?: { lineStart: number; lineEnd: number } } | undefined
    const route = frame.$().geometry.routesById[id]
    const artifacts = Object.values(frame.$().presentation.sealedSvgArtifactsByRootId)
    const bindings = artifacts.flatMap(artifact => artifact.bindings?.filter(binding => binding.graphId === id) ?? [])
    const relations = Object.values(frame.$().graph).filter(other => other.parentId === id || other.type === "edge" && (other.fromId === id || other.toId === id))
    return [
      `${data?.kind ?? item?.type ?? "unknown"}: ${data?.label ?? frame.$().presentation.labelsById[id]?.text ?? ""}`,
      `id: ${id}`, `parent: ${item?.parentId ?? "none"}`, `hop: ${currentHops[id] ?? "outside mode/depth"}`,
      `bounds: ${JSON.stringify(frame.$().geometry.boundsById[id] ?? null)}`,
      `anchor: ${JSON.stringify(frame.$().geometry.endpointAnchorById[id] ?? null)}`,
      ...(item?.type === "edge" ? [`from: ${item.fromId}`, `to: ${item.toId}`] : []),
      ...(route ? [`route start: ${JSON.stringify([...route.slice(0, 2)])}`, `route end: ${JSON.stringify([...route.slice(-2)])}`, `route points: ${route.length / 2}`] : []),
      ...(data?.sourceSpan ? [`source lines: ${data.sourceSpan.lineStart}..${data.sourceSpan.lineEnd}`] : []),
      '"bindings":', ...bindings.map(binding => `  ${binding.role}: ${binding.elementId}`),
      "relations:", ...relations.map(other => other.type === "edge" ? `  ${other.id}: ${other.fromId} -> ${other.toId}` : `  contains ${other.id}`),
    ].join("\n")
  }).join("\n\n")
}
for (const input of [hoverMode, hoverRelations, hoverDepth, hoverDebug]) input.addEventListener("change", () => hoverOptions.$({ mode: hoverMode.value as HoverMode, relations: hoverRelations.value, depth: Number(hoverDepth.value), debug: hoverDebug.checked }))
document.querySelector("#source-text")!.addEventListener("click", () => {
  const preview = document.querySelector<HTMLElement>("#source-preview")!
  preview.hidden = !preview.hidden
  preview.textContent = Object.values(frame.$().presentation.sealedSvgArtifactsByRootId).map(artifact => artifact.source?.text ?? "Source text unavailable for this artifact.").join("\n")
})

function rebuildGroupControls(current: GraphFrame): void {
  const controls = document.querySelector<HTMLElement>("#collapse-controls")!
  controls.replaceChildren()
  for (const id of Object.keys(current.geometry.headerBoundsById)) {
    if (current.presentation.hiddenIds.has(id)) continue
    const label = document.createElement("label")
    label.style.display = "block"
    const input = document.createElement("input")
    input.type = "checkbox"
    input.dataset.collapseId = id
    input.checked = documentState.$().collapsed.has(id)
    label.append(input, `Collapse ${current.presentation.labelsById[id]?.text ?? id}`)
    input.addEventListener("change", () => collapseInput$.next(id))
    controls.appendChild(label)
  }
  const actors = document.querySelector<HTMLSelectElement>("#actor-members")!
  const selected = new Set([...actors.selectedOptions].map(option => option.value))
  actors.replaceChildren(...Object.keys(documentState.$().original.geometry.columnBoundsById ?? {}).map(id => {
    const option = document.createElement("option")
    option.value = id; option.selected = selected.has(id); option.textContent = documentState.$().original.presentation.labelsById[id]?.text ?? id
    return option
  }))
}
let actorGroupOrdinal = 0
document.querySelector("#group-actors")!.addEventListener("click", () => {
  const actors = document.querySelector<HTMLSelectElement>("#actor-members")!
  const name = document.querySelector<HTMLInputElement>("#actor-group-name")!.value
  try {
    documentState.$({ ...documentState.$(), original: groupSequenceActors(documentState.$().original, `view-actor-group:${++actorGroupOrdinal}`, [...actors.selectedOptions].map(option => option.value), name) })
    failure.$("")
  } catch (error) { failure.$(String(error)) }
})

let mountGeneration = 0
async function mount(next: Mode): Promise<void> {
  const interactive = Object.values(frame.$().presentation.sealedSvgArtifactsByRootId).some(
    artifact => artifact.bindings?.length || Object.keys(artifact.graphIdByElementId ?? {}).length > 0,
  )
  if (next === "cytoscape" && !interactive) return
  const generation = ++mountGeneration
  mounted$.next(undefined)
  resource?.unsubscribe()
  host.replaceChildren()
  failure.$("")
  ui.mode.$(next)

  const acquired =
    next === "document"
      ? createDocumentGraphFrameResource(host, { cameraInput$, focusInput$, collapseInput$, moveInput$ }, { ...view.$(), inset: 44, fullWidth: 70, chipWidth: 34, gap: 4 })
      : await importCytoscape(host, generation)
  if (generation !== mountGeneration) { acquired?.unsubscribe(); return }
  resource = acquired
  resource?.applyWheelSettings?.(wheelSettings.$())
  resource?.applyTheme?.(hoverStyle())
  mounted$.next(resource)
}

let sourceGeneration = 0
async function loadSource(next: Exclude<Source, "svg">): Promise<{ frame: GraphFrame; report: string }> {
  if (next === "arch") return { frame: artifactFrame, report: "" }
  if (next === "sequence-svg" || next === "paired-d2-svg" || next === "paired-mermaid-svg") {
    const inferred = await svgInferSequence({ width: window.innerWidth, height: window.innerHeight }, next, step => inferStep$.next({ source: next, step }))
    return { frame: inferred.frame, report: describeSvgInference(inferred) }
  }
  return { frame: await sequenceFrame({ width: window.innerWidth, height: window.innerHeight }, next), report: "" }
}

async function useSource(next: Exclude<Source, "svg">): Promise<void> {
  const generation = ++sourceGeneration
  let loaded: { frame: GraphFrame; report: string }
  try {
    loaded = await loadSource(next)
  } catch (error) {
    failure.$(`${next} failed: ${String(error).slice(0, 240)}`)
    return
  }
  if (generation !== sourceGeneration) return
  ui.source.$(next)
  cameraInput$.next(fitGraphCamera(loaded.frame.geometry, { x: 0, y: 0, width: innerWidth, height: innerHeight }, 24, fitMode.$()))
  documentState.$({ original: loaded.frame, collapsed: new Set<string>() })
  hoveredIds.$(new Set())
  inspector.hidden = true
  document.body.setAttribute("data-source", next)
  document.querySelector("#arch")?.setAttribute("aria-pressed", String(next === "arch"))
  document.querySelector("#sequence")?.setAttribute("aria-pressed", String(next === "sequence"))
  document.querySelector("#svg-parse")?.setAttribute("aria-pressed", String(next.endsWith("-svg")))
  const pairedSelect = document.querySelector<HTMLSelectElement>("#paired-example")!
  pairedSelect.value = [...pairedSelect.options].some(option => option.value === next) ? next : ""
  inferReport.$(loaded.report)
  const cytoButton = document.querySelector<HTMLButtonElement>("#renderer-cytoscape")!
  cytoButton.disabled = false
  cytoButton.title = "Native Cytoscape nodes and edges"
  await mount(ui.mode.$())
}

document.querySelector<HTMLInputElement>("#svg-import")!.addEventListener("change", async event => {
  const files = [...(event.target as HTMLInputElement).files ?? []]
  const source = files.find(file => file.name.toLowerCase().endsWith(".svg"))
  if (!source) return
  try {
    const metadata = files.find(file => file.name.toLowerCase().endsWith(".json"))
    const bindingInput: Pick<SvgFrameInput, "graph" | "bindings"> = metadata ? JSON.parse(await metadata.text()) : {}
    const loaded = svgFrame(document, { svg: await source.text(), locator: source.name, graph: bindingInput.graph, bindings: bindingInput.bindings, viewport: { width: innerWidth, height: innerHeight } })
    cameraInput$.next(fitGraphCamera(loaded.geometry, { x: 0, y: 0, width: innerWidth, height: innerHeight }, 24, fitMode.$()))
    documentState.$({ original: loaded, collapsed: new Set<string>() })
    hoveredIds.$(new Set()); inspector.hidden = true
    ui.source.$("svg")
    document.body.dataset.source = "svg"
    for (const id of ["arch", "sequence"]) document.querySelector(`#${id}`)?.setAttribute("aria-pressed", "false")
    const cyto = document.querySelector<HTMLButtonElement>("#renderer-cytoscape")!
    cyto.disabled = !bindingInput.bindings?.length
    cyto.title = cyto.disabled ? "Supply graph and SVG element bindings for native Cytoscape interaction." : "Native Cytoscape nodes and edges"
    await mount("document")
  } catch (error) { failure.$(String(error)) }
})

const painted$ = merge(
  perf.painted$,
  moveInput$.pipe(tap(move => {
    if (move.phase === "cancel") { movePreview.$(undefined); return }
    if (move.phase !== "commit") { movePreview.$(move); return }
    const history = activeHistory.$()
    // Clear the preview before committing so the final frame never adds the delta twice.
    movePreview.$(undefined)
    if (!move.dx && !move.dy) return
    const events = [...history.events.slice(0, history.cursor), { ...move, phase: "commit" as const }]
    movementHistory.$({ ...movementHistory.$(), [movementKey.$()]: { events, cursor: events.length } })
  })),
  activeHistory.$.pipe(tap(history => {
    document.querySelector<HTMLButtonElement>("#undo-move")!.disabled = history.cursor === 0
    document.querySelector<HTMLButtonElement>("#redo-move")!.disabled = history.cursor === history.events.length
  })),
  hopGradient.$.pipe(tap(value => {
    gradientControls[0].checked = value.enabled
    gradientControls[1].value = value.from
    gradientControls[2].value = value.to
    gradientControls[3].value = String(value.distance)
    paintHopLegend()
  })),
  ui.mode.$.pipe(tap(mode => {
    document.querySelector("#document")!.setAttribute("aria-pressed", String(mode === "document"))
    document.querySelector("#renderer-cytoscape")!.setAttribute("aria-pressed", String(mode === "cytoscape"))
  })),
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
    const collapsed = new Set(documentState.$().collapsed)
    if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id)
    documentState.$({ ...documentState.$(), collapsed })
  })),
  collapsedFrame.$.pipe(tap(current => rebuildGroupControls(current))),
  hops.$.pipe(tap(() => paintInspector())),
  hoverColors.$.pipe(tap(on => { hoverColorToggle.checked = on; paintHopLegend() })),
  focusInput$.pipe(
    auditTime(0, animationFrameScheduler),
    distinctUntilChanged((left, right) => left.size === right.size && [...left].every(id => right.has(id))),
    tap(ids => hoveredIds.$(ids)),
  ),
  readout.$.pipe(tap(text => { readoutElement.textContent = text })),
  inferReport.$.pipe(tap(text => {
    inferReportElement.textContent = text
    inferPanel.hidden = text === ""
  })),
  inferSteps.$.pipe(tap(entries => {
    inferStepsElement.textContent = entries.map(entry => formatSvgInferStep(entry.source, entry.step)).join("\n")
  })),
  view.ribbon.$.pipe(tap(on => { ribbonToggle.checked = on })),
  view.groups.$.pipe(tap(on => { groupsToggle.checked = on })),
  view.dark.$.pipe(tap(on => { darkToggle.checked = on !== false; layoutLab?.applyTheme(on === false ? "light" : "dark")
    paintHopLegend()
  })),
  mounted$.pipe(
    switchMap(current =>
      merge(
        frame.$.pipe(tap(next => current?.render({ ...next, camera: camera.$(), presentation: { ...next.presentation, hopsById: hops.$() } }, { enterIds: [], updateIds: [], exitIds: [] }))),
        hops.$.pipe(tap(value => current?.applyHover?.(value))),
        wheelSettings.$.pipe(tap(settings => current?.applyWheelSettings?.(settings))),
        view.$.pipe(tap(next => current?.applySticky?.({ ribbon: next.ribbon, groups: next.groups }))),
        merge(view.dark.$, hoverColors.$, hopGradient.$).pipe(tap(() => current?.applyTheme?.(hoverStyle()))),
        view.legend.$.pipe(tap(open => current?.legend?.setOpen(open))),
        current?.legend?.toggled$.pipe(tap(open => view.legend.$(open))) ?? EMPTY,
      ),
    ),
  ),
)

document.querySelector<HTMLInputElement>("#edit-movement")!.addEventListener("change", event => editing.$((event.target as HTMLInputElement).checked))
for (const [id, delta] of [["undo-move", -1], ["redo-move", 1]] as const) document.querySelector(`#${id}`)!.addEventListener("click", () => {
  const history = activeHistory.$()
  movementHistory.$({ ...movementHistory.$(), [movementKey.$()]: { ...history, cursor: Math.max(0, Math.min(history.events.length, history.cursor + delta)) } })
})
// The page entry is the runtime boundary; this subscription is its only one.
const runtime = painted$.subscribe()
await useSource("sequence")

document.querySelector("#document")?.addEventListener("click", () => void mount("document"))
document.querySelector("#renderer-cytoscape")?.addEventListener("click", () => void mount("cytoscape"))
document.querySelector<HTMLSelectElement>("#paired-example")!.addEventListener("change", event => {
  const value = (event.target as HTMLSelectElement).value
  if (value) void useSource(value as "paired-d2" | "paired-mermaid" | SvgInferExample)
})
// A/B between the source parse and the SVG parse of the same diagram.
document.querySelector("#svg-parse")?.addEventListener("click", () => {
  const current = ui.source.$()
  const next =
    current === "sequence" ? "sequence-svg"
    : current === "sequence-svg" ? "sequence"
    : current === "paired-d2" ? "paired-d2-svg"
    : current === "paired-d2-svg" ? "paired-d2"
    : current === "paired-mermaid" ? "paired-mermaid-svg"
    : current === "paired-mermaid-svg" ? "paired-mermaid"
    : "paired-d2-svg"
  void useSource(next)
})
document.querySelector("#arch")?.addEventListener("click", () => void useSource("arch"))
document.querySelector("#sequence")?.addEventListener("click", () => void useSource("sequence"))
ribbonToggle.addEventListener("change", () => view.ribbon.$(ribbonToggle.checked))
groupsToggle.addEventListener("change", () => view.groups.$(groupsToggle.checked))
darkToggle.addEventListener("change", () => view.dark.$(darkToggle.checked))
function fitView(): void {
  const rootId = Object.keys(frame.$().presentation.sealedSvgArtifactsByRootId)[0]
  const fitted = fitGraphCamera(frame.$().geometry, { x: 0, y: 0, width: innerWidth, height: innerHeight }, 24, fitMode.$())
  resource?.render({ ...frame.$(), camera: fitted }, { enterIds: [rootId], updateIds: [], exitIds: [] })
  cameraInput$.next(fitted)
}
document.querySelector("#fit")?.addEventListener("click", fitView)
window.addEventListener("resize", fitView)
fitSelect.addEventListener("change", () => { fitMode.$(fitSelect.value as "contain" | "width" | "height" | "readable"); fitView() })


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
window.addEventListener("pagehide", () => { runtime.unsubscribe(); resource?.unsubscribe(); mounted$.complete(); layoutLab?.unsubscribe(); layoutLab = undefined })
