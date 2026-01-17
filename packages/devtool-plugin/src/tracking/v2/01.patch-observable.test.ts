import { describe, expect, it } from "vitest"
import { state$ } from "./00.types"
import { setNow } from "./01_helpers"
import "./03_scan-accumulator"
import {
  BehaviorSubject,
  filter,
  from,
  lastValueFrom,
  map,
  Observable,
  of,
  repeat,
  Subject,
  scan,
  share,
  switchMap,
  tap,
} from "rxjs"
import { useTrackingTestSetup } from "./0_test-utils"
import { renderStaticTree } from "./05_render-tree"
import {
  getAllSends,
  getArgCallForObs,
  getArgsFor,
  getChildSubscriptions,
  getDynamicObs,
  getOperatorsIn,
  getPipesFor,
  getRootObservables,
  getSendsFor,
  getTopLevelSubscriptions,
  isRuntimeObs,
} from "./06_queries"

describe("Class proxy events", () => {
  useTrackingTestSetup(true)

  it("from is workable", async () => {
    setNow(1000)
    let index = 1
    const value = await lastValueFrom(
      from(of(12, 15)).pipe(
        repeat({ delay: () => of(true), count: 2 }),
        tap({
          next: () => {
            setNow(index++ * 1000)
          },
          complete: () => {
            setNow(index++ * 1000)
          },
          error: () => {
            setNow(index++ * 1000)
          },
        }),
      ),
    )

    expect(state$.value.store).toMatchInlineSnapshot(`
      {
        "arg": {
          "1": {
            "created_at": 1000,
            "id": "1",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0.0",
            "value": 12,
          },
          "11": {
            "created_at": 1000,
            "fn_ref": WeakRef {},
            "fn_source": "() => (0,__vite_ssr_import_4__.of)(true)",
            "id": "11",
            "is_function": true,
            "owner_id": "10",
            "path": "$args.0.delay",
          },
          "12": {
            "created_at": 1000,
            "id": "12",
            "is_function": false,
            "owner_id": "10",
            "path": "$args.0.count",
            "value": 2,
          },
          "14": {
            "created_at": 1000,
            "fn_ref": WeakRef {},
            "fn_source": "() => {
                  (0,__vite_ssr_import_2__.setNow)(index++ * 1e3);
                }",
            "id": "14",
            "is_function": true,
            "owner_id": "13",
            "path": "$args.0.next",
          },
          "15": {
            "created_at": 1000,
            "fn_ref": WeakRef {},
            "fn_source": "() => {
                  (0,__vite_ssr_import_2__.setNow)(index++ * 1e3);
                }",
            "id": "15",
            "is_function": true,
            "owner_id": "13",
            "path": "$args.0.complete",
          },
          "16": {
            "created_at": 1000,
            "fn_ref": WeakRef {},
            "fn_source": "() => {
                  (0,__vite_ssr_import_2__.setNow)(index++ * 1e3);
                }",
            "id": "16",
            "is_function": true,
            "owner_id": "13",
            "path": "$args.0.error",
          },
          "2": {
            "created_at": 1000,
            "id": "2",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0.1",
            "value": 15,
          },
          "3": {
            "created_at": 1000,
            "id": "3",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0.0",
            "value": 12,
          },
          "35": {
            "created_at": 2000,
            "id": "35",
            "is_function": false,
            "observable_id": "34",
            "owner_id": "34",
            "path": "$args.0.0",
            "value": true,
          },
          "36": {
            "created_at": 2000,
            "id": "36",
            "is_function": false,
            "observable_id": "34",
            "owner_id": "34",
            "path": "$args.0.0",
            "value": true,
          },
          "37": {
            "created_at": 2000,
            "id": "37",
            "is_function": false,
            "observable_id": "34",
            "owner_id": "34",
            "path": "$args.0",
            "value": true,
          },
          "38": {
            "created_at": 2000,
            "id": "38",
            "is_function": false,
            "observable_id": "34",
            "owner_id": "34",
            "path": "$args.0",
          },
          "4": {
            "created_at": 1000,
            "id": "4",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0.1",
            "value": 15,
          },
          "5": {
            "created_at": 1000,
            "id": "5",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0",
            "value": 12,
          },
          "6": {
            "created_at": 1000,
            "id": "6",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.1",
            "value": 15,
          },
          "7": {
            "created_at": 1000,
            "id": "7",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0",
          },
          "8": {
            "created_at": 1000,
            "id": "8",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0",
          },
        },
        "arg_call": {
          "33": {
            "arg_id": "11",
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "33",
            "input_values": [
              1,
            ],
            "observable_id": "34",
            "subscription_id": "22",
          },
        },
        "hmr_module": {},
        "hmr_track": {},
        "observable": {
          "0": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "0",
            "name": "from($ref[0])",
            "obs_ref": WeakRef {},
          },
          "18": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "18",
            "name": "from($ref[0]).repeat({count:2,delay:fn})",
            "obs_ref": WeakRef {},
          },
          "20": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "20",
            "name": "from($ref[0]).repeat({count:2,delay:fn}).tap({complete:fn,error:fn,next:fn})",
            "obs_ref": WeakRef {},
          },
          "34": {
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "34",
            "name": "innerFrom($ref[34])",
            "obs_ref": WeakRef {},
          },
        },
        "operator": {
          "17": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "17",
            "index": 0,
            "operator_fun_id": "10",
            "pipe_id": "9",
            "source_observable_id": "0",
            "target_observable_id": "18",
          },
          "19": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "19",
            "index": 1,
            "operator_fun_id": "13",
            "pipe_id": "9",
            "source_observable_id": "18",
            "target_observable_id": "20",
          },
        },
        "operator_fun": {
          "10": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "10",
            "name": "repeat({count:2,delay:fn})",
          },
          "13": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "13",
            "name": "tap({complete:fn,error:fn,next:fn})",
          },
        },
        "pipe": {
          "9": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "9",
            "observable_id": "20",
            "parent_observable_id": "0",
          },
        },
        "send": {},
        "subscription": {
          "21": {
            "created_at": 1000,
            "created_at_end": 5000,
            "id": "21",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "20",
            "parent_subscription_id": undefined,
            "sub_ref": WeakRef {},
          },
          "22": {
            "created_at": 1000,
            "created_at_end": 5000,
            "id": "22",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "18",
            "parent_subscription_id": "21",
            "sub_ref": WeakRef {},
          },
          "23": {
            "created_at": 1000,
            "created_at_end": 2000,
            "id": "23",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "0",
            "parent_subscription_id": "22",
            "sub_ref": WeakRef {},
            "unsubscribed_at": 2000,
            "unsubscribed_at_end": 2000,
          },
          "39": {
            "created_at": 2000,
            "created_at_end": 5000,
            "id": "39",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "34",
            "parent_subscription_id": "22",
            "sub_ref": WeakRef {},
          },
          "41": {
            "created_at": 2000,
            "created_at_end": 5000,
            "id": "41",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "0",
            "parent_subscription_id": "39",
            "sub_ref": WeakRef {},
          },
        },
      }
    `)

    expect(renderStaticTree(state$.value.store)).toMatchInlineSnapshot(`
      "from($ref[0])                                                                                                                                                                                                                                            // #0
        .pipe(                                                                                                                                                                                                                                                 // 
          repeat({count:2,delay:fn})({ delay: () => (0,of)(true), count: 2 }),                                                                                                                                                                                 // #18
          tap({complete:fn,error:fn,next:fn})({ next: () => {
                  (0,setNow)(index++ * 1e3);
                }, complete: () => {
                  (0,setNow)(index++ * 1e3);
                }, error: () => {
                  (0,setNow)(index++ * 1e3);
                } }),  // #20
        )                                                                                                                                                                                                                                                      // -> #20"
    `)
  })

  it("tracks all 4 observable types with timestamps", () => {
    setNow(1000)
    const obs$ = new Observable(s => s.complete())
    setNow(2000)
    const subject$ = new Subject()
    setNow(3000)
    const bsubject$ = new BehaviorSubject(42)

    expect(state$.value.store).toMatchInlineSnapshot(`
      {
        "arg": {},
        "arg_call": {},
        "hmr_module": {},
        "hmr_track": {},
        "observable": {
          "0": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "0",
            "name": "new Observable",
            "obs_ref": WeakRef {},
          },
          "1": {
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "1",
            "name": "new Subject",
            "obs_ref": WeakRef {},
          },
          "2": {
            "created_at": 3000,
            "created_at_end": 3000,
            "id": "2",
            "name": "new BehaviorSubject",
            "obs_ref": WeakRef {},
          },
        },
        "operator": {},
        "operator_fun": {},
        "pipe": {},
        "send": {},
        "subscription": {},
      }
    `)

    expect(renderStaticTree(state$.value.store)).toMatchInlineSnapshot(`
      "new Observable       // #0
      new Subject          // #1
      new BehaviorSubject  // #2"
    `)
  })

  it("tracks pipe lifecycle", () => {
    setNow(1000)
    const obs$ = new Observable<number>(s => {
      s.next(5)
      s.complete()
    })

    setNow(2000)
    obs$.pipe(
      (setNow(3000), map(it => it * 2)),
      (setNow(4000), filter(it => it !== 0)),
      (setNow(5000),
      scan((sum, it) => {
        return sum + it
      }, 0)),
    )

    setNow(6000)
    expect(state$.value.store).toMatchInlineSnapshot(`
      {
        "arg": {
          "10": {
            "created_at": 5000,
            "fn_ref": WeakRef {},
            "fn_source": "(...callArgs) => {
            const id = (0,__vite_ssr_import_3__.createId)();
            __vite_ssr_import_2__._observableEvents$.next({
              type: "arg-call",
              id,
              arg_id,
              args: callArgs
            });
            const fn = __vite_ssr_import_2__.state$.value.store.arg[arg_id]?.fn_ref?.deref();
            const out = fn ? fn(...callArgs) : void 0;
            __vite_ssr_import_2__._observableEvents$.next({
              type: "arg-call-return",
              id,
              observable_id: __vite_ssr_import_3__.observableIdMap.get(out) ?? "UNKNOWN"
            });
            return out;
          }",
            "id": "10",
            "is_function": true,
            "owner_id": "9",
            "path": "$args.0",
          },
          "11": {
            "created_at": 5000,
            "id": "11",
            "is_function": false,
            "owner_id": "9",
            "path": "$args.1",
            "value": 0,
          },
          "12": {
            "created_at": 5000,
            "id": "12",
            "is_function": false,
            "owner_id": "9",
            "path": "$args.2",
            "value": true,
          },
          "13": {
            "created_at": 5000,
            "id": "13",
            "is_function": false,
            "owner_id": "9",
            "path": "$args.3",
            "value": true,
          },
          "3": {
            "created_at": 3000,
            "fn_ref": WeakRef {},
            "fn_source": "(it2) => it2 * 2",
            "id": "3",
            "is_function": true,
            "owner_id": "2",
            "path": "$args.0",
          },
          "5": {
            "created_at": 4000,
            "fn_ref": WeakRef {},
            "fn_source": "(it2) => it2 !== 0",
            "id": "5",
            "is_function": true,
            "owner_id": "4",
            "path": "$args.0",
          },
          "7": {
            "created_at": 5000,
            "fn_ref": WeakRef {},
            "fn_source": "(sum, it2) => {
              return sum + it2;
            }",
            "id": "7",
            "is_function": true,
            "owner_id": "6",
            "path": "$args.0",
          },
          "8": {
            "created_at": 5000,
            "id": "8",
            "is_function": false,
            "owner_id": "6",
            "path": "$args.1",
            "value": 0,
          },
        },
        "arg_call": {},
        "hmr_module": {},
        "hmr_track": {},
        "observable": {
          "0": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "0",
            "name": "new Observable",
            "obs_ref": WeakRef {},
          },
          "15": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "15",
            "name": "new Observable.map(fn)",
            "obs_ref": WeakRef {},
          },
          "17": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "17",
            "name": "new Observable.map(fn).filter(fn)",
            "obs_ref": WeakRef {},
          },
          "19": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "19",
            "name": "new Observable.map(fn).filter(fn).scan(fn,0)",
            "obs_ref": WeakRef {},
          },
        },
        "operator": {
          "14": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "14",
            "index": 0,
            "operator_fun_id": "2",
            "pipe_id": "1",
            "source_observable_id": "0",
            "target_observable_id": "15",
          },
          "16": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "16",
            "index": 1,
            "operator_fun_id": "4",
            "pipe_id": "1",
            "source_observable_id": "15",
            "target_observable_id": "17",
          },
          "18": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "18",
            "index": 2,
            "operator_fun_id": "6",
            "pipe_id": "1",
            "source_observable_id": "17",
            "target_observable_id": "19",
          },
        },
        "operator_fun": {
          "2": {
            "created_at": 3000,
            "created_at_end": 3000,
            "id": "2",
            "name": "map(fn)",
          },
          "4": {
            "created_at": 4000,
            "created_at_end": 4000,
            "id": "4",
            "name": "filter(fn)",
          },
          "6": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "6",
            "name": "scan(fn,0)",
          },
          "9": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "9",
            "name": "scanInternals(fn,0,true,true)",
          },
        },
        "pipe": {
          "1": {
            "created_at": 2000,
            "created_at_end": 5000,
            "id": "1",
            "observable_id": "19",
            "parent_observable_id": "0",
          },
        },
        "send": {},
        "subscription": {},
      }
    `)

    expect(renderStaticTree(state$.value.store)).toMatchInlineSnapshot(`
      "new Observable                                                         // #0
        .pipe(                                                               // 
          map(fn)((it2) => it2 * 2),                                         // #15
          filter(fn)((it2) => it2 !== 0),                                    // #17
          scan(fn,0)((sum, it2) => {
              return sum + it2;
            }, 0),  // #19
        )                                                                    // -> #19"
    `)
  })

  it("pipe output observable should be in store", () => {
    const source$ = of(1, 2, 3)
    const piped$ = source$.pipe(map(x => x * 2))

    const pipeEntry = Object.values(state$.value.store.pipe)[0]
    const operatorEntry = Object.values(state$.value.store.operator)[0]

    const sourceObs = state$.value.store.observable[operatorEntry!.source_observable_id]
    const targetObs = state$.value.store.observable[operatorEntry!.target_observable_id]
    const pipeOutputObs = state$.value.store.observable[pipeEntry!.observable_id]

    expect({ pipeEntry, operatorEntry, sourceObs, targetObs, pipeOutputObs }).toMatchInlineSnapshot(`
      {
        "operatorEntry": {
          "created_at": 0,
          "created_at_end": 0,
          "id": "13",
          "index": 0,
          "operator_fun_id": "11",
          "pipe_id": "10",
          "source_observable_id": "0",
          "target_observable_id": "14",
        },
        "pipeEntry": {
          "created_at": 0,
          "created_at_end": 0,
          "id": "10",
          "observable_id": "14",
          "parent_observable_id": "0",
        },
        "pipeOutputObs": {
          "created_at": 0,
          "created_at_end": 0,
          "id": "14",
          "name": "of(1,2,3).map(fn)",
          "obs_ref": WeakRef {},
        },
        "sourceObs": {
          "created_at": 0,
          "created_at_end": 0,
          "id": "0",
          "name": "of(1,2,3)",
          "obs_ref": WeakRef {},
        },
        "targetObs": {
          "created_at": 0,
          "created_at_end": 0,
          "id": "14",
          "name": "of(1,2,3).map(fn)",
          "obs_ref": WeakRef {},
        },
      }
    `)
  })

  it("tracks switchMap?", async () => {
    of(5)
      .pipe(switchMap((val, index) => of(index + "/" + val)))
      .subscribe()

    expect(renderStaticTree(state$.value.store)).toMatchInlineSnapshot(`
      "of(5)                                                          // #0
        .pipe(                                                       // 
          switchMap(fn)((val, index) => (0,of)(index + "/" + val)),  // #8
        )                                                            // -> #8"
    `)

    expect(state$.value.store).toMatchInlineSnapshot(`
      {
        "arg": {
          "1": {
            "created_at": 0,
            "id": "1",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0.0",
            "value": 5,
          },
          "14": {
            "created_at": 0,
            "id": "14",
            "is_function": false,
            "observable_id": "13",
            "owner_id": "13",
            "path": "$args.0.0",
            "value": "0/5",
          },
          "15": {
            "created_at": 0,
            "id": "15",
            "is_function": false,
            "observable_id": "13",
            "owner_id": "13",
            "path": "$args.0.0",
            "value": "0/5",
          },
          "16": {
            "created_at": 0,
            "id": "16",
            "is_function": false,
            "observable_id": "13",
            "owner_id": "13",
            "path": "$args.0",
            "value": "0/5",
          },
          "17": {
            "created_at": 0,
            "id": "17",
            "is_function": false,
            "observable_id": "13",
            "owner_id": "13",
            "path": "$args.0",
          },
          "2": {
            "created_at": 0,
            "id": "2",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0.0",
            "value": 5,
          },
          "3": {
            "created_at": 0,
            "id": "3",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0",
            "value": 5,
          },
          "6": {
            "created_at": 0,
            "fn_ref": WeakRef {},
            "fn_source": "(val, index) => (0,__vite_ssr_import_4__.of)(index + "/" + val)",
            "id": "6",
            "is_function": true,
            "owner_id": "5",
            "path": "$args.0",
          },
        },
        "arg_call": {
          "12": {
            "arg_id": "6",
            "created_at": 0,
            "created_at_end": 0,
            "id": "12",
            "input_values": [
              5,
              0,
            ],
            "observable_id": "13",
            "subscription_id": "10",
          },
        },
        "hmr_module": {},
        "hmr_track": {},
        "observable": {
          "0": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "0",
            "name": "of(5)",
            "obs_ref": WeakRef {},
          },
          "13": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "13",
            "name": "innerFrom($ref[13])",
            "obs_ref": WeakRef {},
          },
          "8": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "8",
            "name": "of(5).switchMap(fn)",
            "obs_ref": WeakRef {},
          },
        },
        "operator": {
          "7": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "7",
            "index": 0,
            "operator_fun_id": "5",
            "pipe_id": "4",
            "source_observable_id": "0",
            "target_observable_id": "8",
          },
        },
        "operator_fun": {
          "5": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "5",
            "name": "switchMap(fn)",
          },
        },
        "pipe": {
          "4": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "4",
            "observable_id": "8",
            "parent_observable_id": "0",
          },
        },
        "send": {},
        "subscription": {
          "10": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "10",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "0",
            "parent_subscription_id": "9",
            "sub_ref": WeakRef {},
          },
          "18": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "18",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "13",
            "parent_subscription_id": "10",
            "sub_ref": WeakRef {},
          },
          "9": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "9",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "8",
            "parent_subscription_id": undefined,
            "sub_ref": WeakRef {},
          },
        },
      }
    `)
  })

  it("tracks share", () => {
    const shared$ = of(1, 2).pipe(share())
    shared$.subscribe()
    shared$.subscribe()

    expect(renderStaticTree(state$.value.store)).toMatchInlineSnapshot(`
      "innerFrom($ref[0])  // #0
        .pipe(            // 
          share()(),      // #10
        )                 // -> #10
      new Subject         // #12
      new Subject         // #26"
    `)
  })

  it("tracks 2 root observables", () => {
    const a$ = of(1).pipe(map(x => x * 2))
    const b$ = of(2).pipe(filter(x => x > 0))

    expect(renderStaticTree(state$.value.store)).toMatchInlineSnapshot(`
      "of(1)                          // #0
        .pipe(                       // 
          map(fn)((x) => x * 2),     // #8
        )                            // -> #8
      of(2)                          // #9
        .pipe(                       // 
          filter(fn)((x) => x > 0),  // #17
        )                            // -> #17"
    `)
  })

  it("tracks observable refs across pipes", () => {
    const a$ = of(1).pipe(map(x => x * 2))
    const b$ = of(2).pipe(filter(x => x > 0))
    const c$ = a$.pipe(switchMap(() => b$))

    expect(state$.value.store.pipe).toMatchInlineSnapshot(`
      {
        "13": {
          "created_at": 0,
          "created_at_end": 0,
          "id": "13",
          "observable_id": "17",
          "parent_observable_id": "9",
        },
        "18": {
          "created_at": 0,
          "created_at_end": 0,
          "id": "18",
          "observable_id": "22",
          "parent_observable_id": "8",
        },
        "4": {
          "created_at": 0,
          "created_at_end": 0,
          "id": "4",
          "observable_id": "8",
          "parent_observable_id": "0",
        },
      }
    `)
    expect(renderStaticTree(state$.value.store)).toMatchInlineSnapshot(`
      "of(1)                          // #0
        .pipe(                       // 
          map(fn)((x) => x * 2),     // #8
        )                            // -> #8
      of(2)                          // #9
        .pipe(                       // 
          filter(fn)((x) => x > 0),  // #17
        )                            // -> #17
      #8                             // 
        .pipe(                       // 
          switchMap(fn)(() => b$),   // #22
        )                            // -> #22"
    `)
  })
})

describe("06_queries", () => {
  useTrackingTestSetup(true)

  it("getRootObservables excludes operator targets and runtime obs", () => {
    of(5)
      .pipe(switchMap(val => of(val * 2)))
      .subscribe()

    const roots = getRootObservables(state$.value.store)
    expect(roots.map(r => ({ id: r.id, name: r.name }))).toMatchInlineSnapshot(`
      [
        {
          "id": "0",
          "name": "of(5)",
        },
      ]
    `)
  })

  it("getPipesFor returns pipes for observable", () => {
    of(1).pipe(map(x => x * 2))

    const store = state$.value.store
    const roots = getRootObservables(store)
    const pipes = getPipesFor(store, roots[0]!.id)

    expect(pipes.map(p => ({ id: p.id, parent_observable_id: p.parent_observable_id }))).toMatchInlineSnapshot(`
      [
        {
          "id": "4",
          "parent_observable_id": "0",
        },
      ]
    `)
  })

  it("getOperatorsIn returns operators sorted by index", () => {
    of(1).pipe(
      map(x => x * 2),
      filter(x => x > 0),
    )

    const store = state$.value.store
    const pipeId = Object.keys(store.pipe)[0]!
    const operators = getOperatorsIn(store, pipeId)

    expect(operators.map(op => ({ index: op.index, operator_fun_id: op.operator_fun_id }))).toMatchInlineSnapshot(`
      [
        {
          "index": 0,
          "operator_fun_id": "5",
        },
        {
          "index": 1,
          "operator_fun_id": "7",
        },
      ]
    `)
  })

  it("getArgsFor returns args for operator_fun", () => {
    of(1).pipe(scan((acc, x) => acc + x, 100))

    const store = state$.value.store
    const opFunId = Object.keys(store.operator_fun)[0]!
    const args = getArgsFor(store, opFunId)

    expect(args.map(a => ({ path: a.path, is_function: a.is_function, value: a.value }))).toMatchInlineSnapshot(`
      [
        {
          "is_function": true,
          "path": "$args.0",
          "value": undefined,
        },
        {
          "is_function": false,
          "path": "$args.1",
          "value": 100,
        },
      ]
    `)
  })

  it("getTopLevelSubscriptions returns subs with no parent", () => {
    of(1).subscribe()
    of(2).subscribe()

    const topLevel = getTopLevelSubscriptions(state$.value.store)

    expect(
      topLevel.map(s => ({ id: s.id, observable_id: s.observable_id, parent: s.parent_subscription_id })),
    ).toMatchInlineSnapshot(`
      [
        {
          "id": "4",
          "observable_id": "0",
          "parent": undefined,
        },
        {
          "id": "11",
          "observable_id": "7",
          "parent": undefined,
        },
      ]
    `)
  })

  it("getChildSubscriptions returns children of a parent sub", () => {
    of(1)
      .pipe(switchMap(() => of(2)))
      .subscribe()

    const store = state$.value.store
    const topLevel = getTopLevelSubscriptions(store)
    const children = getChildSubscriptions(store, topLevel[0]!.id)

    expect(children.map(c => ({ id: c.id, parent: c.parent_subscription_id }))).toMatchInlineSnapshot(`
      [
        {
          "id": "10",
          "parent": "9",
        },
      ]
    `)
  })

  it("getSendsFor returns sends for a subscription", () => {
    of(1, 2).subscribe()

    const store = state$.value.store
    const topLevel = getTopLevelSubscriptions(store)
    const sends = getSendsFor(store, topLevel[0]!.id)

    expect(sends).toMatchInlineSnapshot(`[]`)
  })

  it("getAllSends returns all sends sorted by time", () => {
    setNow(100)
    of(1).subscribe()
    setNow(200)
    of(2).subscribe()

    const sends = getAllSends(state$.value.store)

    expect(sends.map(s => ({ created_at: s.created_at, type: s.type, value: s.value }))).toMatchInlineSnapshot(`[]`)
  })

  it("getDynamicObs returns observables created by arg during subscription", () => {
    of(5)
      .pipe(switchMap(val => of(val * 2)))
      .subscribe()

    const store = state$.value.store
    const switchMapArg = Object.values(store.arg).find(a => a.is_function)!
    const dynamicObs = getDynamicObs(store, switchMapArg.id)

    expect(dynamicObs.map(o => ({ id: o!.id, name: o!.name }))).toMatchInlineSnapshot(`
      [
        {
          "id": "13",
          "name": "innerFrom($ref[13])",
        },
      ]
    `)
  })

  it("isRuntimeObs identifies runtime vs static observables", () => {
    of(5)
      .pipe(switchMap(val => of(val * 2)))
      .subscribe()

    const store = state$.value.store
    const roots = getRootObservables(store)
    const argCall = Object.values(store.arg_call)[0]!

    expect({
      rootIsRuntime: isRuntimeObs(store, roots[0]!.id),
      dynamicIsRuntime: isRuntimeObs(store, argCall.observable_id!),
    }).toMatchInlineSnapshot(`
      {
        "dynamicIsRuntime": true,
        "rootIsRuntime": false,
      }
    `)
  })

  it("getArgCallForObs returns the arg_call that created an observable", () => {
    of(5)
      .pipe(switchMap(val => of(val * 2)))
      .subscribe()

    const store = state$.value.store
    const argCall = Object.values(store.arg_call)[0]!
    const found = getArgCallForObs(store, argCall.observable_id!)

    expect({ id: found!.id, arg_id: found!.arg_id, observable_id: found!.observable_id }).toMatchInlineSnapshot(`
      {
        "arg_id": "6",
        "id": "12",
        "observable_id": "13",
      }
    `)
  })
})
