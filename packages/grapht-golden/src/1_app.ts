import {
  composeGraphGeometryScopes,
  fcoseGraphLayout,
  fitGraphCamera,
  layout,
  present,
  svgGraphGeometryOf,
  translateGraphGeometry,
  type GraphCamera,
  type GraphTranslations,
  type RendererInteractions,
} from "@hafley66/grapht/browser"
import type { GraphId } from "@hafley66/grapht-model"
import { resolvePortLocation } from "@hafley66/grapht-model"
import { cytoscapeGraphRenderer } from "@hafley66/grapht-render-cytoscape"
import { pixiGraphRenderer } from "@hafley66/grapht-render-pixijs"
import {
  BehaviorSubject,
  distinctUntilChanged,
  map,
  merge,
  Observable,
  of,
  shareReplay,
  scan,
  startWith,
  Subject,
  switchMap,
  type OperatorFunction,
  Subscription,
  withLatestFrom,
} from "rxjs"
import { goldenScenarios, type GoldenScenario, type GoldenScenarioId } from "./0_fixture.js"

export type RendererId = "cytoscape" | "pixi"
type RendererMap<Frame, Id extends string> = Readonly<Record<Id, (host: HTMLElement) => OperatorFunction<Frame, Frame>>>

function required<Element extends HTMLElement>(selector: string): Element {
  const element = document.querySelector<Element>(selector)
  if (element === null) throw new Error(`Missing golden app element: ${selector}`)
  return element
}

function idsText(ids: ReadonlySet<GraphId>): string {
  return [...ids].sort().join(", ") || "none"
}

function viewportOf(host: HTMLElement) {
  return { x: 0, y: 0, width: host.clientWidth, height: host.clientHeight }
}

export function renderRendererSelection<Frame, Id extends string>(
  host: HTMLElement,
  frame$: Observable<Frame>,
  rendererId$: Observable<Id>,
  renderers: RendererMap<Frame, Id>,
): Subscription {
  return rendererId$
    .pipe(
      distinctUntilChanged(),
      switchMap(rendererId => frame$.pipe(renderers[rendererId](host))),
    )
    .subscribe()
}

function framesForScenario(
  host: HTMLElement,
  scenario: GoldenScenario,
  interactions: RendererInteractions,
  resetCamera$: Observable<void>,
  stickyCamera$: Observable<void>,
  focusedIds$: Observable<ReadonlySet<GraphId>>,
  selectedIds$: Observable<ReadonlySet<GraphId>>,
  translationsById$: Observable<GraphTranslations>,
) {
  const nativeGraphGeometry$ = of(scenario.graph).pipe(
    layout(fcoseGraphLayout),
    map(graphGeometry => {
      const artifacts = Object.values(scenario.sealedSvgArtifactsByRootId)
      if (artifacts.length === 0) return graphGeometry
      return {
        graph: graphGeometry.graph,
        geometry: composeGraphGeometryScopes(
          graphGeometry.geometry,
          graphGeometry.graph,
          artifacts.map(artifact => ({
            rootId: artifact.rootId,
            geometry: svgGraphGeometryOf(document, artifact),
            fit: artifact.fit,
          })),
        ),
      }
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  )
  const graphGeometry$ = translationsById$.pipe(
    withLatestFrom(nativeGraphGeometry$),
    map(([translations, graphGeometry]) => ({ graph: graphGeometry.graph, geometry: translateGraphGeometry(graphGeometry.graph, graphGeometry.geometry, translations) })),
    shareReplay({ bufferSize: 1, refCount: true }),
  )
  const fittedCamera$ = graphGeometry$.pipe(
    map(({ geometry }) => fitGraphCamera(geometry, viewportOf(host), 40)),
    shareReplay({ bufferSize: 1, refCount: true }),
  )
  const camera$ = merge(
    fittedCamera$,
    resetCamera$.pipe(withLatestFrom(fittedCamera$), map(([, camera]) => camera)),
    stickyCamera$.pipe(
      withLatestFrom(graphGeometry$, fittedCamera$),
      map(([, { geometry }, camera]) => {
        const deepestHeader = Object.values(geometry.headerBoundsById).sort((left, right) => right.y - left.y)[0]
        return deepestHeader === undefined ? camera : { ...camera, y: 12 - deepestHeader.y * camera.scale - 32 }
      }),
    ),
    interactions.cameraInput$,
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }))

  return graphGeometry$.pipe(
    present({
      camera$,
      focusIds$: focusedIds$,
      selectionIds$: selectedIds$,
      sealedSvgArtifactsByRootId$: of(scenario.sealedSvgArtifactsByRootId),
      translationsById$,
      inset: 12,
      gap: 8,
    }),
    map(frame => ({
      ...frame,
      presentation: {
        ...frame.presentation,
        resolvedPortsById: Object.fromEntries(scenario.ports.map(port => {
          const ownerBounds = frame.geometry.boundsById[port.ownerId] ?? { x: 0, y: 0, width: 1, height: 1 }
          return [port.id, resolvePortLocation(port.location, { ownerBounds, pathsById: frame.geometry.routesById })]
        })),
      },
    })),
  )
}

export function mountGolden(): Subscription {
  const host = required<HTMLDivElement>("#graph")
  const renderer = required<HTMLSelectElement>("#renderer")
  const scenario = required<HTMLSelectElement>("#scenario")
  const resetCamera = required<HTMLButtonElement>("#reset-camera")
  const showSticky = required<HTMLButtonElement>("#show-sticky")
  const cameraOutput = required<HTMLOutputElement>("#camera")
  const focusedOutput = required<HTMLOutputElement>("#focused-ids")
  const selectedOutput = required<HTMLOutputElement>("#selected-ids")

  const moveInput$ = new Subject<{ id: GraphId; dx: number; dy: number }>()
  const interactions: RendererInteractions = {
    cameraInput$: new Subject<GraphCamera>(),
    focusInput$: new Subject<ReadonlySet<GraphId>>(),
    selectionInput$: new Subject<ReadonlySet<GraphId>>(),
    moveInput$,
  }
  const resetCamera$ = new Subject<void>()
  const stickyCamera$ = new Subject<void>()
  const focusedIds$ = new BehaviorSubject<ReadonlySet<GraphId>>(new Set())
  const selectedIds$ = new BehaviorSubject<ReadonlySet<GraphId>>(new Set())
  const rendererId$ = new BehaviorSubject<RendererId>(renderer.value as RendererId)
  const scenarioId$ = new BehaviorSubject<GoldenScenarioId>(scenario.value as GoldenScenarioId)
  const translationsById$ = moveInput$.pipe(
    scan((translations: GraphTranslations, move) => {
      const current = translations[move.id] ?? { x: 0, y: 0 }
      return { ...translations, [move.id]: { x: current.x + move.dx, y: current.y + move.dy } }
    }, {}),
    startWith({} as GraphTranslations),
    shareReplay({ bufferSize: 1, refCount: true }),
  )
  const frame$ = scenarioId$.pipe(
    distinctUntilChanged(),
    switchMap(id => framesForScenario(host, goldenScenarios[id], interactions, resetCamera$, stickyCamera$, focusedIds$, selectedIds$, translationsById$)),
    shareReplay({ bufferSize: 1, refCount: true }),
  )
  const renderers = {
    cytoscape: cytoscapeGraphRenderer(interactions),
    pixi: pixiGraphRenderer({ interactions }),
  }

  const subscriptions = new Subscription()
  subscriptions.add(interactions.focusInput$.subscribe(focusedIds$))
  subscriptions.add(interactions.selectionInput$.subscribe(selectedIds$))
  subscriptions.add(renderRendererSelection(host, frame$, rendererId$, renderers))
  subscriptions.add(frame$.subscribe(frame => {
    cameraOutput.value = `camera: ${JSON.stringify(frame.camera)}`
    host.dataset.graphtTranslations = JSON.stringify(frame.presentation.translationsById ?? {})
    host.dataset.graphtPortKinds = goldenScenarios[scenarioId$.value].ports.map(port => port.location.kind).join(",")
  }))
  subscriptions.add(focusedIds$.subscribe(ids => { focusedOutput.value = `focused: ${idsText(ids)}` }))
  subscriptions.add(selectedIds$.subscribe(ids => { selectedOutput.value = `selected: ${idsText(ids)}` }))

  const onRendererChange = (): void => rendererId$.next(renderer.value as RendererId)
  const onScenarioChange = (): void => scenarioId$.next(scenario.value as GoldenScenarioId)
  const onResetCamera = (): void => resetCamera$.next()
  const onShowSticky = (): void => stickyCamera$.next()
  renderer.addEventListener("change", onRendererChange)
  scenario.addEventListener("change", onScenarioChange)
  resetCamera.addEventListener("click", onResetCamera)
  showSticky.addEventListener("click", onShowSticky)
  subscriptions.add(() => {
    renderer.removeEventListener("change", onRendererChange)
    scenario.removeEventListener("change", onScenarioChange)
    resetCamera.removeEventListener("click", onResetCamera)
    showSticky.removeEventListener("click", onShowSticky)
  })
  return subscriptions
}
