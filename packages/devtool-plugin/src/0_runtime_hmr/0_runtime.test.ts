// import { BehaviorSubject, filter, map, of, of as rxjsOf, Subject, take } from "rxjs"
// import { describe, expect, it } from "vitest"
// import { main } from "../0_runtime/0_store"
// import { __$ } from "./0_runtime"
// import { useTrackingTestSetup } from "./0_test-utils"
// import { findTrackByKey } from "./1_queries"
// import { trackedSubject } from "./3_tracked-subject"

// describe("__$ HMR runtime", () => {
//   useTrackingTestSetup(true)

//   it("tracks observable creation", () => {
//     const obs = __$("oof", () => of(1, 2, 3))

//     expect(findTrackByKey(main.state$.value, "oof")).toMatchInlineSnapshot(`
//       {
//         "created_at": 0,
//         "created_at_end": 0,
//         "id": "0",
//         "index": 0,
//         "key": "oof",
//         "module_id": "test",
//         "module_version": 1,
//         "mutable_observable_id": "1",
//         "parent_track_id": undefined,
//         "prev_observable_ids": [],
//         "stable_observable_id": "11",
//         "version": 0,
//       }
//     `)
//   })

//   it("tracks nested scopes with child $ tracker", () => {
//     __$("root", $ => {
//       return $("child", () => of(1))
//     })
//     expect(main.state$.value.store.hmr_track).toMatchInlineSnapshot(`
//       {
//         "0": {
//           "created_at": 0,
//           "created_at_end": 0,
//           "id": "0",
//           "index": 0,
//           "key": "oof",
//           "module_id": "test",
//           "module_version": 1,
//           "mutable_observable_id": "1",
//           "parent_track_id": undefined,
//           "prev_observable_ids": [],
//           "stable_observable_id": "11",
//           "version": 0,
//         },
//         "1": {
//           "created_at": 0,
//           "created_at_end": 0,
//           "id": "1",
//           "index": 0,
//           "key": "root:child",
//           "module_id": "test",
//           "module_version": 2,
//           "mutable_observable_id": "2",
//           "parent_track_id": "0",
//           "prev_observable_ids": [],
//           "stable_observable_id": "6",
//           "version": 0,
//         },
//       }
//     `)
//   })

//   it("tracks pipe - last entity in scope wins", () => {
//     __$("test:pipe", () =>
//       of(1, 2, 3).pipe(
//         map(x => x * 2),
//         take(2),
//       ),
//     )

//     expect(main.state$.value.store.hmr_module).toMatchInlineSnapshot(`
//       {
//         "test": {
//           "created_at": 0,
//           "id": "test",
//           "prev_keys": [
//             "oof",
//             "root:child",
//           ],
//           "url": "0_test-utils.ts",
//           "version": 3,
//         },
//       }
//     `)
//     expect(main.state$.value.store.hmr_track).toMatchInlineSnapshot(`
//       {
//         "0": {
//           "created_at": 0,
//           "created_at_end": 0,
//           "id": "0",
//           "index": 0,
//           "key": "oof",
//           "last_change_structural": true,
//           "module_id": "test",
//           "module_version": 3,
//           "mutable_observable_id": "19",
//           "parent_track_id": undefined,
//           "prev_observable_ids": [
//             "1",
//           ],
//           "stable_observable_id": "11",
//           "version": 1,
//         },
//         "1": {
//           "created_at": 0,
//           "created_at_end": 0,
//           "id": "1",
//           "index": 0,
//           "key": "root:child",
//           "module_id": "test",
//           "module_version": 2,
//           "mutable_observable_id": "2",
//           "parent_track_id": "0",
//           "prev_observable_ids": [],
//           "stable_observable_id": "6",
//           "version": 0,
//         },
//       }
//     `)
//     expect(main.state$.value.store.observable).toMatchInlineSnapshot(`
//       {
//         "1": {
//           "created_at": 0,
//           "created_at_end": 0,
//           "id": "1",
//           "name": "of(1,2,3)",
//           "obs_ref": WeakRef {},
//         },
//         "11": {
//           "created_at": 0,
//           "created_at_end": 0,
//           "id": "11",
//           "name": "new Observable",
//           "obs_ref": WeakRef {},
//         },
//         "17": {
//           "created_at": 0,
//           "created_at_end": 0,
//           "id": "17",
//           "name": "of(1,2,3).map(fn)",
//           "obs_ref": WeakRef {},
//         },
//         "19": {
//           "created_at": 0,
//           "created_at_end": 0,
//           "id": "19",
//           "name": "of(1,2,3).map(fn).take(2)",
//           "obs_ref": WeakRef {},
//         },
//         "2": {
//           "created_at": 0,
//           "created_at_end": 0,
//           "id": "2",
//           "name": "of(1)",
//           "obs_ref": WeakRef {},
//         },
//         "6": {
//           "created_at": 0,
//           "created_at_end": 0,
//           "id": "6",
//           "name": "new Observable",
//           "obs_ref": WeakRef {},
//         },
//       }
//     `)
//   })

//   it("wraps function returns to re-push track on each call", () => {
//     const getObs = __$("test:fn", () => {
//       return (n: number) => of(n)
//     })

//     expect(findTrackByKey(main.state$.value, "test:fn")).toMatchInlineSnapshot(`undefined`)

//     getObs(1)
//     getObs(2)

//     expect(findTrackByKey(main.state$.value, "test:fn")).toMatchInlineSnapshot(`
//       {
//         "created_at": 0,
//         "created_at_end": 0,
//         "id": "6",
//         "index": 0,
//         "key": "test:fn",
//         "module_id": "test",
//         "module_version": 4,
//         "mutable_observable_id": "7",
//         "parent_track_id": undefined,
//         "prev_observable_ids": [],
//         "stable_observable_id": "11",
//         "version": 0,
//       }
//     `)
//   })

//   it("stack.hmr_track.at(-1) returns current track during scope", () => {
//     let capturedTrack: (typeof main.state$.value.stack.hmr_track)[number] | undefined

//     __$("test:peek", () => {
//       capturedTrack = main.state$.value.stack.hmr_track.at(-1)
//       return of(1)
//     })

//     expect(capturedTrack?.id).toMatchInlineSnapshot(`"0"`)
//   })

//   it("tracks operator_fun when operators are called inside scope", () => {
//     __$("test:op", $ => {
//       return $("myMap", () => map((x: number) => x * 2))
//     })

//     expect(findTrackByKey(main.state$.value, "test:op:myMap")).toMatchInlineSnapshot(`undefined`)
//   })

//   it("detects fn-only change when structure same (last_change_structural: false)", () => {
//     // First execution
//     __$("test:hmr", () => of(1, 2, 3).pipe(map(x => x * 2)))
//     expect(main.state$.value.store.observable).toMatchInlineSnapshot(`
//       {
//         "1": {
//           "created_at": 0,
//           "created_at_end": 0,
//           "id": "1",
//           "name": "of(1,2,3)",
//           "obs_ref": WeakRef {},
//         },
//         "11": {
//           "created_at": 0,
//           "created_at_end": 0,
//           "id": "11",
//           "name": "new Observable",
//           "obs_ref": WeakRef {},
//         },
//         "15": {
//           "created_at": 0,
//           "created_at_end": 0,
//           "id": "15",
//           "name": "of(1,2,3).map(fn)",
//           "obs_ref": WeakRef {},
//         },
//         "17": {
//           "created_at": 0,
//           "created_at_end": 0,
//           "id": "17",
//           "name": "of(1,2,3).map(fn)",
//           "obs_ref": WeakRef {},
//         },
//         "19": {
//           "created_at": 0,
//           "created_at_end": 0,
//           "id": "19",
//           "name": "of(1,2,3).map(fn).take(2)",
//           "obs_ref": WeakRef {},
//         },
//         "2": {
//           "created_at": 0,
//           "created_at_end": 0,
//           "id": "2",
//           "name": "of(1)",
//           "obs_ref": WeakRef {},
//         },
//         "6": {
//           "created_at": 0,
//           "created_at_end": 0,
//           "id": "6",
//           "name": "new Observable",
//           "obs_ref": WeakRef {},
//         },
//         "7": {
//           "created_at": 0,
//           "created_at_end": 0,
//           "id": "7",
//           "name": "of(2)",
//           "obs_ref": WeakRef {},
//         },
//       }
//     `)
//     const track1 = findTrackByKey(main.state$.value, "test:hmr")!
//     const mutableId1 = track1.mutable_observable_id
//     const obs1Name = main.state$.value.store.observable[mutableId1]?.name
//     expect(track1.version).toBe(0)

//     // Simulate HMR: same structure, different fn body
//     __$("test:hmr", () => of(1, 2, 3).pipe(map(x => x * 3)))
//     const track2 = findTrackByKey(main.state$.value, "test:hmr")!
//     const obs2Name = main.state$.value.store.observable[track2.mutable_observable_id]?.name

//     expect(track2.version).toBe(1)
//     expect(track2.prev_observable_ids).toContain(mutableId1)
//     // Same structure: of(1,2,3).map(fn) → of(1,2,3).map(fn)
//     expect(obs1Name).toBe(obs2Name) // Both should serialize the same
//     expect((track2 as any).last_change_structural).toBe(false)
//   })

//   it("detects structural change when operator added (last_change_structural: true)", () => {
//     // First execution
//     __$("test:structural", () => of(1, 2, 3).pipe(map(x => x * 2)))
//     const mutableId1 = findTrackByKey(main.state$.value, "test:structural")!.mutable_observable_id
//     const obs1Name = main.state$.value.store.observable[mutableId1]?.name

//     // Simulate HMR: added filter operator
//     __$("test:structural", () =>
//       of(1, 2, 3).pipe(
//         map(x => x * 2),
//         filter(x => x > 2),
//       ),
//     )

//     const track = findTrackByKey(main.state$.value, "test:structural")!
//     const obs2Name = main.state$.value.store.observable[track.mutable_observable_id]?.name

//     expect({
//       obs1Name,
//       obs2Name,
//       version: track.version,
//       structural: (track as any).last_change_structural,
//     }).toMatchInlineSnapshot(`
//       {
//         "obs1Name": "of(1,2,3).map(fn)",
//         "obs2Name": "of(1,2,3).map(fn).filter(fn)",
//         "structural": true,
//         "version": 1,
//       }
//     `)
//   })

//   it("detects structural change when primitive arg changes", () => {
//     // First execution
//     __$("test:primitive", () => of(1, 2, 3).pipe(take(5)))

//     // Simulate HMR: changed take count
//     __$("test:primitive", () => of(1, 2, 3).pipe(take(10)))

//     const track = findTrackByKey(main.state$.value, "test:primitive")!
//     expect(track.version).toBe(1)
//     // Different structure: take(5) → take(10)
//     expect((track as any).last_change_structural).toBe(true)
//   })

//   it("prepends subscription context to track path when inside send callback", () => {
//     // Use rxjsOf (not of) to avoid double decoration from Vite plugin + proxy wrapper
//     // The Vite plugin already decorates rxjs creation functions
//     const outer$ = __$("outer", () => rxjsOf(1))

//     // Capture event types after creation
//     // Subscribe to wrapper and capture sends during callback
//     let sendsDuringCallback: typeof main.state$.value.stack.send = []
//     let innerTrackId: string | undefined
//     outer$.subscribe(() => {
//       sendsDuringCallback = [...main.state$.value.stack.send]
//       // This __$ call happens during send - should get subscription context
//       __$("inner", () => {
//         innerTrackId = main.state$.value.stack.hmr_track.at(-1)?.id
//         return rxjsOf(2)
//       })
//     })

//     // Snapshot events and store for clarity
//     expect({ store: main.state$.value.store }).toMatchSnapshot()
//   })

//   it("nested child $ tracker also gets subscription context", () => {
//     // Wrap outer observable in __$ - returns tracked wrapper
//     const parent$ = __$("parent", () => of(1))

//     let sendStackDuringCallback: typeof main.state$.value.stack.send = []
//     let hmrTrackStackDuringCallback: typeof main.state$.value.stack.hmr_track = []

//     // Subscribe to the wrapper (what user code actually does)
//     parent$.subscribe(() => {
//       sendStackDuringCallback = [...main.state$.value.stack.send]
//       hmrTrackStackDuringCallback = [...main.state$.value.stack.hmr_track]
//       __$("level1", $ => {
//         return $("level2", () => of(2))
//       })
//     })

//     expect({
//       sendStack: sendStackDuringCallback.map(s => s.subscription_id),
//       hmrTrackStack: hmrTrackStackDuringCallback.map(t => t.id),
//       tracks: Object.keys(main.state$.value.store.hmr_track),
//     }).toMatchInlineSnapshot(`
//       {
//         "hmrTrackStack": [
//           "6",
//           "6",
//           "0",
//         ],
//         "sendStack": [
//           "6",
//           "5",
//         ],
//         "tracks": [
//           "0",
//           "1",
//           "6",
//           "9",
//           "10",
//           "16",
//         ],
//       }
//     `)
//   })
// })

// describe("trackedSubject bi-sync", () => {
//   useTrackingTestSetup(true)

//   it("next forwards to inner and emits on proxy", () => {
//     let rawInner: Subject<number> | undefined
//     __$("biSync", () => (rawInner = new Subject<number>()))
//     const trackId = findTrackByKey(main.state$.value, "biSync")!.id

//     const ts = trackedSubject<number>(trackId)
//     const innerValues: number[] = []
//     const proxyValues: number[] = []

//     rawInner!.subscribe(v => innerValues.push(v))
//     // Use pipe to subscribe directly to proxy's emissions (not forwarded to inner)
//     ;(ts as any)._subscribe({
//       next: (v: number) => proxyValues.push(v),
//     })

//     ts.next(1)
//     ts.next(2)

//     expect({ innerValues, proxyValues }).toMatchInlineSnapshot(`
//       {
//         "innerValues": [
//           1,
//           2,
//         ],
//         "proxyValues": [
//           1,
//           2,
//         ],
//       }
//     `)
//   })

//   it("inner.next forwards to proxy (captured raw inner)", () => {
//     let rawInner: Subject<number> | undefined
//     __$("innerForward", () => (rawInner = new Subject<number>()))
//     const trackId = findTrackByKey(main.state$.value, "innerForward")!.id

//     const ts = trackedSubject<number>(trackId)
//     const proxyValues: number[] = []

//     // Subscribe directly to proxy's internal subject
//     ;(ts as any)._subscribe({
//       next: (v: number) => proxyValues.push(v),
//     })

//     // Emit on raw inner - should forward to proxy
//     rawInner!.next(1)
//     rawInner!.next(2)

//     expect(proxyValues).toMatchInlineSnapshot(`
//       [
//         1,
//         2,
//       ]
//     `)
//   })

//   it("error and complete forward bidirectionally", () => {
//     let rawInner: Subject<number> | undefined
//     __$("errorComplete", () => (rawInner = new Subject<number>()))
//     const trackId = findTrackByKey(main.state$.value, "errorComplete")!.id

//     const ts = trackedSubject<number>(trackId)
//     let innerCompleted = false
//     let proxyCompleted = false

//     rawInner!.subscribe({ complete: () => (innerCompleted = true) })
//     ;(ts as any)._subscribe({ complete: () => (proxyCompleted = true) })

//     ts.complete()

//     expect({ innerCompleted, proxyCompleted }).toMatchInlineSnapshot(`
//       {
//         "innerCompleted": true,
//         "proxyCompleted": true,
//       }
//     `)
//   })

//   it("inner.complete forwards to proxy", () => {
//     let rawInner: Subject<number> | undefined
//     __$("innerComplete", () => (rawInner = new Subject<number>()))
//     const trackId = findTrackByKey(main.state$.value, "innerComplete")!.id

//     const ts = trackedSubject<number>(trackId)
//     let proxyCompleted = false

//     ;(ts as any)._subscribe({ complete: () => (proxyCompleted = true) })

//     rawInner!.complete()

//     expect(proxyCompleted).toBe(true)
//   })

//   it("no infinite loop when next triggers inner which triggers proxy", () => {
//     let rawInner: Subject<number> | undefined
//     __$("noLoop", () => (rawInner = new Subject<number>()))
//     const trackId = findTrackByKey(main.state$.value, "noLoop")!.id

//     const ts = trackedSubject<number>(trackId)
//     const values: number[] = []

//     // Subscribe to both to check for duplicates
//     rawInner!.subscribe(v => values.push(v))
//     ;(ts as any)._subscribe({ next: (v: number) => values.push(v) })

//     ts.next(1)

//     // Should only have 2 values (one from inner, one from proxy), not infinite
//     expect(values).toMatchInlineSnapshot(`
//       [
//         1,
//         1,
//       ]
//     `)
//   })
// })

// describe("trackedBehaviorSubject", () => {
//   useTrackingTestSetup(true)

//   it("getValue returns inner value", () => {
//     let rawInner: BehaviorSubject<number> | undefined
//     __$("bsValue", () => (rawInner = new BehaviorSubject(42)))
//     const trackId = findTrackByKey(main.state$.value, "bsValue")!.id

//     const tbs = trackedBehaviorSubject<number>(trackId, 0)

//     expect(tbs.getValue()).toBe(42)
//     expect(tbs.value).toBe(42)
//   })

//   it("next updates inner value", () => {
//     let rawInner: BehaviorSubject<number> | undefined
//     __$("bsNext", () => (rawInner = new BehaviorSubject(0)))
//     expect(main.state$.value.store).toMatchInlineSnapshot(`
//       {
//         "arg": {
//           "10": {
//             "created_at": 0,
//             "id": "10",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.2",
//             "value": 3,
//           },
//           "11": {
//             "created_at": 0,
//             "id": "11",
//             "is_function": false,
//             "observable_id": "10",
//             "owner_id": "10",
//             "path": "$args.0.0",
//             "value": 2,
//           },
//           "12": {
//             "created_at": 0,
//             "id": "12",
//             "is_function": false,
//             "observable_id": "11",
//             "owner_id": "11",
//             "path": "$args.0.0",
//             "value": 2,
//           },
//           "13": {
//             "created_at": 0,
//             "id": "13",
//             "is_function": false,
//             "observable_id": "11",
//             "owner_id": "11",
//             "path": "$args.0.0",
//             "value": 2,
//           },
//           "14": {
//             "created_at": 0,
//             "id": "14",
//             "is_function": false,
//             "observable_id": "11",
//             "owner_id": "11",
//             "path": "$args.0",
//             "value": 2,
//           },
//           "15": {
//             "created_at": 0,
//             "id": "15",
//             "is_function": false,
//             "owner_id": "14",
//             "path": "$args.0",
//             "value": 2,
//           },
//           "18": {
//             "created_at": 0,
//             "id": "18",
//             "is_function": false,
//             "observable_id": "17",
//             "owner_id": "17",
//             "path": "$args.0.0",
//             "value": 1,
//           },
//           "19": {
//             "created_at": 0,
//             "id": "19",
//             "is_function": false,
//             "observable_id": "17",
//             "owner_id": "17",
//             "path": "$args.0.1",
//             "value": 2,
//           },
//           "2": {
//             "created_at": 0,
//             "id": "2",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0.0",
//             "value": 1,
//           },
//           "20": {
//             "created_at": 0,
//             "id": "20",
//             "is_function": false,
//             "observable_id": "17",
//             "owner_id": "17",
//             "path": "$args.0.2",
//             "value": 3,
//           },
//           "21": {
//             "created_at": 0,
//             "id": "21",
//             "is_function": false,
//             "observable_id": "17",
//             "owner_id": "17",
//             "path": "$args.0.0",
//             "value": 1,
//           },
//           "22": {
//             "created_at": 0,
//             "id": "22",
//             "is_function": false,
//             "observable_id": "17",
//             "owner_id": "17",
//             "path": "$args.0.1",
//             "value": 2,
//           },
//           "23": {
//             "created_at": 0,
//             "id": "23",
//             "is_function": false,
//             "observable_id": "17",
//             "owner_id": "17",
//             "path": "$args.0.2",
//             "value": 3,
//           },
//           "24": {
//             "created_at": 0,
//             "id": "24",
//             "is_function": false,
//             "observable_id": "17",
//             "owner_id": "17",
//             "path": "$args.0",
//             "value": 1,
//           },
//           "25": {
//             "created_at": 0,
//             "id": "25",
//             "is_function": false,
//             "observable_id": "17",
//             "owner_id": "17",
//             "path": "$args.1",
//             "value": 2,
//           },
//           "26": {
//             "created_at": 0,
//             "id": "26",
//             "is_function": false,
//             "observable_id": "17",
//             "owner_id": "17",
//             "path": "$args.2",
//             "value": 3,
//           },
//           "29": {
//             "created_at": 0,
//             "id": "29",
//             "is_function": false,
//             "owner_id": "28",
//             "path": "$args.0",
//             "value": 10,
//           },
//           "3": {
//             "created_at": 0,
//             "id": "3",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0.0",
//             "value": 1,
//           },
//           "4": {
//             "created_at": 0,
//             "id": "4",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0",
//             "value": 1,
//           },
//           "5": {
//             "created_at": 0,
//             "id": "5",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0.0",
//             "value": 1,
//           },
//           "6": {
//             "created_at": 0,
//             "id": "6",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0.1",
//             "value": 2,
//           },
//           "7": {
//             "created_at": 0,
//             "id": "7",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0.2",
//             "value": 3,
//           },
//           "8": {
//             "created_at": 0,
//             "id": "8",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0",
//             "value": 1,
//           },
//           "9": {
//             "created_at": 0,
//             "id": "9",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.1",
//             "value": 2,
//           },
//         },
//         "arg_call": {},
//         "hmr_module": {
//           "test": {
//             "created_at": 0,
//             "id": "test",
//             "prev_keys": [
//               "oof",
//               "root:child",
//               "test:fn",
//               "$ref[11]:subscription[5]:inner",
//               "$ref[11]:subscription[5]:level1:level2",
//               "test:primitive",
//             ],
//             "url": "0_test-utils.ts",
//             "version": 18,
//           },
//         },
//         "hmr_track": {
//           "0": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "0",
//             "index": 0,
//             "key": "oof",
//             "last_change_structural": true,
//             "module_id": "test",
//             "module_version": 18,
//             "mutable_observable_id": "1",
//             "parent_track_id": undefined,
//             "prev_observable_ids": [
//               "1",
//               "19",
//               "1",
//               "15",
//             ],
//             "stable_observable_id": "11",
//             "version": 4,
//           },
//           "1": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "1",
//             "index": 0,
//             "key": "root:child",
//             "module_id": "test",
//             "module_version": 4,
//             "mutable_observable_id": "2",
//             "parent_track_id": "0",
//             "prev_observable_ids": [],
//             "stable_observable_id": "6",
//             "version": 0,
//           },
//           "10": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "10",
//             "index": 0,
//             "key": "$ref[11]:subscription[5]:level1:level2",
//             "module_id": "test",
//             "module_version": 11,
//             "mutable_observable_id": "11",
//             "parent_track_id": "9",
//             "prev_observable_ids": [],
//             "stable_observable_id": "15",
//             "version": 0,
//           },
//           "16": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "16",
//             "index": 0,
//             "key": "test:primitive",
//             "module_id": "test",
//             "module_version": 9,
//             "mutable_observable_id": "31",
//             "parent_track_id": undefined,
//             "prev_observable_ids": [],
//             "stable_observable_id": "32",
//             "version": 0,
//           },
//           "6": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "6",
//             "index": 0,
//             "key": "test:fn",
//             "module_id": "test",
//             "module_version": 4,
//             "mutable_observable_id": "7",
//             "parent_track_id": undefined,
//             "prev_observable_ids": [],
//             "stable_observable_id": "11",
//             "version": 0,
//           },
//           "9": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "9",
//             "index": 0,
//             "key": "$ref[11]:subscription[5]:inner",
//             "module_id": "test",
//             "module_version": 10,
//             "mutable_observable_id": "10",
//             "parent_track_id": "0",
//             "prev_observable_ids": [],
//             "stable_observable_id": "14",
//             "version": 0,
//           },
//         },
//         "observable": {
//           "1": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "1",
//             "name": "new BehaviorSubject",
//             "obs_ref": WeakRef {},
//           },
//           "10": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "10",
//             "name": "of(2)",
//             "obs_ref": WeakRef {},
//           },
//           "11": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "11",
//             "name": "of(2)",
//             "obs_ref": WeakRef {},
//           },
//           "14": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "14",
//             "name": "new Observable",
//             "obs_ref": WeakRef {},
//           },
//           "15": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "15",
//             "name": "new Observable",
//             "obs_ref": WeakRef {},
//           },
//           "17": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "17",
//             "name": "of(1,2,3)",
//             "obs_ref": WeakRef {},
//           },
//           "19": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "19",
//             "name": "of(1,2,3).map(fn).take(2)",
//             "obs_ref": WeakRef {},
//           },
//           "2": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "2",
//             "name": "of(1)",
//             "obs_ref": WeakRef {},
//           },
//           "31": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "31",
//             "name": "of(1,2,3).take(10)",
//             "obs_ref": WeakRef {},
//           },
//           "32": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "32",
//             "name": "new Observable",
//             "obs_ref": WeakRef {},
//           },
//           "6": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "6",
//             "name": "new Observable",
//             "obs_ref": WeakRef {},
//           },
//           "7": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "7",
//             "name": "of(2)",
//             "obs_ref": WeakRef {},
//           },
//         },
//         "operator": {
//           "14": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "14",
//             "index": 0,
//             "operator_fun_id": "12",
//             "pipe_id": "11",
//             "source_observable_id": "1",
//             "target_observable_id": "15",
//           },
//           "16": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "16",
//             "index": 0,
//             "operator_fun_id": "12",
//             "pipe_id": "11",
//             "source_observable_id": "1",
//             "target_observable_id": "17",
//           },
//           "18": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "18",
//             "index": 1,
//             "operator_fun_id": "14",
//             "pipe_id": "11",
//             "source_observable_id": "17",
//             "target_observable_id": "19",
//           },
//           "30": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "30",
//             "index": 0,
//             "operator_fun_id": "28",
//             "pipe_id": "27",
//             "source_observable_id": "17",
//             "target_observable_id": "31",
//           },
//         },
//         "operator_fun": {
//           "12": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "12",
//             "name": "take(5)",
//           },
//           "14": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "14",
//             "name": "take(2)",
//           },
//           "2": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "2",
//             "name": "map(fn)",
//           },
//           "28": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "28",
//             "name": "take(10)",
//           },
//         },
//         "pipe": {
//           "11": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "11",
//             "observable_id": "15",
//             "parent_observable_id": "1",
//           },
//           "27": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "27",
//             "observable_id": "31",
//             "parent_observable_id": "17",
//           },
//         },
//         "send": {
//           "15": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "15",
//             "observable_id": "7",
//             "subscription_id": "6",
//             "type": "complete",
//           },
//           "16": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "16",
//             "observable_id": "7",
//             "subscription_id": "6",
//             "type": "complete",
//           },
//           "17": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "17",
//             "observable_id": "11",
//             "subscription_id": "5",
//             "type": "complete",
//           },
//           "7": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "7",
//             "observable_id": "7",
//             "subscription_id": "6",
//             "type": "next",
//             "value": 2,
//           },
//           "8": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "8",
//             "observable_id": "11",
//             "subscription_id": "5",
//             "type": "next",
//             "value": 2,
//           },
//         },
//         "subscription": {
//           "5": {
//             "created_at": 0,
//             "created_at_end": 0,
//             "id": "5",
//             "is_sync": false,
//             "module_id": "test",
//             "observable_id": "11",
//             "parent_subscription_id": undefined,
//             "sub_ref": WeakRef {},
//           },
//         },
//       }
//     `)
//     const trackId = findTrackByKey(main.state$.value, "bsNext")!.id

//     const tbs = trackedBehaviorSubject<number>(trackId, -1)

//     tbs.next(100)

//     expect(rawInner!.value).toBe(100)
//     expect(tbs.value).toBe(100)
//   })

//   it("inner.next updates proxy value", () => {
//     let rawInner: BehaviorSubject<number> | undefined
//     __$("bsInnerNext", () => (rawInner = new BehaviorSubject(0)))
//     const trackId = findTrackByKey(main.state$.value, "bsInnerNext")!.id

//     const tbs = trackedBehaviorSubject<number>(trackId, -1)

//     rawInner!.next(200)

//     // Proxy should reflect inner's value
//     expect(tbs.value).toBe(200)
//   })

//   it("bi-sync with next/error/complete", () => {
//     let rawInner: BehaviorSubject<number> | undefined
//     __$("bsBiSync", () => (rawInner = new BehaviorSubject(0)))
//     const trackId = findTrackByKey(main.state$.value, "bsBiSync")!.id

//     const tbs = trackedBehaviorSubject<number>(trackId, -1)
//     const innerValues: number[] = []
//     const proxyValues: number[] = []

//     rawInner!.subscribe(v => innerValues.push(v))
//     ;(tbs as any)._subscribe({ next: (v: number) => proxyValues.push(v) })

//     tbs.next(1)
//     rawInner!.next(2)

//     expect({ innerValues, proxyValues }).toMatchInlineSnapshot(`
//       {
//         "innerValues": [
//           0,
//           1,
//           2,
//         ],
//         "proxyValues": [
//           0,
//           1,
//           2,
//         ],
//       }
//     `)
//   })
// })

// // NOTE: getDanglingSubscriptions requires subscriptions to be tracked.
// // Subscriptions are only tracked when inside a __$ scope (track context required by shouldEmit).
// // These tests are skipped pending investigation of track context isolation between tests.
// describe.skip("getDanglingSubscriptions", () => {
//   useTrackingTestSetup({ fakeTrack: true })

//   it("subscription to current tracked entity is not dangling", () => {
//     let subj: Subject<number>
//     __$("tracked", () => (subj = new Subject<number>()))
//     subj!.subscribe()
//     expect(getDanglingSubscriptions(main.state$.value.store)).toMatchInlineSnapshot(`[]`)
//   })

//   it("detects orphaned subscription after HMR swap", () => {
//     let subj1: Subject<number>
//     __$("swappable", () => (subj1 = new Subject<number>()))
//     subj1!.subscribe()

//     __$("swappable", () => new Subject<number>())

//     const dangling = getDanglingSubscriptions(main.state$.value.store)
//     expect(dangling.length).toBe(1)
//   })

//   it("excludes unsubscribed from dangling", () => {
//     let subj1: Subject<number>
//     __$("swappable", () => (subj1 = new Subject<number>()))
//     const sub = subj1!.subscribe()
//     sub.unsubscribe()

//     __$("swappable", () => new Subject<number>())

//     expect(getDanglingSubscriptions(main.state$.value.store)).toMatchInlineSnapshot(`[]`)
//   })
// })
