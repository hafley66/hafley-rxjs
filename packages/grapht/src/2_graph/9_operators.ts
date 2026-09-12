import type { Graph, GraphId } from "@hafley66/grapht-model"
import {
  combineLatest,
  from,
  isObservable,
  map,
  Observable,
  type OperatorFunction,
  of,
  switchMap,
} from "rxjs"
import type { GraphCamera, GraphFrame, GraphGeometry, GraphLabel } from "./0_frame.js"
import {
  EMPTY_SEALED_SVG_ARTIFACTS_BY_ROOT_ID,
  type SealedSvgArtifactsByRootId,
  validateSealedSvgArtifacts,
} from "./3_sealedSvgArtifact.js"
import { type GroupHeader, stackGroupHeaders } from "./6_stackGroupHeaders.js"
import type { Ingest, Layout } from "./7_operatorTypes.js"

function unwrap<T>(value: T | Promise<T> | Observable<T>): Observable<T> {
  if (isObservable(value)) return value
  return value instanceof Promise ? from(value) : of(value)
}

export type GraphWork<Input, Output> = (input: Input, signal: AbortSignal) => Output | Promise<Output> | Observable<Output>

function abortable<Input, Output>(work: GraphWork<Input, Output>, input: Input): Observable<Output> {
  return new Observable(subscriber => {
    const controller = new AbortController()
    const inner = unwrap(work(input, controller.signal)).subscribe({
      next: value => subscriber.next(value),
      error: error => subscriber.error(error),
      complete: () => subscriber.complete(),
    })
    return () => {
      controller.abort()
      inner.unsubscribe()
    }
  })
}

export function ingest<Source, NodeData, EdgeData>(
  lower: GraphWork<Source, Graph<NodeData, EdgeData>>,
): Ingest<Source, NodeData, EdgeData> {
  return source$ => source$.pipe(switchMap(source => abortable(lower, source)))
}

export function layout<NodeData, EdgeData>(
  measure: GraphWork<Graph<NodeData, EdgeData>, GraphGeometry>,
): Layout<NodeData, EdgeData> {
  return graph$ => graph$.pipe(switchMap(graph => abortable(measure, graph).pipe(map(geometry => ({ graph, geometry })))))
}

export function groupHeadersOf(geometry: GraphGeometry): GroupHeader[] {
  return Object.entries(geometry.headerBoundsById)
    .map(([id, headerBounds]) => {
      const groupBounds = geometry.boundsById[id]
      return {
        id,
        naturalTop: headerBounds.y,
        boundaryBottom: groupBounds ? groupBounds.y + groupBounds.height : headerBounds.y + headerBounds.height,
        height: headerBounds.height,
        order: 0,
      }
    })
    .sort((left, right) => left.naturalTop - right.naturalTop || left.id.localeCompare(right.id))
}

function labelOf(id: GraphId, data: unknown): GraphLabel {
  if (typeof data === "object" && data !== null) {
    const record = data as Record<string, unknown>
    if (typeof record.label === "string") return { text: record.label }
    if (typeof record.name === "string") return { text: record.name }
  }
  return { text: id }
}

export function graphLabelsOf(graph: Graph): Readonly<Record<GraphId, GraphLabel>> {
  return Object.fromEntries(
    Object.keys(graph)
      .sort()
      .map(id => [id, labelOf(id, graph[id].data)]),
  )
}

export function present<NodeData, EdgeData>(input: {
  camera$: Observable<GraphCamera>
  focusIds$: Observable<ReadonlySet<GraphId>>
  selectionIds$: Observable<ReadonlySet<GraphId>>
  sealedSvgArtifactsByRootId$?: Observable<SealedSvgArtifactsByRootId>
  translationsById$?: Observable<Readonly<Record<GraphId, { x: number; y: number }>>>
  inset?: number
  gap?: number
}): OperatorFunction<{ graph: Graph<NodeData, EdgeData>; geometry: GraphGeometry }, GraphFrame<NodeData, EdgeData>> {
  const inset = input.inset ?? 0
  const gap = input.gap ?? 0
  const sealedSvgArtifactsByRootId$ = input.sealedSvgArtifactsByRootId$ ?? of(EMPTY_SEALED_SVG_ARTIFACTS_BY_ROOT_ID)
  const translationsById$ = input.translationsById$ ?? of({})

  return graphGeometry$ => {
    const graphPresentation$ = combineLatest({
      graphGeometry: graphGeometry$.pipe(map(graphGeometry => ({
        ...graphGeometry,
        labelsById: graphLabelsOf(graphGeometry.graph),
      }))),
      sealedSvgArtifactsByRootId: sealedSvgArtifactsByRootId$,
    }).pipe(map(({ graphGeometry, sealedSvgArtifactsByRootId }) => ({
      ...graphGeometry,
      sealedSvgArtifactsByRootId: validateSealedSvgArtifacts(graphGeometry.graph, sealedSvgArtifactsByRootId),
    })))

    return combineLatest({
      graphPresentation: graphPresentation$,
      camera: input.camera$,
      focusIds: input.focusIds$,
      selectionIds: input.selectionIds$,
      translationsById: translationsById$,
    }).pipe(
      map(({ graphPresentation, camera, focusIds, selectionIds, translationsById }): GraphFrame<NodeData, EdgeData> => {
        const graphGeometry = graphPresentation
        const headers = groupHeadersOf(graphGeometry.geometry)
        const stickyHeaders = stackGroupHeaders({
          graph: graphGeometry.graph,
          headers,
          camera,
          inset,
          gap,
        })
        return {
          graph: graphGeometry.graph,
          geometry: graphGeometry.geometry,
          camera,
          presentation: {
            stickyHeaders,
            focusedIds: new Set([...focusIds, ...selectionIds]),
            hiddenIds: new Set<GraphId>(),
            labelsById: graphGeometry.labelsById,
            sealedSvgArtifactsByRootId: graphPresentation.sealedSvgArtifactsByRootId,
            translationsById,
          },
        }
      }),
    )
  }
}
