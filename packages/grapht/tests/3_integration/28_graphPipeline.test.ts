import { Observable, Subject } from "rxjs"
import { describe, expect, test } from "vitest"
import type { Graph, GraphId } from "@hafley66/grapht-model"
import {
  fcoseGraphLayout,
  layout,
  present,
  type GraphCamera,
  type GraphFrame,
  type RendererInteractions,
} from "../../src/index.js"

function graph(): Graph {
  return {
    outer: { id: "outer", type: "node", data: { label: "Outer group" } },
    left: { id: "left", type: "node", parentId: "outer", data: { label: "Left group" } },
    nested: { id: "nested", type: "node", parentId: "left", data: { label: "Nested group" } },
    deepLeaf: { id: "deepLeaf", type: "node", parentId: "nested", data: { label: "Deep leaf" } },
    right: { id: "right", type: "node", parentId: "outer", data: { label: "Right group" } },
    rightLeaf: { id: "rightLeaf", type: "node", parentId: "right", data: { label: "Right leaf" } },
    directed: { id: "directed", type: "edge", parentId: "outer", fromId: "deepLeaf", toId: "rightLeaf", direction: "forward", data: { label: "Directed" } },
    parallel: { id: "parallel", type: "edge", parentId: "outer", fromId: "deepLeaf", toId: "rightLeaf", direction: "forward", data: { label: "Parallel" } },
    undirected: { id: "undirected", type: "edge", parentId: "outer", fromId: "deepLeaf", toId: "rightLeaf", direction: "none", data: { label: "Undirected" } },
    bidirectional: { id: "bidirectional", type: "edge", parentId: "outer", fromId: "deepLeaf", toId: "rightLeaf", direction: "both", data: { label: "Bidirectional" } },
    edgeToEdge: { id: "edgeToEdge", type: "edge", parentId: "outer", fromId: "directed", toId: "bidirectional", direction: "forward", data: { label: "Edge to edge" } },
  }
}

function camera(overrides: Partial<GraphCamera> = {}): GraphCamera {
  return {
    x: 0,
    y: 0,
    scale: 1,
    viewport: { x: 0, y: 0, width: 800, height: 600 },
    ...overrides,
  }
}

function interactions(): RendererInteractions {
  return {
    cameraInput$: new Subject<GraphCamera>(),
    focusInput$: new Subject<ReadonlySet<GraphId>>(),
    selectionInput$: new Subject<ReadonlySet<GraphId>>(),
  }
}

function edgeDirectionsOf(graph: GraphFrame["graph"]): Record<string, { fromId: string; toId: string; direction: string }> {
  const directions: Record<string, { fromId: string; toId: string; direction: string }> = {}
  for (const [id, item] of Object.entries(graph)) {
    if (item.type !== "edge") continue
    directions[id] = { fromId: item.fromId, toId: item.toId, direction: item.direction }
  }
  return directions
}

function frameProjection(frame: GraphFrame) {
  const round = (value: number): number => Math.round(value * 1000) / 1000
  const rectangles = (boundsById: GraphFrame["geometry"]["boundsById"]): Record<string, Record<string, number>> =>
    Object.fromEntries(Object.entries(boundsById).map(([id, bounds]) => [id, Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, round(value)]))]))
  return {
    boundsById: rectangles(frame.geometry.boundsById),
    headerBoundsById: rectangles(frame.geometry.headerBoundsById),
    routes: Object.fromEntries(Object.entries(frame.geometry.routesById).map(([id, route]) => [id, route.length])),
    edgeDirections: edgeDirectionsOf(frame.graph),
    labelsById: frame.presentation.labelsById,
    stickyHeaders: frame.presentation.stickyHeaders.map(header => ({
      ...header,
      top: Math.round(header.top * 1000) / 1000,
    })),
  }
}

describe("canonical graph layout presentation pipeline", () => {
  test("preserves compound geometry, route kinds, labels, and interaction identities in GraphFrame", () => {
    const graph$ = new Subject<Graph>()
    const input = interactions()
    const frames: GraphFrame[] = []
    const subscription = graph$
      .pipe(
        layout(fcoseGraphLayout),
        present({
          camera$: input.cameraInput$,
          focusIds$: input.focusInput$,
          selectionIds$: input.selectionInput$,
          inset: 8,
          gap: 4,
        }),
      )
      .subscribe(frame => frames.push(frame))

    input.cameraInput$.next(camera())
    input.focusInput$.next(new Set())
    input.selectionInput$.next(new Set())
    graph$.next(graph())
    input.cameraInput$.next(camera({ x: 20 }))
    input.focusInput$.next(new Set(["deepLeaf"]))
    input.selectionInput$.next(new Set(["rightLeaf"]))
    graph$.next(graph())

    const [first, cameraOnly, focusOnly, selectionOnly, nextGraph] = frames
    expect(frames).toHaveLength(5)
    expect({
      cameraOnly: {
        graph: cameraOnly.graph === first.graph,
        geometry: cameraOnly.geometry === first.geometry,
        labelsById: cameraOnly.presentation.labelsById === first.presentation.labelsById,
      },
      focusOnly: {
        graph: focusOnly.graph === first.graph,
        geometry: focusOnly.geometry === first.geometry,
        labelsById: focusOnly.presentation.labelsById === first.presentation.labelsById,
      },
      selectionOnly: {
        graph: selectionOnly.graph === first.graph,
        geometry: selectionOnly.geometry === first.geometry,
        labelsById: selectionOnly.presentation.labelsById === first.presentation.labelsById,
      },
      nextGraph: {
        graph: nextGraph.graph === first.graph,
        geometry: nextGraph.geometry === first.geometry,
        labelsById: nextGraph.presentation.labelsById === first.presentation.labelsById,
      },
      focusedIds: [...selectionOnly.presentation.focusedIds].sort(),
    }).toMatchInlineSnapshot(`
      {
        "cameraOnly": {
          "geometry": true,
          "graph": true,
          "labelsById": true,
        },
        "focusOnly": {
          "geometry": true,
          "graph": true,
          "labelsById": true,
        },
        "focusedIds": [
          "deepLeaf",
          "rightLeaf",
        ],
        "nextGraph": {
          "geometry": false,
          "graph": false,
          "labelsById": false,
        },
        "selectionOnly": {
          "geometry": true,
          "graph": true,
          "labelsById": true,
        },
      }
    `)
    expect(frameProjection(first)).toMatchInlineSnapshot(`
      {
        "boundsById": {
          "deepLeaf": {
            "height": 34,
            "width": 50,
            "x": -1051.733,
            "y": 11.495,
          },
          "left": {
            "height": 136,
            "width": 152,
            "x": -1102.733,
            "y": -39.505,
          },
          "nested": {
            "height": 85,
            "width": 101,
            "x": -1077.233,
            "y": -14.005,
          },
          "outer": {
            "height": 266.487,
            "width": 469.466,
            "x": -1128.233,
            "y": -133.243,
          },
          "right": {
            "height": 85,
            "width": 101,
            "x": -785.267,
            "y": -53.253,
          },
          "rightLeaf": {
            "height": 34,
            "width": 50,
            "x": -759.767,
            "y": -27.753,
          },
        },
        "edgeDirections": {
          "bidirectional": {
            "direction": "both",
            "fromId": "deepLeaf",
            "toId": "rightLeaf",
          },
          "directed": {
            "direction": "forward",
            "fromId": "deepLeaf",
            "toId": "rightLeaf",
          },
          "edgeToEdge": {
            "direction": "forward",
            "fromId": "directed",
            "toId": "bidirectional",
          },
          "parallel": {
            "direction": "forward",
            "fromId": "deepLeaf",
            "toId": "rightLeaf",
          },
          "undirected": {
            "direction": "none",
            "fromId": "deepLeaf",
            "toId": "rightLeaf",
          },
        },
        "headerBoundsById": {
          "left": {
            "height": 24,
            "width": 152,
            "x": -1102.733,
            "y": -39.505,
          },
          "nested": {
            "height": 24,
            "width": 101,
            "x": -1077.233,
            "y": -14.005,
          },
          "outer": {
            "height": 24,
            "width": 469.466,
            "x": -1128.233,
            "y": -133.243,
          },
          "right": {
            "height": 24,
            "width": 101,
            "x": -785.267,
            "y": -53.253,
          },
        },
        "labelsById": {
          "bidirectional": {
            "text": "Bidirectional",
          },
          "deepLeaf": {
            "text": "Deep leaf",
          },
          "directed": {
            "text": "Directed",
          },
          "edgeToEdge": {
            "text": "Edge to edge",
          },
          "left": {
            "text": "Left group",
          },
          "nested": {
            "text": "Nested group",
          },
          "outer": {
            "text": "Outer group",
          },
          "parallel": {
            "text": "Parallel",
          },
          "right": {
            "text": "Right group",
          },
          "rightLeaf": {
            "text": "Right leaf",
          },
          "undirected": {
            "text": "Undirected",
          },
        },
        "routes": {
          "bidirectional": 6,
          "directed": 6,
          "edgeToEdge": 6,
          "parallel": 6,
          "undirected": 6,
        },
        "stickyHeaders": [
          {
            "depth": 0,
            "id": "outer",
            "state": "stuck",
            "top": 8,
            "visible": true,
          },
          {
            "depth": 1,
            "id": "right",
            "state": "released",
            "top": -53.253,
            "visible": false,
          },
          {
            "depth": 1,
            "id": "left",
            "state": "stuck",
            "top": 36,
            "visible": true,
          },
          {
            "depth": 2,
            "id": "nested",
            "state": "stuck",
            "top": 64,
            "visible": true,
          },
        ],
      }
    `)
    expect(frameProjection(nextGraph).boundsById).toEqual(frameProjection(first).boundsById)
    expect(frameProjection(nextGraph).headerBoundsById).toEqual(frameProjection(first).headerBoundsById)

    subscription.unsubscribe()
    expect({
      graph: graph$.observed,
      camera: input.cameraInput$.observed,
      focus: input.focusInput$.observed,
      selection: input.selectionInput$.observed,
    }).toEqual({ graph: false, camera: false, focus: false, selection: false })
  })

  test("switches a pending layout observable after its synchronous fCoSE execution", () => {
    const graph$ = new Subject<Graph>()
    const events: string[] = []
    const frames: string[] = []
    const subscription = graph$
      .pipe(
        layout((value, signal) =>
          new Observable(subscriber => {
            const id = Object.keys(value)[0]
            events.push(`layout:${id}`)
            const geometry = fcoseGraphLayout(value, signal)
            if (id === "second") {
              subscriber.next(geometry)
              subscriber.complete()
            }
            return () => events.push(`teardown:${id}:aborted=${signal.aborted}`)
          }),
        ),
      )
      .subscribe(({ graph: value }) => frames.push(Object.keys(value)[0]))

    graph$.next({ first: { id: "first", type: "node" } })
    graph$.next({ second: { id: "second", type: "node" } })
    subscription.unsubscribe()

    expect({ events, frames, sourceObserved: graph$.observed }).toMatchInlineSnapshot(`
      {
        "events": [
          "layout:first",
          "teardown:first:aborted=true",
          "layout:second",
          "teardown:second:aborted=false",
        ],
        "frames": [
          "second",
        ],
        "sourceObserved": false,
      }
    `)
  })

  test("rejects pre-aborted and invalid fCoSE inputs before they produce geometry", () => {
    const aborted = new AbortController()
    aborted.abort(new Error("layout pre-aborted"))
    const invalid: Graph = {
      edge: { id: "edge", type: "edge", fromId: "missing", toId: "alsoMissing", direction: "forward" },
    }

    expect(() => fcoseGraphLayout({ node: { id: "node", type: "node" } }, aborted.signal)).toThrow("layout pre-aborted")
    expect(() => fcoseGraphLayout(invalid, new AbortController().signal)).toThrow(
      "edge edge references missing endpoint missing\nedge edge references missing endpoint alsoMissing",
    )
  })

  test("ends the graph subscription when layout work throws", () => {
    const graph$ = new Subject<Graph>()
    const errors: string[] = []
    graph$
      .pipe(
        layout(() => {
          throw new Error("layout execution failed")
        }),
      )
      .subscribe({ error: error => errors.push((error as Error).message) })

    graph$.next({ node: { id: "node", type: "node" } })

    expect({ errors, sourceObserved: graph$.observed }).toEqual({
      errors: ["layout execution failed"],
      sourceObserved: false,
    })
  })
})
