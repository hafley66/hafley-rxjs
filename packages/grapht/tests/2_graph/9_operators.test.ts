import { Observable, Subject, firstValueFrom, lastValueFrom } from "rxjs"
import { describe, expect, test } from "vitest"
import type { Graph, GraphId } from "@hafley66/grapht-model"
import { graphLabelsOf, groupHeadersOf, ingest, layout, present } from "../../src/index.js"
import { validateSealedSvgArtifacts } from "../../src/index.js"
import type { GraphCamera, GraphFrame, GraphGeometry, SealedSvgArtifactsByRootId } from "../../src/index.js"

const graphOf = (id: GraphId): Graph => ({ [id]: { id, type: "node" } })

const geometryOf = (): GraphGeometry => ({
  revisionId: "g1",
  boundsById: {},
  endpointAnchorById: {},
  routesById: {},
  headerBoundsById: {
    header: { x: 0, y: 0, width: 100, height: 20 },
  },
})

const cameraOf = (overrides: Partial<GraphCamera> = {}): GraphCamera => ({
  x: 0,
  y: 0,
  scale: 1,
  viewport: { x: 0, y: 0, width: 800, height: 600 },
  ...overrides,
})

describe("graph operators", () => {
  test("ingest switches to the latest source revision and unsubscribes the older one", async () => {
    const source$ = new Subject<string>()
    const events: string[] = []
    const results = ingest<string, unknown, unknown>(source => {
      events.push(`start:${source}`)
      return new Observable<Graph>(subscriber => {
        if (source === "b") {
          subscriber.next(graphOf("b"))
          subscriber.complete()
        }
        return () => events.push(`teardown:${source}`)
      })
    })

    const frames: Graph[] = []
    source$.pipe(results).subscribe(graph => frames.push(graph))
    source$.next("a")
    source$.next("b")

    expect(events).toEqual(["start:a", "teardown:a", "start:b", "teardown:b"])
    expect(frames.map(graph => Object.keys(graph))).toEqual([["b"]])
  })

  test("layout switches to the latest graph and unsubscribes the older measurement", async () => {
    const graph$ = new Subject<Graph>()
    const events: string[] = []
    const results = layout<unknown, unknown>(graph => {
      const id = Object.keys(graph)[0]
      events.push(`start:${id}`)
      return new Observable<GraphGeometry>(subscriber => {
        if (id === "b") {
          subscriber.next(geometryOf())
          subscriber.complete()
        }
        return () => events.push(`teardown:${id}`)
      })
    })

    const emitted: string[] = []
    graph$.pipe(results).subscribe(({ graph }) => emitted.push(...Object.keys(graph)))
    graph$.next(graphOf("a"))
    graph$.next(graphOf("b"))

    expect(events).toEqual(["start:a", "teardown:a", "start:b", "teardown:b"])
    expect(emitted).toEqual(["b"])
  })

  test("aborts promise-backed ingest work when a newer source revision arrives", () => {
    const source$ = new Subject<string>()
    const events: string[] = []
    const results = ingest<string, unknown, unknown>((source, signal) => {
      events.push(`start:${source}`)
      if (source === "b") return graphOf("b")
      return new Promise<Graph>(resolve => {
        signal.addEventListener(
          "abort",
          () => {
            events.push(`abort:${source}`)
            resolve(graphOf(source))
          },
          { once: true },
        )
      })
    })

    const emitted: string[] = []
    source$.pipe(results).subscribe(graph => emitted.push(...Object.keys(graph)))
    source$.next("a")
    source$.next("b")

    expect({ events, emitted }).toMatchInlineSnapshot(`
      {
        "emitted": [
          "b",
        ],
        "events": [
          "start:a",
          "abort:a",
          "start:b",
        ],
      }
    `)
  })

  test("present combines graph, geometry, camera, and focus into a frame with sticky headers", async () => {
    const camera$ = new Subject<GraphCamera>()
    const focusIds$ = new Subject<ReadonlySet<GraphId>>()
    const selectionIds$ = new Subject<ReadonlySet<GraphId>>()

    const pipeline = present<unknown, unknown>({ camera$, focusIds$, selectionIds$, inset: 8, gap: 4 })

    const graph = graphOf("header")
    const input$ = new Subject<{ graph: Graph; geometry: GraphGeometry }>()
    const promise = firstValueFrom(input$.pipe(pipeline))

    camera$.next(cameraOf())
    focusIds$.next(new Set(["header"]))
    selectionIds$.next(new Set())

    input$.next({ graph, geometry: geometryOf() })

    const frame = await promise
    expect({
      stickyHeaders: frame.presentation.stickyHeaders,
      focusedIds: [...frame.presentation.focusedIds],
      labelsById: frame.presentation.labelsById,
      camera: frame.camera,
    }).toMatchInlineSnapshot(`
      {
        "camera": {
          "scale": 1,
          "viewport": {
            "height": 600,
            "width": 800,
            "x": 0,
            "y": 0,
          },
          "x": 0,
          "y": 0,
        },
        "focusedIds": [
          "header",
        ],
        "labelsById": {
          "header": {
            "text": "header",
          },
        },
        "stickyHeaders": [
          {
            "depth": 0,
            "id": "header",
            "state": "stuck",
            "top": 8,
            "visible": true,
          },
        ],
      }
    `)
  })

  test("groupHeadersOf derives headers from geometry bounds", () => {
    const geometry = {
      ...geometryOf(),
      boundsById: { header: { x: 0, y: 0, width: 100, height: 240 } },
    }
    expect(groupHeadersOf(geometry)).toMatchInlineSnapshot(`
      [
        {
          "boundaryBottom": 240,
          "height": 20,
          "id": "header",
          "naturalTop": 0,
          "order": 0,
        },
      ]
    `)
  })

  test("graphLabelsOf projects label, name, and id precedence for nodes, edges, and group headers", () => {
    const graph: Graph = {
      group: { id: "group", type: "node", data: { label: "Group label", name: "Group name" } },
      node: { id: "node", type: "node", parentId: "group", data: { name: "Node name" } },
      edge: { id: "edge", type: "edge", parentId: "group", fromId: "group", toId: "node", direction: "forward", data: { label: "Edge label", name: "Edge name" } },
      fallback: { id: "fallback", type: "node" },
    }

    expect(graphLabelsOf(graph)).toMatchInlineSnapshot(`
      {
        "edge": {
          "text": "Edge label",
        },
        "fallback": {
          "text": "fallback",
        },
        "group": {
          "text": "Group label",
        },
        "node": {
          "text": "Node name",
        },
      }
    `)
  })

  test("present re-emits when camera changes without a new graph", async () => {
    const camera$ = new Subject<GraphCamera>()
    const focusIds$ = new Subject<ReadonlySet<GraphId>>()
    const selectionIds$ = new Subject<ReadonlySet<GraphId>>()

    const pipeline = present<unknown, unknown>({ camera$, focusIds$, selectionIds$, inset: 8, gap: 4 })
    const input$ = new Subject<{ graph: Graph; geometry: GraphGeometry }>()

    const frames: number[] = []
    const sub = input$.pipe(pipeline).subscribe(frame => frames.push(frame.presentation.stickyHeaders[0].top))

    camera$.next(cameraOf())
    focusIds$.next(new Set())
    selectionIds$.next(new Set())
    input$.next({ graph: graphOf("header"), geometry: geometryOf() })

    await new Promise(resolve => setTimeout(resolve, 0))
    camera$.next(cameraOf({ y: 50 }))
    await new Promise(resolve => setTimeout(resolve, 0))
    sub.unsubscribe()

    expect(frames.length).toBeGreaterThanOrEqual(1)
    expect(frames.at(-1)).toBe(50)
  })

  test("present retains labels across camera emissions and replaces them with the next graph geometry", () => {
    const camera$ = new Subject<GraphCamera>()
    const focusIds$ = new Subject<ReadonlySet<GraphId>>()
    const selectionIds$ = new Subject<ReadonlySet<GraphId>>()
    const input$ = new Subject<{ graph: Graph; geometry: GraphGeometry }>()
    const frames: GraphFrame[] = []
    const sub = input$.pipe(present({ camera$, focusIds$, selectionIds$ })).subscribe(frame => frames.push(frame))

    camera$.next(cameraOf())
    focusIds$.next(new Set())
    selectionIds$.next(new Set())
    input$.next({ graph: graphOf("one"), geometry: geometryOf() })
    camera$.next(cameraOf({ x: 20 }))
    input$.next({ graph: graphOf("two"), geometry: { ...geometryOf(), revisionId: "g2" } })
    sub.unsubscribe()

    expect({
      cameraReusedLabels: frames[0].presentation.labelsById === frames[1].presentation.labelsById,
      graphGeometryReplacedLabels: frames[1].presentation.labelsById !== frames[2].presentation.labelsById,
      texts: frames.map(frame => frame.presentation.labelsById),
    }).toMatchInlineSnapshot(`
      {
        "cameraReusedLabels": true,
        "graphGeometryReplacedLabels": true,
        "texts": [
          {
            "one": {
              "text": "one",
            },
          },
          {
            "one": {
              "text": "one",
            },
          },
          {
            "two": {
              "text": "two",
            },
          },
        ],
      }
    `)
  })

  test("present retains sealed SVG artifact records across camera emissions and replaces artifact emissions", () => {
    const camera$ = new Subject<GraphCamera>()
    const focusIds$ = new Subject<ReadonlySet<GraphId>>()
    const selectionIds$ = new Subject<ReadonlySet<GraphId>>()
    const sealedSvgArtifactsByRootId$ = new Subject<SealedSvgArtifactsByRootId>()
    const input$ = new Subject<{ graph: Graph; geometry: GraphGeometry }>()
    const frames: GraphFrame[] = []
    const graph: Graph = {
      sequence: {
        id: "sequence",
        type: "node",
        layout: { mode: "sealed", bounds: { x: 10, y: 20, width: 100, height: 80 }, geometryRevisionId: "sequence:geometry:1" },
      },
    }
    const first: SealedSvgArtifactsByRootId = {
      sequence: { rootId: "sequence", revisionId: "sequence:svg:1", geometryRevisionId: "sequence:geometry:1", svg: "<svg/>", sourceBounds: { x: 10, y: 20, width: 100, height: 80 }, fit: "contain" },
    }
    const second: SealedSvgArtifactsByRootId = {
      sequence: { ...first.sequence, revisionId: "sequence:svg:2", svg: "<svg><g/></svg>" },
    }
    const sub = input$.pipe(present({ camera$, focusIds$, selectionIds$, sealedSvgArtifactsByRootId$ })).subscribe(frame => frames.push(frame))

    camera$.next(cameraOf())
    focusIds$.next(new Set())
    selectionIds$.next(new Set())
    sealedSvgArtifactsByRootId$.next(first)
    input$.next({ graph, geometry: geometryOf() })
    camera$.next(cameraOf({ x: 20 }))
    sealedSvgArtifactsByRootId$.next(second)
    sub.unsubscribe()

    expect({
      cameraReusesArtifactRecord: frames[0].presentation.sealedSvgArtifactsByRootId === frames[1].presentation.sealedSvgArtifactsByRootId,
      artifactEmissionReplacesRecord: frames[1].presentation.sealedSvgArtifactsByRootId !== frames[2].presentation.sealedSvgArtifactsByRootId,
      revisions: frames.map(frame => frame.presentation.sealedSvgArtifactsByRootId?.sequence.revisionId),
    }).toMatchInlineSnapshot(`
      {
        "artifactEmissionReplacesRecord": true,
        "cameraReusesArtifactRecord": true,
        "revisions": [
          "sequence:svg:1",
          "sequence:svg:1",
          "sequence:svg:2",
        ],
      }
    `)
  })

  test("rejects sealed SVG artifact geometry revision and source-bounds mismatches", () => {
    const graph: Graph = {
      sequence: {
        id: "sequence",
        type: "node",
        layout: { mode: "sealed", bounds: { x: 10, y: 20, width: 100, height: 80 }, geometryRevisionId: "sequence:geometry:1" },
      },
    }
    const artifact = { rootId: "sequence", revisionId: "sequence:svg:1", geometryRevisionId: "sequence:geometry:1", svg: "<svg/>", sourceBounds: { x: 10, y: 20, width: 100, height: 80 }, fit: "contain" } as const

    expect(() => validateSealedSvgArtifacts(graph, { sequence: { ...artifact, geometryRevisionId: "sequence:geometry:stale" } })).toThrow("sealed SVG artifact sequence geometry revision sequence:geometry:stale does not match sealed layout revision sequence:geometry:1")
    expect(() => validateSealedSvgArtifacts(graph, { sequence: { ...artifact, sourceBounds: { ...artifact.sourceBounds, x: 11 } } })).toThrow("sealed SVG artifact sequence source bounds do not match sealed layout bounds")
  })
})
