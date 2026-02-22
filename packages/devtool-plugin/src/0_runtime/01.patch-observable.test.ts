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
import { describe, expect, it } from "vitest"
import { __$ } from "../0_runtime_hmr/0_runtime"
import { main } from "./0_store"
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

  it("of", async () => {
    main.setNow(1000)
    const sub = __$("new Subject", () => new Subject())
    expect(main.events$.value).toMatchInlineSnapshot(`
      [
        {
          "type": "enable",
        },
        {
          "id": "test",
          "type": "hmr-module-call",
          "url": "0_test-utils.ts",
        },
        {
          "id": "1",
          "key": "new Subject",
          "type": "track-call",
        },
        {
          "id": "2",
          "observable": Subject {
            "__oid__": "2",
            "closed": false,
            "currentObservers": null,
            "hasError": false,
            "isStopped": false,
            "observers": [
              SafeSubscriber {
                "__id__": "4",
                "_finalizers": [
                  Subscription {
                    "_finalizers": null,
                    "_parentage": [Circular],
                    "closed": false,
                    "initialTeardown": [Function],
                  },
                ],
                "_parentage": null,
                "closed": false,
                "destination": ConsumerObserver {
                  "partialObserver": {
                    "complete": [Function],
                    "error": [Function],
                    "next": [Function],
                  },
                },
                "initialTeardown": undefined,
                "isStopped": false,
                Symbol(rxjs-debugger-patched-unsubscribe): true,
              },
            ],
            "thrownError": null,
          },
          "type": "constructor-call-return",
        },
        {
          "id": "3",
          "observable": Subject {
            "__oid__": "3",
            "closed": false,
            "complete": [Function],
            "currentObservers": null,
            "error": [Function],
            "hasError": false,
            "isStopped": false,
            "next": [Function],
            "observers": [
              SafeSubscriber {
                "__id__": "5",
                "_finalizers": [
                  Subscription {
                    "_finalizers": null,
                    "_parentage": [Circular],
                    "closed": false,
                    "initialTeardown": [Function],
                  },
                ],
                "_parentage": null,
                "closed": false,
                "destination": ConsumerObserver {
                  "partialObserver": {
                    "complete": [Function],
                    "error": [Function],
                    "next": [Function],
                  },
                },
                "initialTeardown": undefined,
                "isStopped": false,
                Symbol(rxjs-debugger-patched-unsubscribe): true,
              },
            ],
            "thrownError": null,
            Symbol(rxjs-debugger-tracked): true,
          },
          "type": "constructor-call-return",
        },
        {
          "args": [
            {
              "complete": [Function],
              "error": [Function],
              "next": [Function],
            },
          ],
          "id": "4",
          "index": 0,
          "observable_id": "2",
          "type": "subscribe-call",
        },
        {
          "id": "4",
          "observable_id": "2",
          "subscription": SafeSubscriber {
            "__id__": "4",
            "_finalizers": [
              Subscription {
                "_finalizers": null,
                "_parentage": [Circular],
                "closed": false,
                "initialTeardown": [Function],
              },
            ],
            "_parentage": null,
            "closed": false,
            "destination": ConsumerObserver {
              "partialObserver": {
                "complete": [Function],
                "error": [Function],
                "next": [Function],
              },
            },
            "initialTeardown": undefined,
            "isStopped": false,
            Symbol(rxjs-debugger-patched-unsubscribe): true,
          },
          "type": "subscribe-call-return",
        },
        {
          "args": [
            {
              "complete": [Function],
            },
          ],
          "id": "5",
          "index": 0,
          "observable_id": "3",
          "type": "subscribe-call",
        },
        {
          "id": "5",
          "observable_id": "3",
          "subscription": SafeSubscriber {
            "__id__": "5",
            "_finalizers": [
              Subscription {
                "_finalizers": null,
                "_parentage": [Circular],
                "closed": false,
                "initialTeardown": [Function],
              },
            ],
            "_parentage": null,
            "closed": false,
            "destination": ConsumerObserver {
              "partialObserver": {
                "complete": [Function],
                "error": [Function],
                "next": [Function],
              },
            },
            "initialTeardown": undefined,
            "isStopped": false,
            Symbol(rxjs-debugger-patched-unsubscribe): true,
          },
          "type": "subscribe-call-return",
        },
        {
          "id": "1",
          "mutable_observable_id": "2",
          "stable_observable_id": "3",
          "type": "track-call-return",
        },
      ]
    `)
    expect(main.state$.value).toMatchInlineSnapshot(`
      {
        "isEnabled": true,
        "stack": {
          "arg": [],
          "arg_call": [],
          "hmr_module": [
            {
              "created_at": 0,
              "id": "test",
              "prev_keys": [],
              "url": "0_test-utils.ts",
              "version": 1,
            },
          ],
          "hmr_track": [],
          "observable": [],
          "operator": [],
          "operator_fun": [],
          "pipe": [],
          "send": [],
          "subscription": [],
        },
        "store": {
          "arg": {},
          "arg_call": {},
          "hmr_module": {
            "test": {
              "created_at": 0,
              "id": "test",
              "prev_keys": [],
              "url": "0_test-utils.ts",
              "version": 1,
            },
          },
          "hmr_track": {
            "1": {
              "created_at": 1000,
              "created_at_end": 1000,
              "id": "1",
              "index": 0,
              "key": "new Subject",
              "module_id": "test",
              "module_version": 1,
              "mutable_observable_id": "2",
              "parent_track_id": undefined,
              "prev_observable_ids": [],
              "stable_observable_id": "3",
              "version": 0,
            },
          },
          "observable": {
            "2": {
              "created_at": 1000,
              "created_at_end": 1000,
              "id": "2",
              "name": "new Subject",
              "obs_ref": WeakRef {},
            },
            "3": {
              "created_at": 1000,
              "created_at_end": 1000,
              "id": "3",
              "name": "new Subject",
              "obs_ref": WeakRef {},
            },
          },
          "operator": {},
          "operator_fun": {},
          "pipe": {},
          "send": {},
          "subscription": {
            "4": {
              "created_at": 1000,
              "created_at_end": 1000,
              "id": "4",
              "is_sync": false,
              "module_id": "test",
              "observable_id": "2",
              "parent_subscription_id": undefined,
              "sub_ref": WeakRef {},
            },
            "5": {
              "created_at": 1000,
              "created_at_end": 1000,
              "id": "5",
              "is_sync": false,
              "module_id": "test",
              "observable_id": "3",
              "parent_subscription_id": undefined,
              "sub_ref": WeakRef {},
            },
          },
        },
      }
    `)
  })

  it("of", async () => {
    main.setNow(1000)
    __$("ofofof", () => of(1).subscribe())
    expect(main.events$.value).toMatchInlineSnapshot(`
      [
        {
          "type": "enable",
        },
        {
          "id": "test",
          "type": "hmr-module-call",
          "url": "0_test-utils.ts",
        },
        {
          "id": "1",
          "key": "ofofof",
          "type": "track-call",
        },
        {
          "id": "2",
          "observable": Observable {
            "__oid__": "2",
            "_subscribe": [Function],
          },
          "type": "constructor-call-return",
        },
        {
          "args": [
            [
              1,
            ],
          ],
          "name": "innerFrom",
          "observable": Observable {
            "__oid__": "2",
            "_subscribe": [Function],
          },
          "type": "factory-call-return",
        },
        {
          "args": [
            [
              1,
            ],
            undefined,
          ],
          "name": "from",
          "observable": Observable {
            "__oid__": "2",
            "_subscribe": [Function],
          },
          "type": "factory-call-return",
        },
        {
          "args": [
            1,
          ],
          "name": "of",
          "observable": Observable {
            "__oid__": "2",
            "_subscribe": [Function],
          },
          "type": "factory-call-return",
        },
        {
          "args": [],
          "id": "3",
          "index": 0,
          "observable_id": "2",
          "type": "subscribe-call",
        },
        {
          "id": "4",
          "index": 0,
          "kind": "next",
          "observable_id": "2",
          "subscription_id": "3",
          "type": "send-call",
          "value": 1,
        },
        {
          "id": "4",
          "observable_id": "2",
          "type": "send-call-return",
        },
        {
          "id": "5",
          "kind": "complete",
          "observable_id": "2",
          "subscription_id": "3",
          "type": "send-call",
        },
        {
          "id": "5",
          "observable_id": "2",
          "type": "send-call-return",
        },
        {
          "id": "3",
          "observable_id": "2",
          "subscription": SafeSubscriber {
            "__id__": "3",
            "_finalizers": null,
            "_parentage": null,
            "closed": true,
            "destination": null,
            "initialTeardown": undefined,
            "isStopped": true,
            Symbol(rxjs-debugger-patched-unsubscribe): true,
          },
          "type": "subscribe-call-return",
        },
        {
          "id": "1",
          "mutable_observable_id": undefined,
          "stable_observable_id": undefined,
          "type": "track-call-return",
        },
      ]
    `)
    expect(main.state$.value).toMatchInlineSnapshot(`
      {
        "isEnabled": true,
        "stack": {
          "arg": [],
          "arg_call": [],
          "hmr_module": [
            {
              "created_at": 0,
              "id": "test",
              "prev_keys": [],
              "url": "0_test-utils.ts",
              "version": 1,
            },
          ],
          "hmr_track": [],
          "observable": [],
          "operator": [],
          "operator_fun": [],
          "pipe": [],
          "send": [],
          "subscription": [],
        },
        "store": {
          "arg": {},
          "arg_call": {},
          "hmr_module": {
            "test": {
              "created_at": 0,
              "id": "test",
              "prev_keys": [],
              "url": "0_test-utils.ts",
              "version": 1,
            },
          },
          "hmr_track": {},
          "observable": {
            "2": {
              "created_at": 1000,
              "created_at_end": 1000,
              "id": "2",
              "name": "of(1)",
              "obs_ref": WeakRef {},
            },
          },
          "operator": {},
          "operator_fun": {},
          "pipe": {},
          "send": {},
          "subscription": {
            "3": {
              "created_at": 1000,
              "created_at_end": 1000,
              "id": "3",
              "is_sync": false,
              "module_id": "test",
              "observable_id": "2",
              "parent_subscription_id": undefined,
              "sub_ref": WeakRef {},
            },
          },
        },
      }
    `)
  })

  it("of - outer sub", async () => {
    main.setNow(1000)
    const x = __$("ofofof", () => of(1))
    x.subscribe()

    // expect(main.events$.value).toMatchInlineSnapshot(`
    //   [
    //     {
    //       "type": "enable",
    //     },
    //     {
    //       "id": "test",
    //       "type": "hmr-module-call",
    //       "url": "0_test-utils.ts",
    //     },
    //     {
    //       "id": "1",
    //       "key": "ofofof",
    //       "type": "track-call",
    //     },
    //     {
    //       "id": "2",
    //       "observable": Observable {
    //         "__oid__": "2",
    //         "_subscribe": [Function],
    //       },
    //       "type": "constructor-call-return",
    //     },
    //     {
    //       "args": [
    //         [
    //           1,
    //         ],
    //       ],
    //       "name": "innerFrom",
    //       "observable": Observable {
    //         "__oid__": "2",
    //         "_subscribe": [Function],
    //       },
    //       "type": "factory-call-return",
    //     },
    //     {
    //       "args": [
    //         [
    //           1,
    //         ],
    //         undefined,
    //       ],
    //       "name": "from",
    //       "observable": Observable {
    //         "__oid__": "2",
    //         "_subscribe": [Function],
    //       },
    //       "type": "factory-call-return",
    //     },
    //     {
    //       "args": [
    //         1,
    //       ],
    //       "name": "of",
    //       "observable": Observable {
    //         "__oid__": "2",
    //         "_subscribe": [Function],
    //       },
    //       "type": "factory-call-return",
    //     },
    //     {
    //       "id": "3",
    //       "observable": Observable {
    //         "__oid__": "3",
    //         "_subscribe": [Function],
    //         Symbol(rxjs-debugger-tracked): true,
    //       },
    //       "type": "constructor-call-return",
    //     },
    //     {
    //       "id": "1",
    //       "mutable_observable_id": "2",
    //       "stable_observable_id": "3",
    //       "type": "track-call-return",
    //     },
    //     {
    //       "args": [],
    //       "id": "4",
    //       "index": 0,
    //       "observable_id": "3",
    //       "type": "subscribe-call",
    //     },
    //     {
    //       "args": [
    //         {
    //           "complete": [Function],
    //           "error": [Function],
    //           "next": [Function],
    //         },
    //       ],
    //       "id": "5",
    //       "index": 0,
    //       "observable_id": "2",
    //       "type": "subscribe-call",
    //     },
    //     {
    //       "id": "6",
    //       "index": 0,
    //       "kind": "next",
    //       "observable_id": "2",
    //       "subscription_id": "5",
    //       "type": "send-call",
    //       "value": 1,
    //     },
    //     {
    //       "id": "7",
    //       "index": 0,
    //       "kind": "next",
    //       "observable_id": "3",
    //       "subscription_id": "4",
    //       "type": "send-call",
    //       "value": 1,
    //     },
    //     {
    //       "id": "7",
    //       "observable_id": "3",
    //       "type": "send-call-return",
    //     },
    //     {
    //       "id": "6",
    //       "observable_id": "2",
    //       "type": "send-call-return",
    //     },
    //     {
    //       "id": "8",
    //       "kind": "complete",
    //       "observable_id": "2",
    //       "subscription_id": "5",
    //       "type": "send-call",
    //     },
    //     {
    //       "id": "9",
    //       "kind": "complete",
    //       "observable_id": "3",
    //       "subscription_id": "4",
    //       "type": "send-call",
    //     },
    //     {
    //       "id": "9",
    //       "observable_id": "3",
    //       "type": "send-call-return",
    //     },
    //     {
    //       "id": "8",
    //       "observable_id": "2",
    //       "type": "send-call-return",
    //     },
    //     {
    //       "id": "5",
    //       "observable_id": "2",
    //       "subscription": SafeSubscriber {
    //         "__id__": "5",
    //         "_finalizers": null,
    //         "_parentage": null,
    //         "closed": true,
    //         "destination": null,
    //         "initialTeardown": undefined,
    //         "isStopped": true,
    //         Symbol(rxjs-debugger-patched-unsubscribe): true,
    //       },
    //       "type": "subscribe-call-return",
    //     },
    //     {
    //       "type": "disable",
    //     },
    //     {
    //       "args": [
    //         {
    //           "complete": [Function],
    //           "error": [Function],
    //           "next": [Function],
    //         },
    //       ],
    //       "id": "5",
    //       "index": 0,
    //       "observable_id": "2",
    //       "type": "unsubscribe-call",
    //     },
    //     {
    //       "id": "5",
    //       "observable_id": "2",
    //       "type": "unsubscribe-call-return",
    //     },
    //     {
    //       "type": "enable",
    //     },
    //     {
    //       "id": "4",
    //       "observable_id": "3",
    //       "subscription": SafeSubscriber {
    //         "__id__": "4",
    //         "_finalizers": null,
    //         "_parentage": null,
    //         "closed": true,
    //         "destination": null,
    //         "initialTeardown": undefined,
    //         "isStopped": true,
    //         Symbol(rxjs-debugger-patched-unsubscribe): true,
    //       },
    //       "type": "subscribe-call-return",
    //     },
    //   ]
    // `)
    // expect(main.state$.value).toMatchInlineSnapshot(`
    //   {
    //     "isEnabled": true,
    //     "stack": {
    //       "arg": [],
    //       "arg_call": [],
    //       "hmr_module": [
    //         {
    //           "created_at": 0,
    //           "id": "test",
    //           "prev_keys": [],
    //           "url": "0_test-utils.ts",
    //           "version": 1,
    //         },
    //       ],
    //       "hmr_track": [],
    //       "observable": [],
    //       "operator": [],
    //       "operator_fun": [],
    //       "pipe": [],
    //       "send": [],
    //       "subscription": [],
    //     },
    //     "store": {
    //       "arg": {},
    //       "arg_call": {},
    //       "hmr_module": {
    //         "test": {
    //           "created_at": 0,
    //           "id": "test",
    //           "prev_keys": [],
    //           "url": "0_test-utils.ts",
    //           "version": 1,
    //         },
    //       },
    //       "hmr_track": {
    //         "1": {
    //           "created_at": 1000,
    //           "created_at_end": 1000,
    //           "id": "1",
    //           "index": 0,
    //           "key": "ofofof",
    //           "module_id": "test",
    //           "module_version": 1,
    //           "mutable_observable_id": "2",
    //           "parent_track_id": undefined,
    //           "prev_observable_ids": [],
    //           "stable_observable_id": "3",
    //           "version": 0,
    //         },
    //       },
    //       "observable": {
    //         "2": {
    //           "created_at": 1000,
    //           "created_at_end": 1000,
    //           "id": "2",
    //           "name": "of(1)",
    //           "obs_ref": WeakRef {},
    //         },
    //         "3": {
    //           "created_at": 1000,
    //           "created_at_end": 1000,
    //           "id": "3",
    //           "name": "new Observable",
    //           "obs_ref": WeakRef {},
    //         },
    //       },
    //       "operator": {},
    //       "operator_fun": {},
    //       "pipe": {},
    //       "send": {
    //         "6": {
    //           "created_at": 1000,
    //           "created_at_end": 1000,
    //           "id": "6",
    //           "observable_id": "2",
    //           "subscription_id": "5",
    //           "type": "next",
    //           "value": 1,
    //         },
    //         "7": {
    //           "created_at": 1000,
    //           "created_at_end": 1000,
    //           "id": "7",
    //           "observable_id": "3",
    //           "subscription_id": "4",
    //           "type": "next",
    //           "value": 1,
    //         },
    //         "8": {
    //           "created_at": 1000,
    //           "created_at_end": 1000,
    //           "id": "8",
    //           "observable_id": "2",
    //           "subscription_id": "5",
    //           "type": "complete",
    //         },
    //         "9": {
    //           "created_at": 1000,
    //           "created_at_end": 1000,
    //           "id": "9",
    //           "observable_id": "3",
    //           "subscription_id": "4",
    //           "type": "complete",
    //         },
    //       },
    //       "subscription": {
    //         "4": {
    //           "created_at": 1000,
    //           "created_at_end": 1000,
    //           "id": "4",
    //           "is_sync": false,
    //           "module_id": "test",
    //           "observable_id": "3",
    //           "parent_subscription_id": undefined,
    //           "sub_ref": WeakRef {},
    //         },
    //       },
    //     },
    //   }
    // `)
    expect(renderStaticTree(main.state$.value.store)).toMatchInlineSnapshot(`
      "of(1)           // #2
      new Observable  // #3"
    `)
  })

  it("from is workable", async () => {
    main.setNow(1000)
    let index = 1
    const value = await lastValueFrom(
      __$("main", () =>
        from(of(12, 15)).pipe(
          repeat({ delay: () => of(true), count: 2 }),
          tap({
            next: () => {
              main.setNow(index++ * 1000)
            },
            complete: () => {
              main.setNow(index++ * 1000)
            },
            error: () => {
              main.setNow(index++ * 1000)
            },
          }),
        ),
      ),
    )
    expect(main.events$.value).toMatchInlineSnapshot(`
      [
        {
          "type": "enable",
        },
        {
          "id": "test",
          "type": "hmr-module-call",
          "url": "0_test-utils.ts",
        },
        {
          "id": "1",
          "key": "main",
          "type": "track-call",
        },
        {
          "id": "2",
          "observable": Observable {
            "__oid__": "2",
            "_subscribe": [Function],
          },
          "type": "constructor-call-return",
        },
        {
          "args": [
            [
              12,
              15,
            ],
          ],
          "name": "innerFrom",
          "observable": Observable {
            "__oid__": "2",
            "_subscribe": [Function],
          },
          "type": "factory-call-return",
        },
        {
          "args": [
            [
              12,
              15,
            ],
            undefined,
          ],
          "name": "from",
          "observable": Observable {
            "__oid__": "2",
            "_subscribe": [Function],
          },
          "type": "factory-call-return",
        },
        {
          "args": [
            12,
            15,
          ],
          "name": "of",
          "observable": Observable {
            "__oid__": "2",
            "_subscribe": [Function],
          },
          "type": "factory-call-return",
        },
        {
          "args": [
            Observable {
              "__oid__": "2",
              "_subscribe": [Function],
            },
          ],
          "name": "innerFrom",
          "observable": Observable {
            "__oid__": "2",
            "_subscribe": [Function],
          },
          "type": "factory-call-return",
        },
        {
          "args": [
            Observable {
              "__oid__": "2",
              "_subscribe": [Function],
            },
          ],
          "name": "from",
          "observable": Observable {
            "__oid__": "2",
            "_subscribe": [Function],
          },
          "type": "factory-call-return",
        },
        {
          "id": "5",
          "observable_id": "2",
          "type": "pipe-get",
        },
        {
          "args": [
            {
              "count": 2,
              "delay": [Function],
            },
          ],
          "id": "6",
          "name": "repeat",
          "type": "operator-fun-call",
        },
        {
          "id": "6",
          "type": "operator-fun-call-return",
        },
        {
          "args": [
            {
              "complete": [Function],
              "error": [Function],
              "next": [Function],
            },
          ],
          "id": "7",
          "name": "tap",
          "type": "operator-fun-call",
        },
        {
          "id": "7",
          "type": "operator-fun-call-return",
        },
        {
          "args": [
            [Function],
            [Function],
          ],
          "id": "5",
          "index": 0,
          "observable_id": "2",
          "type": "pipe-call",
        },
        {
          "id": "8",
          "index": 0,
          "operator_fun_id": "6",
          "source_observable_id": "2",
          "type": "operator-call",
        },
        {
          "id": "9",
          "observable": Observable {
            "__oid__": "9",
            "operator": [Function],
            "source": Observable {
              "__oid__": "2",
              "_subscribe": [Function],
            },
          },
          "type": "constructor-call-return",
        },
        {
          "id": "8",
          "target_observable_id": "9",
          "type": "operator-call-return",
        },
        {
          "id": "10",
          "index": 1,
          "operator_fun_id": "7",
          "source_observable_id": "9",
          "type": "operator-call",
        },
        {
          "id": "11",
          "observable": Observable {
            "__oid__": "11",
            "operator": [Function],
            "source": Observable {
              "__oid__": "9",
              "operator": [Function],
              "source": Observable {
                "__oid__": "2",
                "_subscribe": [Function],
              },
            },
          },
          "type": "constructor-call-return",
        },
        {
          "id": "10",
          "target_observable_id": "11",
          "type": "operator-call-return",
        },
        {
          "id": "5",
          "observable_id": "11",
          "type": "pipe-call-return",
        },
        {
          "id": "12",
          "observable": Observable {
            "__oid__": "12",
            "_subscribe": [Function],
            Symbol(rxjs-debugger-tracked): true,
          },
          "type": "constructor-call-return",
        },
        {
          "id": "1",
          "mutable_observable_id": "11",
          "stable_observable_id": "12",
          "type": "track-call-return",
        },
        {
          "args": [
            {
              "complete": [Function],
              "error": [Function],
              "next": [Function],
            },
          ],
          "id": "13",
          "index": 0,
          "observable_id": "12",
          "type": "subscribe-call",
        },
        {
          "args": [
            {
              "complete": [Function],
              "error": [Function],
              "next": [Function],
            },
          ],
          "id": "14",
          "index": 0,
          "observable_id": "11",
          "type": "subscribe-call",
        },
        {
          "args": [
            OperatorSubscriber {
              "_complete": [Function],
              "_error": [Function],
              "_finalizers": null,
              "_next": [Function],
              "_parentage": null,
              "closed": true,
              "destination": null,
              "initialTeardown": undefined,
              "isStopped": true,
              "onFinalize": [Function],
              "shouldUnsubscribe": undefined,
            },
          ],
          "id": "15",
          "index": 0,
          "observable_id": "9",
          "type": "subscribe-call",
        },
        {
          "args": [
            OperatorSubscriber {
              "_complete": [Function],
              "_error": [Function],
              "_finalizers": null,
              "_next": [Function],
              "_parentage": null,
              "closed": true,
              "destination": null,
              "initialTeardown": undefined,
              "isStopped": true,
              "onFinalize": undefined,
              "shouldUnsubscribe": undefined,
            },
          ],
          "id": "16",
          "index": 0,
          "observable_id": "2",
          "type": "subscribe-call",
        },
        {
          "id": "17",
          "index": 0,
          "kind": "next",
          "observable_id": "2",
          "subscription_id": "16",
          "type": "send-call",
          "value": 12,
        },
        {
          "id": "18",
          "index": 0,
          "kind": "next",
          "observable_id": "9",
          "subscription_id": "15",
          "type": "send-call",
          "value": 12,
        },
        {
          "id": "19",
          "index": 0,
          "kind": "next",
          "observable_id": "11",
          "subscription_id": "14",
          "type": "send-call",
          "value": 12,
        },
        {
          "id": "20",
          "index": 0,
          "kind": "next",
          "observable_id": "12",
          "subscription_id": "13",
          "type": "send-call",
          "value": 12,
        },
        {
          "id": "20",
          "observable_id": "12",
          "type": "send-call-return",
        },
        {
          "id": "19",
          "observable_id": "11",
          "type": "send-call-return",
        },
        {
          "id": "18",
          "observable_id": "9",
          "type": "send-call-return",
        },
        {
          "id": "17",
          "observable_id": "2",
          "type": "send-call-return",
        },
        {
          "id": "21",
          "index": 1,
          "kind": "next",
          "observable_id": "2",
          "subscription_id": "16",
          "type": "send-call",
          "value": 15,
        },
        {
          "id": "22",
          "index": 1,
          "kind": "next",
          "observable_id": "9",
          "subscription_id": "15",
          "type": "send-call",
          "value": 15,
        },
        {
          "id": "23",
          "index": 1,
          "kind": "next",
          "observable_id": "11",
          "subscription_id": "14",
          "type": "send-call",
          "value": 15,
        },
        {
          "id": "24",
          "index": 1,
          "kind": "next",
          "observable_id": "12",
          "subscription_id": "13",
          "type": "send-call",
          "value": 15,
        },
        {
          "id": "24",
          "observable_id": "12",
          "type": "send-call-return",
        },
        {
          "id": "23",
          "observable_id": "11",
          "type": "send-call-return",
        },
        {
          "id": "22",
          "observable_id": "9",
          "type": "send-call-return",
        },
        {
          "id": "21",
          "observable_id": "2",
          "type": "send-call-return",
        },
        {
          "id": "25",
          "kind": "complete",
          "observable_id": "2",
          "subscription_id": "16",
          "type": "send-call",
        },
        {
          "id": "25",
          "observable_id": "2",
          "type": "send-call-return",
        },
        {
          "id": "16",
          "observable_id": "2",
          "subscription": SafeSubscriber {
            "__id__": "16",
            "_finalizers": null,
            "_parentage": null,
            "closed": true,
            "destination": null,
            "initialTeardown": undefined,
            "isStopped": true,
            Symbol(rxjs-debugger-patched-unsubscribe): true,
          },
          "type": "subscribe-call-return",
        },
        {
          "args": [
            OperatorSubscriber {
              "_complete": [Function],
              "_error": [Function],
              "_finalizers": null,
              "_next": [Function],
              "_parentage": null,
              "closed": true,
              "destination": null,
              "initialTeardown": undefined,
              "isStopped": true,
              "onFinalize": undefined,
              "shouldUnsubscribe": undefined,
            },
          ],
          "id": "16",
          "index": 0,
          "observable_id": "2",
          "type": "unsubscribe-call",
        },
        {
          "id": "16",
          "observable_id": "2",
          "type": "unsubscribe-call-return",
        },
        {
          "id": "26",
          "observable": Observable {
            "__oid__": "26",
            "_subscribe": [Function],
          },
          "type": "constructor-call-return",
        },
        {
          "args": [
            [
              true,
            ],
          ],
          "name": "innerFrom",
          "observable": Observable {
            "__oid__": "26",
            "_subscribe": [Function],
          },
          "type": "factory-call-return",
        },
        {
          "args": [
            [
              true,
            ],
            undefined,
          ],
          "name": "from",
          "observable": Observable {
            "__oid__": "26",
            "_subscribe": [Function],
          },
          "type": "factory-call-return",
        },
        {
          "args": [
            true,
          ],
          "name": "of",
          "observable": Observable {
            "__oid__": "26",
            "_subscribe": [Function],
          },
          "type": "factory-call-return",
        },
        {
          "args": [
            Observable {
              "__oid__": "26",
              "_subscribe": [Function],
            },
          ],
          "name": "innerFrom",
          "observable": Observable {
            "__oid__": "26",
            "_subscribe": [Function],
          },
          "type": "factory-call-return",
        },
        {
          "args": [
            OperatorSubscriber {
              "_complete": [Function],
              "_error": [Function],
              "_finalizers": null,
              "_next": [Function],
              "_parentage": null,
              "closed": true,
              "destination": null,
              "initialTeardown": undefined,
              "isStopped": true,
              "onFinalize": undefined,
              "shouldUnsubscribe": undefined,
            },
          ],
          "id": "28",
          "index": 0,
          "observable_id": "26",
          "type": "subscribe-call",
        },
        {
          "id": "29",
          "index": 0,
          "kind": "next",
          "observable_id": "26",
          "subscription_id": "28",
          "type": "send-call",
          "value": true,
        },
        {
          "args": [
            OperatorSubscriber {
              "_complete": [Function],
              "_error": [Function],
              "_finalizers": null,
              "_next": [Function],
              "_parentage": null,
              "closed": true,
              "destination": null,
              "initialTeardown": undefined,
              "isStopped": true,
              "onFinalize": undefined,
              "shouldUnsubscribe": undefined,
            },
          ],
          "id": "30",
          "index": 0,
          "observable_id": "2",
          "type": "subscribe-call",
        },
        {
          "id": "31",
          "index": 0,
          "kind": "next",
          "observable_id": "2",
          "subscription_id": "30",
          "type": "send-call",
          "value": 12,
        },
        {
          "id": "32",
          "index": 2,
          "kind": "next",
          "observable_id": "9",
          "subscription_id": "15",
          "type": "send-call",
          "value": 12,
        },
        {
          "id": "33",
          "index": 2,
          "kind": "next",
          "observable_id": "11",
          "subscription_id": "14",
          "type": "send-call",
          "value": 12,
        },
        {
          "id": "34",
          "index": 2,
          "kind": "next",
          "observable_id": "12",
          "subscription_id": "13",
          "type": "send-call",
          "value": 12,
        },
        {
          "id": "34",
          "observable_id": "12",
          "type": "send-call-return",
        },
        {
          "id": "33",
          "observable_id": "11",
          "type": "send-call-return",
        },
        {
          "id": "32",
          "observable_id": "9",
          "type": "send-call-return",
        },
        {
          "id": "31",
          "observable_id": "2",
          "type": "send-call-return",
        },
        {
          "id": "35",
          "index": 1,
          "kind": "next",
          "observable_id": "2",
          "subscription_id": "30",
          "type": "send-call",
          "value": 15,
        },
        {
          "id": "36",
          "index": 3,
          "kind": "next",
          "observable_id": "9",
          "subscription_id": "15",
          "type": "send-call",
          "value": 15,
        },
        {
          "id": "37",
          "index": 3,
          "kind": "next",
          "observable_id": "11",
          "subscription_id": "14",
          "type": "send-call",
          "value": 15,
        },
        {
          "id": "38",
          "index": 3,
          "kind": "next",
          "observable_id": "12",
          "subscription_id": "13",
          "type": "send-call",
          "value": 15,
        },
        {
          "id": "38",
          "observable_id": "12",
          "type": "send-call-return",
        },
        {
          "id": "37",
          "observable_id": "11",
          "type": "send-call-return",
        },
        {
          "id": "36",
          "observable_id": "9",
          "type": "send-call-return",
        },
        {
          "id": "35",
          "observable_id": "2",
          "type": "send-call-return",
        },
        {
          "id": "39",
          "kind": "complete",
          "observable_id": "2",
          "subscription_id": "30",
          "type": "send-call",
        },
        {
          "id": "40",
          "kind": "complete",
          "observable_id": "9",
          "subscription_id": "15",
          "type": "send-call",
        },
        {
          "id": "41",
          "kind": "complete",
          "observable_id": "11",
          "subscription_id": "14",
          "type": "send-call",
        },
        {
          "id": "42",
          "kind": "complete",
          "observable_id": "12",
          "subscription_id": "13",
          "type": "send-call",
        },
        {
          "id": "42",
          "observable_id": "12",
          "type": "send-call-return",
        },
        {
          "id": "41",
          "observable_id": "11",
          "type": "send-call-return",
        },
        {
          "id": "40",
          "observable_id": "9",
          "type": "send-call-return",
        },
        {
          "id": "39",
          "observable_id": "2",
          "type": "send-call-return",
        },
        {
          "id": "30",
          "observable_id": "2",
          "subscription": SafeSubscriber {
            "__id__": "30",
            "_finalizers": null,
            "_parentage": null,
            "closed": true,
            "destination": null,
            "initialTeardown": undefined,
            "isStopped": true,
            Symbol(rxjs-debugger-patched-unsubscribe): true,
          },
          "type": "subscribe-call-return",
        },
        {
          "id": "29",
          "observable_id": "26",
          "type": "send-call-return",
        },
        {
          "id": "43",
          "kind": "complete",
          "observable_id": "26",
          "subscription_id": "28",
          "type": "send-call",
        },
        {
          "id": "43",
          "observable_id": "26",
          "type": "send-call-return",
        },
        {
          "id": "28",
          "observable_id": "26",
          "subscription": SafeSubscriber {
            "__id__": "28",
            "_finalizers": null,
            "_parentage": null,
            "closed": true,
            "destination": null,
            "initialTeardown": undefined,
            "isStopped": true,
            Symbol(rxjs-debugger-patched-unsubscribe): true,
          },
          "type": "subscribe-call-return",
        },
        {
          "id": "15",
          "observable_id": "9",
          "subscription": SafeSubscriber {
            "__id__": "15",
            "_finalizers": null,
            "_parentage": null,
            "closed": true,
            "destination": null,
            "initialTeardown": undefined,
            "isStopped": true,
            Symbol(rxjs-debugger-patched-unsubscribe): true,
          },
          "type": "subscribe-call-return",
        },
        {
          "id": "14",
          "observable_id": "11",
          "subscription": SafeSubscriber {
            "__id__": "14",
            "_finalizers": null,
            "_parentage": null,
            "closed": true,
            "destination": null,
            "initialTeardown": undefined,
            "isStopped": true,
            Symbol(rxjs-debugger-patched-unsubscribe): true,
          },
          "type": "subscribe-call-return",
        },
        {
          "type": "disable",
        },
        {
          "args": [
            {
              "complete": [Function],
              "error": [Function],
              "next": [Function],
            },
          ],
          "id": "14",
          "index": 0,
          "observable_id": "11",
          "type": "unsubscribe-call",
        },
        {
          "id": "14",
          "observable_id": "11",
          "type": "unsubscribe-call-return",
        },
        {
          "type": "enable",
        },
        {
          "id": "13",
          "observable_id": "12",
          "subscription": SafeSubscriber {
            "__id__": "13",
            "_finalizers": null,
            "_parentage": null,
            "closed": true,
            "destination": null,
            "initialTeardown": undefined,
            "isStopped": true,
            Symbol(rxjs-debugger-patched-unsubscribe): true,
          },
          "type": "subscribe-call-return",
        },
      ]
    `)
    expect(main.state$.value).toMatchInlineSnapshot(`
      {
        "isEnabled": true,
        "stack": {
          "arg": [],
          "arg_call": [],
          "hmr_module": [
            {
              "created_at": 0,
              "id": "test",
              "prev_keys": [],
              "url": "0_test-utils.ts",
              "version": 1,
            },
          ],
          "hmr_track": [],
          "observable": [],
          "operator": [],
          "operator_fun": [],
          "pipe": [],
          "send": [],
          "subscription": [],
        },
        "store": {
          "arg": {
            "27": {
              "created_at": 2000,
              "id": "27",
              "is_function": false,
              "observable_id": "26",
              "owner_id": "26",
              "path": "$args.0",
            },
            "3": {
              "created_at": 1000,
              "id": "3",
              "is_function": false,
              "observable_id": "2",
              "owner_id": "2",
              "path": "$args.0",
            },
            "4": {
              "created_at": 1000,
              "id": "4",
              "is_function": false,
              "observable_id": "2",
              "owner_id": "2",
              "path": "$args.0",
            },
          },
          "arg_call": {},
          "hmr_module": {
            "test": {
              "created_at": 0,
              "id": "test",
              "prev_keys": [],
              "url": "0_test-utils.ts",
              "version": 1,
            },
          },
          "hmr_track": {
            "1": {
              "created_at": 1000,
              "created_at_end": 1000,
              "id": "1",
              "index": 0,
              "key": "main",
              "module_id": "test",
              "module_version": 1,
              "mutable_observable_id": "11",
              "parent_track_id": undefined,
              "prev_observable_ids": [],
              "stable_observable_id": "12",
              "version": 0,
            },
          },
          "observable": {
            "11": {
              "created_at": 1000,
              "created_at_end": 1000,
              "id": "11",
              "name": "from($ref[2]).repeat({count:2,delay:fn}).tap({complete:fn,error:fn,next:fn})",
              "obs_ref": WeakRef {},
            },
            "12": {
              "created_at": 1000,
              "created_at_end": 1000,
              "id": "12",
              "name": "new Observable",
              "obs_ref": WeakRef {},
            },
            "2": {
              "created_at": 1000,
              "created_at_end": 1000,
              "id": "2",
              "name": "from($ref[2])",
              "obs_ref": WeakRef {},
            },
            "26": {
              "created_at": 2000,
              "created_at_end": 2000,
              "id": "26",
              "name": "innerFrom($ref[26])",
              "obs_ref": WeakRef {},
            },
            "9": {
              "created_at": 1000,
              "created_at_end": 1000,
              "id": "9",
              "name": "from($ref[2]).repeat({count:2,delay:fn})",
              "obs_ref": WeakRef {},
            },
          },
          "operator": {
            "10": {
              "created_at": 1000,
              "created_at_end": 1000,
              "id": "10",
              "index": 1,
              "operator_fun_id": "7",
              "pipe_id": "5",
              "source_observable_id": "9",
              "target_observable_id": "11",
            },
            "8": {
              "created_at": 1000,
              "created_at_end": 1000,
              "id": "8",
              "index": 0,
              "operator_fun_id": "6",
              "pipe_id": "5",
              "source_observable_id": "2",
              "target_observable_id": "9",
            },
          },
          "operator_fun": {
            "6": {
              "created_at": 1000,
              "created_at_end": 1000,
              "id": "6",
              "name": "repeat({count:2,delay:fn})",
            },
            "7": {
              "created_at": 1000,
              "created_at_end": 1000,
              "id": "7",
              "name": "tap({complete:fn,error:fn,next:fn})",
            },
          },
          "pipe": {
            "5": {
              "created_at": 1000,
              "created_at_end": 1000,
              "id": "5",
              "observable_id": "11",
              "parent_observable_id": "2",
            },
          },
          "send": {
            "19": {
              "created_at": 1000,
              "created_at_end": 1000,
              "id": "19",
              "observable_id": "11",
              "subscription_id": "14",
              "type": "next",
              "value": 12,
            },
            "20": {
              "created_at": 1000,
              "created_at_end": 1000,
              "id": "20",
              "observable_id": "12",
              "subscription_id": "13",
              "type": "next",
              "value": 12,
            },
            "23": {
              "created_at": 2000,
              "created_at_end": 2000,
              "id": "23",
              "observable_id": "11",
              "subscription_id": "14",
              "type": "next",
              "value": 15,
            },
            "24": {
              "created_at": 2000,
              "created_at_end": 2000,
              "id": "24",
              "observable_id": "12",
              "subscription_id": "13",
              "type": "next",
              "value": 15,
            },
            "33": {
              "created_at": 3000,
              "created_at_end": 3000,
              "id": "33",
              "observable_id": "11",
              "subscription_id": "14",
              "type": "next",
              "value": 12,
            },
            "34": {
              "created_at": 3000,
              "created_at_end": 3000,
              "id": "34",
              "observable_id": "12",
              "subscription_id": "13",
              "type": "next",
              "value": 12,
            },
            "37": {
              "created_at": 4000,
              "created_at_end": 4000,
              "id": "37",
              "observable_id": "11",
              "subscription_id": "14",
              "type": "next",
              "value": 15,
            },
            "38": {
              "created_at": 4000,
              "created_at_end": 4000,
              "id": "38",
              "observable_id": "12",
              "subscription_id": "13",
              "type": "next",
              "value": 15,
            },
            "41": {
              "created_at": 5000,
              "created_at_end": 5000,
              "id": "41",
              "observable_id": "11",
              "subscription_id": "14",
              "type": "complete",
            },
            "42": {
              "created_at": 5000,
              "created_at_end": 5000,
              "id": "42",
              "observable_id": "12",
              "subscription_id": "13",
              "type": "complete",
            },
          },
          "subscription": {
            "13": {
              "created_at": 1000,
              "created_at_end": 5000,
              "id": "13",
              "is_sync": false,
              "module_id": "test",
              "observable_id": "12",
              "parent_subscription_id": undefined,
              "sub_ref": WeakRef {},
            },
            "15": {
              "created_at": 1000,
              "created_at_end": 5000,
              "id": "15",
              "is_sync": false,
              "module_id": "test",
              "observable_id": "9",
              "parent_subscription_id": "13",
              "sub_ref": WeakRef {},
            },
            "16": {
              "created_at": 1000,
              "created_at_end": 2000,
              "id": "16",
              "is_sync": false,
              "module_id": "test",
              "observable_id": "2",
              "parent_subscription_id": "15",
              "sub_ref": WeakRef {},
              "unsubscribed_at": 2000,
              "unsubscribed_at_end": 2000,
            },
            "28": {
              "created_at": 2000,
              "created_at_end": 5000,
              "id": "28",
              "is_sync": false,
              "module_id": "test",
              "observable_id": "26",
              "parent_subscription_id": "15",
              "sub_ref": WeakRef {},
            },
            "30": {
              "created_at": 2000,
              "created_at_end": 5000,
              "id": "30",
              "is_sync": false,
              "module_id": "test",
              "observable_id": "2",
              "parent_subscription_id": "28",
              "sub_ref": WeakRef {},
            },
          },
        },
      }
    `)

    expect(renderStaticTree(main.state$.value.store)).toMatchInlineSnapshot(`
      "from($ref[40])                                                                                                                                                                                                                                                       // #40
        .pipe(                                                                                                                                                                                                                                                             // 
          repeat({count:2,delay:fn})({ delay: () => (0,of)(true), count: 2 }),                                                                                                                                                                                             // #58
          tap({complete:fn,error:fn,next:fn})({ next: () => {
                    (0,main. setNow)(index++ * 1e3);
                  }, complete: () => {
                    (0,main. setNow)(index++ * 1e3);
                  }, error: () => {
                    (0,main. setNow)(index++ * 1e3);
                  } }),  // #60
        )                                                                                                                                                                                                                                                                  // -> #60
      new Observable                                                                                                                                                                                                                                                       // #61"
    `)
  })
})
//   it("tracks all 4 observable types with timestamps", () => {
//     main.setNow(1000)
//     const obs$ = new Observable(s => s.complete())
//     main.setNow(2000)
//     const subject$ = new Subject()
//     main.setNow(3000)
//     const bsubject$ = new BehaviorSubject(42)

//     expect(main.state$.value.store).toMatchInlineSnapshot(`
//       {
//         "arg": {
//           "12": {
//             "created_at": 1000,
//             "fn_ref": WeakRef {},
//             "fn_source": "() => (0,__vite_ssr_import_4__.of)(true)",
//             "id": "12",
//             "is_function": true,
//             "owner_id": "11",
//             "path": "$args.0.delay",
//           },
//           "13": {
//             "created_at": 1000,
//             "id": "13",
//             "is_function": false,
//             "owner_id": "11",
//             "path": "$args.0.count",
//             "value": 2,
//           },
//           "15": {
//             "created_at": 1000,
//             "fn_ref": WeakRef {},
//             "fn_source": "() => {
//                     (0,__vite_ssr_import_2__.main. setNow)(index++ * 1e3);
//                   }",
//             "id": "15",
//             "is_function": true,
//             "owner_id": "14",
//             "path": "$args.0.next",
//           },
//           "16": {
//             "created_at": 1000,
//             "fn_ref": WeakRef {},
//             "fn_source": "() => {
//                     (0,__vite_ssr_import_2__.main. setNow)(index++ * 1e3);
//                   }",
//             "id": "16",
//             "is_function": true,
//             "owner_id": "14",
//             "path": "$args.0.complete",
//           },
//           "17": {
//             "created_at": 1000,
//             "fn_ref": WeakRef {},
//             "fn_source": "() => {
//                     (0,__vite_ssr_import_2__.main. setNow)(index++ * 1e3);
//                   }",
//             "id": "17",
//             "is_function": true,
//             "owner_id": "14",
//             "path": "$args.0.error",
//           },
//           "2": {
//             "created_at": 1000,
//             "id": "2",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0.0",
//             "value": 12,
//           },
//           "3": {
//             "created_at": 1000,
//             "id": "3",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0.1",
//             "value": 15,
//           },
//           "4": {
//             "created_at": 1000,
//             "id": "4",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0.0",
//             "value": 12,
//           },
//           "40": {
//             "created_at": 2000,
//             "id": "40",
//             "is_function": false,
//             "observable_id": "39",
//             "owner_id": "39",
//             "path": "$args.0.0",
//             "value": true,
//           },
//           "41": {
//             "created_at": 2000,
//             "id": "41",
//             "is_function": false,
//             "observable_id": "39",
//             "owner_id": "39",
//             "path": "$args.0.0",
//             "value": true,
//           },
//           "42": {
//             "created_at": 2000,
//             "id": "42",
//             "is_function": false,
//             "observable_id": "39",
//             "owner_id": "39",
//             "path": "$args.0",
//             "value": true,
//           },
//           "43": {
//             "created_at": 2000,
//             "id": "43",
//             "is_function": false,
//             "observable_id": "39",
//             "owner_id": "39",
//             "path": "$args.0",
//           },
//           "5": {
//             "created_at": 1000,
//             "id": "5",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0.1",
//             "value": 15,
//           },
//           "6": {
//             "created_at": 1000,
//             "id": "6",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0",
//             "value": 12,
//           },
//           "7": {
//             "created_at": 1000,
//             "id": "7",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.1",
//             "value": 15,
//           },
//           "8": {
//             "created_at": 1000,
//             "id": "8",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0",
//           },
//           "9": {
//             "created_at": 1000,
//             "id": "9",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0",
//           },
//         },
//         "arg_call": {
//           "38": {
//             "arg_id": "12",
//             "created_at": 2000,
//             "created_at_end": 2000,
//             "id": "38",
//             "input_values": [
//               1,
//             ],
//             "observable_id": "39",
//             "subscription_id": "25",
//           },
//         },
//         "hmr_module": {
//           "test": {
//             "created_at": 0,
//             "id": "test",
//             "prev_keys": [
//               "main",
//             ],
//             "url": "0_test-utils.ts",
//             "version": 2,
//           },
//         },
//         "hmr_track": {
//           "0": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "0",
//             "index": 0,
//             "key": "main",
//             "module_id": "test",
//             "module_version": 1,
//             "mutable_observable_id": "21",
//             "parent_track_id": undefined,
//             "prev_observable_ids": [],
//             "stable_observable_id": "22",
//             "version": 0,
//           },
//         },
//         "observable": {
//           "1": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "1",
//             "name": "from($ref[1])",
//             "obs_ref": WeakRef {},
//           },
//           "19": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "19",
//             "name": "from($ref[1]).repeat({count:2,delay:fn})",
//             "obs_ref": WeakRef {},
//           },
//           "21": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "21",
//             "name": "from($ref[1]).repeat({count:2,delay:fn}).tap({complete:fn,error:fn,next:fn})",
//             "obs_ref": WeakRef {},
//           },
//           "22": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "22",
//             "name": "new Observable",
//             "obs_ref": WeakRef {},
//           },
//           "39": {
//             "created_at": 2000,
//             "created_at_end": 2000,
//             "id": "39",
//             "name": "innerFrom($ref[39])",
//             "obs_ref": WeakRef {},
//           },
//         },
//         "operator": {
//           "18": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "18",
//             "index": 0,
//             "operator_fun_id": "11",
//             "pipe_id": "10",
//             "source_observable_id": "1",
//             "target_observable_id": "19",
//           },
//           "20": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "20",
//             "index": 1,
//             "operator_fun_id": "14",
//             "pipe_id": "10",
//             "source_observable_id": "19",
//             "target_observable_id": "21",
//           },
//         },
//         "operator_fun": {
//           "11": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "11",
//             "name": "repeat({count:2,delay:fn})",
//           },
//           "14": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "14",
//             "name": "tap({complete:fn,error:fn,next:fn})",
//           },
//         },
//         "pipe": {
//           "10": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "10",
//             "observable_id": "21",
//             "parent_observable_id": "1",
//           },
//         },
//         "send": {
//           "30": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "30",
//             "observable_id": "21",
//             "subscription_id": "24",
//             "type": "next",
//             "value": 12,
//           },
//           "31": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "31",
//             "observable_id": "22",
//             "subscription_id": "23",
//             "type": "next",
//             "value": 12,
//           },
//           "35": {
//             "created_at": 2000,
//             "created_at_end": 2000,
//             "id": "35",
//             "observable_id": "21",
//             "subscription_id": "24",
//             "type": "next",
//             "value": 15,
//           },
//           "36": {
//             "created_at": 2000,
//             "created_at_end": 2000,
//             "id": "36",
//             "observable_id": "22",
//             "subscription_id": "23",
//             "type": "next",
//             "value": 15,
//           },
//           "50": {
//             "created_at": 3000,
//             "created_at_end": 3000,
//             "id": "50",
//             "observable_id": "21",
//             "subscription_id": "24",
//             "type": "next",
//             "value": 12,
//           },
//           "51": {
//             "created_at": 3000,
//             "created_at_end": 3000,
//             "id": "51",
//             "observable_id": "22",
//             "subscription_id": "23",
//             "type": "next",
//             "value": 12,
//           },
//           "55": {
//             "created_at": 4000,
//             "created_at_end": 4000,
//             "id": "55",
//             "observable_id": "21",
//             "subscription_id": "24",
//             "type": "next",
//             "value": 15,
//           },
//           "56": {
//             "created_at": 4000,
//             "created_at_end": 4000,
//             "id": "56",
//             "observable_id": "22",
//             "subscription_id": "23",
//             "type": "next",
//             "value": 15,
//           },
//           "60": {
//             "created_at": 5000,
//             "created_at_end": 5000,
//             "id": "60",
//             "observable_id": "21",
//             "subscription_id": "24",
//             "type": "complete",
//           },
//           "61": {
//             "created_at": 5000,
//             "created_at_end": 5000,
//             "id": "61",
//             "observable_id": "22",
//             "subscription_id": "23",
//             "type": "complete",
//           },
//         },
//         "subscription": {
//           "23": {
//             "created_at": 1000,
//             "created_at_end": 5000,
//             "id": "23",
//             "is_sync": false,
//             "module_id": "test",
//             "observable_id": "22",
//             "parent_subscription_id": undefined,
//             "sub_ref": WeakRef {},
//           },
//           "25": {
//             "created_at": 1000,
//             "created_at_end": 5000,
//             "id": "25",
//             "is_sync": false,
//             "module_id": "test",
//             "observable_id": "19",
//             "parent_subscription_id": "23",
//             "sub_ref": WeakRef {},
//           },
//           "26": {
//             "created_at": 1000,
//             "created_at_end": 2000,
//             "id": "26",
//             "is_sync": false,
//             "module_id": "test",
//             "observable_id": "1",
//             "parent_subscription_id": "25",
//             "sub_ref": WeakRef {},
//             "unsubscribed_at": 2000,
//             "unsubscribed_at_end": 2000,
//           },
//           "44": {
//             "created_at": 2000,
//             "created_at_end": 5000,
//             "id": "44",
//             "is_sync": false,
//             "module_id": "test",
//             "observable_id": "39",
//             "parent_subscription_id": "25",
//             "sub_ref": WeakRef {},
//           },
//           "46": {
//             "created_at": 2000,
//             "created_at_end": 5000,
//             "id": "46",
//             "is_sync": false,
//             "module_id": "test",
//             "observable_id": "1",
//             "parent_subscription_id": "44",
//             "sub_ref": WeakRef {},
//           },
//         },
//       }
//     `)

//     expect(renderStaticTree(main.state$.value.store)).toMatchInlineSnapshot(`
//       "from($ref[1])                                                                                                                                                                                                                                                        // #1
//         .pipe(                                                                                                                                                                                                                                                             //
//           repeat({count:2,delay:fn})({ delay: () => (0,of)(true), count: 2 }),                                                                                                                                                                                             // #19
//           tap({complete:fn,error:fn,next:fn})({ next: () => {
//                     (0,main. setNow)(index++ * 1e3);
//                   }, complete: () => {
//                     (0,main. setNow)(index++ * 1e3);
//                   }, error: () => {
//                     (0,main. setNow)(index++ * 1e3);
//                   } }),  // #21
//         )                                                                                                                                                                                                                                                                  // -> #21
//       new Observable                                                                                                                                                                                                                                                       // #22"
//     `)
//   })

//   it("tracks pipe lifecycle", () => {
//     main.setNow(1000)
//     const obs$ = new Observable<number>(s => {
//       s.next(5)
//       s.complete()
//     })

//     main.setNow(2000)
//     obs$.pipe(
//       (main.setNow(3000), map(it => it * 2)),
//       (main.setNow(4000), filter(it => it !== 0)),
//       (main.setNow(5000),
//       scan((sum, it) => {
//         return sum + it
//       }, 0)),
//     )

//     main.setNow(6000)
//     expect(main.state$.value.store).toMatchInlineSnapshot(`
//       {
//         "arg": {
//           "12": {
//             "created_at": 1000,
//             "fn_ref": WeakRef {},
//             "fn_source": "() => (0,__vite_ssr_import_4__.of)(true)",
//             "id": "12",
//             "is_function": true,
//             "owner_id": "11",
//             "path": "$args.0.delay",
//           },
//           "13": {
//             "created_at": 1000,
//             "id": "13",
//             "is_function": false,
//             "owner_id": "11",
//             "path": "$args.0.count",
//             "value": 2,
//           },
//           "15": {
//             "created_at": 1000,
//             "fn_ref": WeakRef {},
//             "fn_source": "() => {
//                     (0,__vite_ssr_import_2__.main. setNow)(index++ * 1e3);
//                   }",
//             "id": "15",
//             "is_function": true,
//             "owner_id": "14",
//             "path": "$args.0.next",
//           },
//           "16": {
//             "created_at": 1000,
//             "fn_ref": WeakRef {},
//             "fn_source": "() => {
//                     (0,__vite_ssr_import_2__.main. setNow)(index++ * 1e3);
//                   }",
//             "id": "16",
//             "is_function": true,
//             "owner_id": "14",
//             "path": "$args.0.complete",
//           },
//           "17": {
//             "created_at": 1000,
//             "fn_ref": WeakRef {},
//             "fn_source": "() => {
//                     (0,__vite_ssr_import_2__.main. setNow)(index++ * 1e3);
//                   }",
//             "id": "17",
//             "is_function": true,
//             "owner_id": "14",
//             "path": "$args.0.error",
//           },
//           "2": {
//             "created_at": 1000,
//             "id": "2",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0.0",
//             "value": 12,
//           },
//           "3": {
//             "created_at": 1000,
//             "id": "3",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0.1",
//             "value": 15,
//           },
//           "4": {
//             "created_at": 1000,
//             "id": "4",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0.0",
//             "value": 12,
//           },
//           "40": {
//             "created_at": 2000,
//             "id": "40",
//             "is_function": false,
//             "observable_id": "39",
//             "owner_id": "39",
//             "path": "$args.0.0",
//             "value": true,
//           },
//           "41": {
//             "created_at": 2000,
//             "id": "41",
//             "is_function": false,
//             "observable_id": "39",
//             "owner_id": "39",
//             "path": "$args.0.0",
//             "value": true,
//           },
//           "42": {
//             "created_at": 2000,
//             "id": "42",
//             "is_function": false,
//             "observable_id": "39",
//             "owner_id": "39",
//             "path": "$args.0",
//             "value": true,
//           },
//           "43": {
//             "created_at": 2000,
//             "id": "43",
//             "is_function": false,
//             "observable_id": "39",
//             "owner_id": "39",
//             "path": "$args.0",
//           },
//           "5": {
//             "created_at": 1000,
//             "id": "5",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0.1",
//             "value": 15,
//           },
//           "6": {
//             "created_at": 1000,
//             "id": "6",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0",
//             "value": 12,
//           },
//           "7": {
//             "created_at": 1000,
//             "id": "7",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.1",
//             "value": 15,
//           },
//           "8": {
//             "created_at": 1000,
//             "id": "8",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0",
//           },
//           "9": {
//             "created_at": 1000,
//             "id": "9",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0",
//           },
//         },
//         "arg_call": {
//           "38": {
//             "arg_id": "12",
//             "created_at": 2000,
//             "created_at_end": 2000,
//             "id": "38",
//             "input_values": [
//               1,
//             ],
//             "observable_id": "39",
//             "subscription_id": "25",
//           },
//         },
//         "hmr_module": {
//           "test": {
//             "created_at": 0,
//             "id": "test",
//             "prev_keys": [
//               "main",
//             ],
//             "url": "0_test-utils.ts",
//             "version": 3,
//           },
//         },
//         "hmr_track": {
//           "0": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "0",
//             "index": 0,
//             "key": "main",
//             "module_id": "test",
//             "module_version": 1,
//             "mutable_observable_id": "21",
//             "parent_track_id": undefined,
//             "prev_observable_ids": [],
//             "stable_observable_id": "22",
//             "version": 0,
//           },
//         },
//         "observable": {
//           "1": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "1",
//             "name": "from($ref[1])",
//             "obs_ref": WeakRef {},
//           },
//           "19": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "19",
//             "name": "from($ref[1]).repeat({count:2,delay:fn})",
//             "obs_ref": WeakRef {},
//           },
//           "21": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "21",
//             "name": "from($ref[1]).repeat({count:2,delay:fn}).tap({complete:fn,error:fn,next:fn})",
//             "obs_ref": WeakRef {},
//           },
//           "22": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "22",
//             "name": "new Observable",
//             "obs_ref": WeakRef {},
//           },
//           "39": {
//             "created_at": 2000,
//             "created_at_end": 2000,
//             "id": "39",
//             "name": "innerFrom($ref[39])",
//             "obs_ref": WeakRef {},
//           },
//         },
//         "operator": {
//           "18": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "18",
//             "index": 0,
//             "operator_fun_id": "11",
//             "pipe_id": "10",
//             "source_observable_id": "1",
//             "target_observable_id": "19",
//           },
//           "20": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "20",
//             "index": 1,
//             "operator_fun_id": "14",
//             "pipe_id": "10",
//             "source_observable_id": "19",
//             "target_observable_id": "21",
//           },
//         },
//         "operator_fun": {
//           "11": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "11",
//             "name": "repeat({count:2,delay:fn})",
//           },
//           "14": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "14",
//             "name": "tap({complete:fn,error:fn,next:fn})",
//           },
//         },
//         "pipe": {
//           "10": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "10",
//             "observable_id": "21",
//             "parent_observable_id": "1",
//           },
//         },
//         "send": {
//           "30": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "30",
//             "observable_id": "21",
//             "subscription_id": "24",
//             "type": "next",
//             "value": 12,
//           },
//           "31": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "31",
//             "observable_id": "22",
//             "subscription_id": "23",
//             "type": "next",
//             "value": 12,
//           },
//           "35": {
//             "created_at": 2000,
//             "created_at_end": 2000,
//             "id": "35",
//             "observable_id": "21",
//             "subscription_id": "24",
//             "type": "next",
//             "value": 15,
//           },
//           "36": {
//             "created_at": 2000,
//             "created_at_end": 2000,
//             "id": "36",
//             "observable_id": "22",
//             "subscription_id": "23",
//             "type": "next",
//             "value": 15,
//           },
//           "50": {
//             "created_at": 3000,
//             "created_at_end": 3000,
//             "id": "50",
//             "observable_id": "21",
//             "subscription_id": "24",
//             "type": "next",
//             "value": 12,
//           },
//           "51": {
//             "created_at": 3000,
//             "created_at_end": 3000,
//             "id": "51",
//             "observable_id": "22",
//             "subscription_id": "23",
//             "type": "next",
//             "value": 12,
//           },
//           "55": {
//             "created_at": 4000,
//             "created_at_end": 4000,
//             "id": "55",
//             "observable_id": "21",
//             "subscription_id": "24",
//             "type": "next",
//             "value": 15,
//           },
//           "56": {
//             "created_at": 4000,
//             "created_at_end": 4000,
//             "id": "56",
//             "observable_id": "22",
//             "subscription_id": "23",
//             "type": "next",
//             "value": 15,
//           },
//           "60": {
//             "created_at": 5000,
//             "created_at_end": 5000,
//             "id": "60",
//             "observable_id": "21",
//             "subscription_id": "24",
//             "type": "complete",
//           },
//           "61": {
//             "created_at": 5000,
//             "created_at_end": 5000,
//             "id": "61",
//             "observable_id": "22",
//             "subscription_id": "23",
//             "type": "complete",
//           },
//         },
//         "subscription": {
//           "23": {
//             "created_at": 1000,
//             "created_at_end": 5000,
//             "id": "23",
//             "is_sync": false,
//             "module_id": "test",
//             "observable_id": "22",
//             "parent_subscription_id": undefined,
//             "sub_ref": WeakRef {},
//           },
//           "25": {
//             "created_at": 1000,
//             "created_at_end": 5000,
//             "id": "25",
//             "is_sync": false,
//             "module_id": "test",
//             "observable_id": "19",
//             "parent_subscription_id": "23",
//             "sub_ref": WeakRef {},
//           },
//           "26": {
//             "created_at": 1000,
//             "created_at_end": 2000,
//             "id": "26",
//             "is_sync": false,
//             "module_id": "test",
//             "observable_id": "1",
//             "parent_subscription_id": "25",
//             "sub_ref": WeakRef {},
//             "unsubscribed_at": 2000,
//             "unsubscribed_at_end": 2000,
//           },
//           "44": {
//             "created_at": 2000,
//             "created_at_end": 5000,
//             "id": "44",
//             "is_sync": false,
//             "module_id": "test",
//             "observable_id": "39",
//             "parent_subscription_id": "25",
//             "sub_ref": WeakRef {},
//           },
//           "46": {
//             "created_at": 2000,
//             "created_at_end": 5000,
//             "id": "46",
//             "is_sync": false,
//             "module_id": "test",
//             "observable_id": "1",
//             "parent_subscription_id": "44",
//             "sub_ref": WeakRef {},
//           },
//         },
//       }
//     `)

//     expect(renderStaticTree(main.state$.value.store)).toMatchInlineSnapshot(`
//       "from($ref[1])                                                                                                                                                                                                                                                        // #1
//         .pipe(                                                                                                                                                                                                                                                             //
//           repeat({count:2,delay:fn})({ delay: () => (0,of)(true), count: 2 }),                                                                                                                                                                                             // #19
//           tap({complete:fn,error:fn,next:fn})({ next: () => {
//                     (0,main. setNow)(index++ * 1e3);
//                   }, complete: () => {
//                     (0,main. setNow)(index++ * 1e3);
//                   }, error: () => {
//                     (0,main. setNow)(index++ * 1e3);
//                   } }),  // #21
//         )                                                                                                                                                                                                                                                                  // -> #21
//       new Observable                                                                                                                                                                                                                                                       // #22"
//     `)
//   })

//   it("pipe output observable should be in store", () => {
//     const source$ = of(1, 2, 3)
//     const piped$ = source$.pipe(map(x => x * 2))

//     const pipeEntry = Object.values(main.state$.value.store.pipe)[0]
//     const operatorEntry = Object.values(main.state$.value.store.operator)[0]

//     const sourceObs = main.state$.value.store.observable[operatorEntry!.source_observable_id]
//     const targetObs = main.state$.value.store.observable[operatorEntry!.target_observable_id]
//     const pipeOutputObs = main.state$.value.store.observable[pipeEntry!.observable_id]

//     expect({ pipeEntry, operatorEntry, sourceObs, targetObs, pipeOutputObs }).toMatchInlineSnapshot(`
//       {
//         "operatorEntry": {
//           "created_at": 1000,
//           "created_at_end": 1000,
//           "id": "18",
//           "index": 0,
//           "operator_fun_id": "11",
//           "pipe_id": "10",
//           "source_observable_id": "1",
//           "target_observable_id": "19",
//         },
//         "pipeEntry": {
//           "created_at": 1000,
//           "created_at_end": 1000,
//           "id": "10",
//           "observable_id": "21",
//           "parent_observable_id": "1",
//         },
//         "pipeOutputObs": {
//           "created_at": 1000,
//           "created_at_end": 1000,
//           "id": "21",
//           "name": "from($ref[1]).repeat({count:2,delay:fn}).tap({complete:fn,error:fn,next:fn})",
//           "obs_ref": WeakRef {},
//         },
//         "sourceObs": {
//           "created_at": 1000,
//           "created_at_end": 1000,
//           "id": "1",
//           "name": "from($ref[1])",
//           "obs_ref": WeakRef {},
//         },
//         "targetObs": {
//           "created_at": 1000,
//           "created_at_end": 1000,
//           "id": "19",
//           "name": "from($ref[1]).repeat({count:2,delay:fn})",
//           "obs_ref": WeakRef {},
//         },
//       }
//     `)
//   })

//   it("tracks switchMap?", async () => {
//     of(5)
//       .pipe(switchMap((val, index) => of(index + "/" + val)))
//       .subscribe()

//     expect(renderStaticTree(main.state$.value.store)).toMatchInlineSnapshot(`
//       "from($ref[1])                                                                                                                                                                                                                                                        // #1
//         .pipe(                                                                                                                                                                                                                                                             //
//           repeat({count:2,delay:fn})({ delay: () => (0,of)(true), count: 2 }),                                                                                                                                                                                             // #19
//           tap({complete:fn,error:fn,next:fn})({ next: () => {
//                     (0,main. setNow)(index++ * 1e3);
//                   }, complete: () => {
//                     (0,main. setNow)(index++ * 1e3);
//                   }, error: () => {
//                     (0,main. setNow)(index++ * 1e3);
//                   } }),  // #21
//         )                                                                                                                                                                                                                                                                  // -> #21
//       new Observable                                                                                                                                                                                                                                                       // #22"
//     `)

//     expect(main.state$.value.store).toMatchInlineSnapshot(`
//       {
//         "arg": {
//           "12": {
//             "created_at": 1000,
//             "fn_ref": WeakRef {},
//             "fn_source": "() => (0,__vite_ssr_import_4__.of)(true)",
//             "id": "12",
//             "is_function": true,
//             "owner_id": "11",
//             "path": "$args.0.delay",
//           },
//           "13": {
//             "created_at": 1000,
//             "id": "13",
//             "is_function": false,
//             "owner_id": "11",
//             "path": "$args.0.count",
//             "value": 2,
//           },
//           "15": {
//             "created_at": 1000,
//             "fn_ref": WeakRef {},
//             "fn_source": "() => {
//                     (0,__vite_ssr_import_2__.main. setNow)(index++ * 1e3);
//                   }",
//             "id": "15",
//             "is_function": true,
//             "owner_id": "14",
//             "path": "$args.0.next",
//           },
//           "16": {
//             "created_at": 1000,
//             "fn_ref": WeakRef {},
//             "fn_source": "() => {
//                     (0,__vite_ssr_import_2__.main. setNow)(index++ * 1e3);
//                   }",
//             "id": "16",
//             "is_function": true,
//             "owner_id": "14",
//             "path": "$args.0.complete",
//           },
//           "17": {
//             "created_at": 1000,
//             "fn_ref": WeakRef {},
//             "fn_source": "() => {
//                     (0,__vite_ssr_import_2__.main. setNow)(index++ * 1e3);
//                   }",
//             "id": "17",
//             "is_function": true,
//             "owner_id": "14",
//             "path": "$args.0.error",
//           },
//           "2": {
//             "created_at": 1000,
//             "id": "2",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0.0",
//             "value": 12,
//           },
//           "3": {
//             "created_at": 1000,
//             "id": "3",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0.1",
//             "value": 15,
//           },
//           "4": {
//             "created_at": 1000,
//             "id": "4",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0.0",
//             "value": 12,
//           },
//           "40": {
//             "created_at": 2000,
//             "id": "40",
//             "is_function": false,
//             "observable_id": "39",
//             "owner_id": "39",
//             "path": "$args.0.0",
//             "value": true,
//           },
//           "41": {
//             "created_at": 2000,
//             "id": "41",
//             "is_function": false,
//             "observable_id": "39",
//             "owner_id": "39",
//             "path": "$args.0.0",
//             "value": true,
//           },
//           "42": {
//             "created_at": 2000,
//             "id": "42",
//             "is_function": false,
//             "observable_id": "39",
//             "owner_id": "39",
//             "path": "$args.0",
//             "value": true,
//           },
//           "43": {
//             "created_at": 2000,
//             "id": "43",
//             "is_function": false,
//             "observable_id": "39",
//             "owner_id": "39",
//             "path": "$args.0",
//           },
//           "5": {
//             "created_at": 1000,
//             "id": "5",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0.1",
//             "value": 15,
//           },
//           "6": {
//             "created_at": 1000,
//             "id": "6",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0",
//             "value": 12,
//           },
//           "7": {
//             "created_at": 1000,
//             "id": "7",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.1",
//             "value": 15,
//           },
//           "8": {
//             "created_at": 1000,
//             "id": "8",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0",
//           },
//           "9": {
//             "created_at": 1000,
//             "id": "9",
//             "is_function": false,
//             "observable_id": "1",
//             "owner_id": "1",
//             "path": "$args.0",
//           },
//         },
//         "arg_call": {
//           "38": {
//             "arg_id": "12",
//             "created_at": 2000,
//             "created_at_end": 2000,
//             "id": "38",
//             "input_values": [
//               1,
//             ],
//             "observable_id": "39",
//             "subscription_id": "25",
//           },
//         },
//         "hmr_module": {
//           "test": {
//             "created_at": 0,
//             "id": "test",
//             "prev_keys": [
//               "main",
//             ],
//             "url": "0_test-utils.ts",
//             "version": 5,
//           },
//         },
//         "hmr_track": {
//           "0": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "0",
//             "index": 0,
//             "key": "main",
//             "module_id": "test",
//             "module_version": 1,
//             "mutable_observable_id": "21",
//             "parent_track_id": undefined,
//             "prev_observable_ids": [],
//             "stable_observable_id": "22",
//             "version": 0,
//           },
//         },
//         "observable": {
//           "1": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "1",
//             "name": "from($ref[1])",
//             "obs_ref": WeakRef {},
//           },
//           "19": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "19",
//             "name": "from($ref[1]).repeat({count:2,delay:fn})",
//             "obs_ref": WeakRef {},
//           },
//           "21": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "21",
//             "name": "from($ref[1]).repeat({count:2,delay:fn}).tap({complete:fn,error:fn,next:fn})",
//             "obs_ref": WeakRef {},
//           },
//           "22": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "22",
//             "name": "new Observable",
//             "obs_ref": WeakRef {},
//           },
//           "39": {
//             "created_at": 2000,
//             "created_at_end": 2000,
//             "id": "39",
//             "name": "innerFrom($ref[39])",
//             "obs_ref": WeakRef {},
//           },
//         },
//         "operator": {
//           "18": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "18",
//             "index": 0,
//             "operator_fun_id": "11",
//             "pipe_id": "10",
//             "source_observable_id": "1",
//             "target_observable_id": "19",
//           },
//           "20": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "20",
//             "index": 1,
//             "operator_fun_id": "14",
//             "pipe_id": "10",
//             "source_observable_id": "19",
//             "target_observable_id": "21",
//           },
//         },
//         "operator_fun": {
//           "11": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "11",
//             "name": "repeat({count:2,delay:fn})",
//           },
//           "14": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "14",
//             "name": "tap({complete:fn,error:fn,next:fn})",
//           },
//         },
//         "pipe": {
//           "10": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "10",
//             "observable_id": "21",
//             "parent_observable_id": "1",
//           },
//         },
//         "send": {
//           "30": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "30",
//             "observable_id": "21",
//             "subscription_id": "24",
//             "type": "next",
//             "value": 12,
//           },
//           "31": {
//             "created_at": 1000,
//             "created_at_end": 1000,
//             "id": "31",
//             "observable_id": "22",
//             "subscription_id": "23",
//             "type": "next",
//             "value": 12,
//           },
//           "35": {
//             "created_at": 2000,
//             "created_at_end": 2000,
//             "id": "35",
//             "observable_id": "21",
//             "subscription_id": "24",
//             "type": "next",
//             "value": 15,
//           },
//           "36": {
//             "created_at": 2000,
//             "created_at_end": 2000,
//             "id": "36",
//             "observable_id": "22",
//             "subscription_id": "23",
//             "type": "next",
//             "value": 15,
//           },
//           "50": {
//             "created_at": 3000,
//             "created_at_end": 3000,
//             "id": "50",
//             "observable_id": "21",
//             "subscription_id": "24",
//             "type": "next",
//             "value": 12,
//           },
//           "51": {
//             "created_at": 3000,
//             "created_at_end": 3000,
//             "id": "51",
//             "observable_id": "22",
//             "subscription_id": "23",
//             "type": "next",
//             "value": 12,
//           },
//           "55": {
//             "created_at": 4000,
//             "created_at_end": 4000,
//             "id": "55",
//             "observable_id": "21",
//             "subscription_id": "24",
//             "type": "next",
//             "value": 15,
//           },
//           "56": {
//             "created_at": 4000,
//             "created_at_end": 4000,
//             "id": "56",
//             "observable_id": "22",
//             "subscription_id": "23",
//             "type": "next",
//             "value": 15,
//           },
//           "60": {
//             "created_at": 5000,
//             "created_at_end": 5000,
//             "id": "60",
//             "observable_id": "21",
//             "subscription_id": "24",
//             "type": "complete",
//           },
//           "61": {
//             "created_at": 5000,
//             "created_at_end": 5000,
//             "id": "61",
//             "observable_id": "22",
//             "subscription_id": "23",
//             "type": "complete",
//           },
//         },
//         "subscription": {
//           "23": {
//             "created_at": 1000,
//             "created_at_end": 5000,
//             "id": "23",
//             "is_sync": false,
//             "module_id": "test",
//             "observable_id": "22",
//             "parent_subscription_id": undefined,
//             "sub_ref": WeakRef {},
//           },
//           "25": {
//             "created_at": 1000,
//             "created_at_end": 5000,
//             "id": "25",
//             "is_sync": false,
//             "module_id": "test",
//             "observable_id": "19",
//             "parent_subscription_id": "23",
//             "sub_ref": WeakRef {},
//           },
//           "26": {
//             "created_at": 1000,
//             "created_at_end": 2000,
//             "id": "26",
//             "is_sync": false,
//             "module_id": "test",
//             "observable_id": "1",
//             "parent_subscription_id": "25",
//             "sub_ref": WeakRef {},
//             "unsubscribed_at": 2000,
//             "unsubscribed_at_end": 2000,
//           },
//           "44": {
//             "created_at": 2000,
//             "created_at_end": 5000,
//             "id": "44",
//             "is_sync": false,
//             "module_id": "test",
//             "observable_id": "39",
//             "parent_subscription_id": "25",
//             "sub_ref": WeakRef {},
//           },
//           "46": {
//             "created_at": 2000,
//             "created_at_end": 5000,
//             "id": "46",
//             "is_sync": false,
//             "module_id": "test",
//             "observable_id": "1",
//             "parent_subscription_id": "44",
//             "sub_ref": WeakRef {},
//           },
//         },
//       }
//     `)
//   })

//   it("tracks share", () => {
//     const shared$ = of(1, 2).pipe(share())
//     shared$.subscribe()
//     shared$.subscribe()

//     expect(renderStaticTree(main.state$.value.store)).toMatchInlineSnapshot(`
//       "from($ref[1])                                                                                                                                                                                                                                                        // #1
//         .pipe(                                                                                                                                                                                                                                                             //
//           repeat({count:2,delay:fn})({ delay: () => (0,of)(true), count: 2 }),                                                                                                                                                                                             // #19
//           tap({complete:fn,error:fn,next:fn})({ next: () => {
//                     (0,main. setNow)(index++ * 1e3);
//                   }, complete: () => {
//                     (0,main. setNow)(index++ * 1e3);
//                   }, error: () => {
//                     (0,main. setNow)(index++ * 1e3);
//                   } }),  // #21
//         )                                                                                                                                                                                                                                                                  // -> #21
//       new Observable                                                                                                                                                                                                                                                       // #22"
//     `)
//   })

//   it("tracks 2 root observables", () => {
//     const a$ = of(1).pipe(map(x => x * 2))
//     const b$ = of(2).pipe(filter(x => x > 0))

//     expect(renderStaticTree(main.state$.value.store)).toMatchInlineSnapshot(`
//       "from($ref[1])                                                                                                                                                                                                                                                        // #1
//         .pipe(                                                                                                                                                                                                                                                             //
//           repeat({count:2,delay:fn})({ delay: () => (0,of)(true), count: 2 }),                                                                                                                                                                                             // #19
//           tap({complete:fn,error:fn,next:fn})({ next: () => {
//                     (0,main. setNow)(index++ * 1e3);
//                   }, complete: () => {
//                     (0,main. setNow)(index++ * 1e3);
//                   }, error: () => {
//                     (0,main. setNow)(index++ * 1e3);
//                   } }),  // #21
//         )                                                                                                                                                                                                                                                                  // -> #21
//       new Observable                                                                                                                                                                                                                                                       // #22"
//     `)
//   })

//   it("tracks observable refs across pipes", () => {
//     const a$ = of(1).pipe(map(x => x * 2))
//     const b$ = of(2).pipe(filter(x => x > 0))
//     const c$ = a$.pipe(switchMap(() => b$))

//     expect(main.state$.value.store.pipe).toMatchInlineSnapshot(`
//       {
//         "10": {
//           "created_at": 1000,
//           "created_at_end": 1000,
//           "id": "10",
//           "observable_id": "21",
//           "parent_observable_id": "1",
//         },
//       }
//     `)
//     expect(renderStaticTree(main.state$.value.store)).toMatchInlineSnapshot(`
//       "from($ref[1])                                                                                                                                                                                                                                                        // #1
//         .pipe(                                                                                                                                                                                                                                                             //
//           repeat({count:2,delay:fn})({ delay: () => (0,of)(true), count: 2 }),                                                                                                                                                                                             // #19
//           tap({complete:fn,error:fn,next:fn})({ next: () => {
//                     (0,main. setNow)(index++ * 1e3);
//                   }, complete: () => {
//                     (0,main. setNow)(index++ * 1e3);
//                   }, error: () => {
//                     (0,main. setNow)(index++ * 1e3);
//                   } }),  // #21
//         )                                                                                                                                                                                                                                                                  // -> #21
//       new Observable                                                                                                                                                                                                                                                       // #22"
//     `)
//   })
// })

// describe("06_queries", () => {
//   useTrackingTestSetup(true)

//   it("getRootObservables excludes operator targets and runtime obs", () => {
//     of(5)
//       .pipe(switchMap(val => of(val * 2)))
//       .subscribe()

//     const roots = getRootObservables(main.state$.value.store)
//     expect(roots.map(r => ({ id: r.id, name: r.name }))).toMatchInlineSnapshot(`
//       [
//         {
//           "id": "1",
//           "name": "from($ref[1])",
//         },
//         {
//           "id": "22",
//           "name": "new Observable",
//         },
//       ]
//     `)
//   })

//   it("getPipesFor returns pipes for observable", () => {
//     of(1).pipe(map(x => x * 2))

//     const store = main.state$.value.store
//     const roots = getRootObservables(store)
//     const pipes = getPipesFor(store, roots[0]!.id)

//     expect(pipes.map(p => ({ id: p.id, parent_observable_id: p.parent_observable_id }))).toMatchInlineSnapshot(`
//       [
//         {
//           "id": "10",
//           "parent_observable_id": "1",
//         },
//       ]
//     `)
//   })

//   it("getOperatorsIn returns operators sorted by index", () => {
//     of(1).pipe(
//       map(x => x * 2),
//       filter(x => x > 0),
//     )

//     const store = main.state$.value.store
//     const pipeId = Object.keys(store.pipe)[0]!
//     const operators = getOperatorsIn(store, pipeId)

//     expect(operators.map(op => ({ index: op.index, operator_fun_id: op.operator_fun_id }))).toMatchInlineSnapshot(`
//       [
//         {
//           "index": 0,
//           "operator_fun_id": "11",
//         },
//         {
//           "index": 1,
//           "operator_fun_id": "14",
//         },
//       ]
//     `)
//   })

//   it("getArgsFor returns args for operator_fun", () => {
//     of(1).pipe(scan((acc, x) => acc + x, 100))

//     const store = main.state$.value.store
//     const opFunId = Object.keys(store.operator_fun)[0]!
//     const args = getArgsFor(store, opFunId)

//     expect(args.map(a => ({ path: a.path, is_function: a.is_function, value: a.value }))).toMatchInlineSnapshot(`
//       [
//         {
//           "is_function": true,
//           "path": "$args.0.delay",
//           "value": undefined,
//         },
//         {
//           "is_function": false,
//           "path": "$args.0.count",
//           "value": 2,
//         },
//       ]
//     `)
//   })

//   it("getTopLevelSubscriptions returns subs with no parent", () => {
//     of(1).subscribe()
//     of(2).subscribe()

//     const topLevel = getTopLevelSubscriptions(main.state$.value.store)

//     expect(
//       topLevel.map(s => ({ id: s.id, observable_id: s.observable_id, parent: s.parent_subscription_id })),
//     ).toMatchInlineSnapshot(`
//       [
//         {
//           "id": "2",
//           "observable_id": "1",
//           "parent": undefined,
//         },
//         {
//           "id": "23",
//           "observable_id": "22",
//           "parent": undefined,
//         },
//       ]
//     `)
//   })

//   it("getChildSubscriptions returns children of a parent sub", () => {
//     of(1)
//       .pipe(switchMap(() => of(2)))
//       .subscribe()

//     const store = main.state$.value.store
//     const topLevel = getTopLevelSubscriptions(store)
//     const children = getChildSubscriptions(store, topLevel[0]!.id)

//     expect(children.map(c => ({ id: c.id, parent: c.parent_subscription_id }))).toMatchInlineSnapshot(`[]`)
//   })

//   it("getSendsFor returns sends for a subscription", () => {
//     of(1, 2).subscribe()

//     const store = main.state$.value.store
//     const topLevel = getTopLevelSubscriptions(store)
//     const sends = getSendsFor(store, topLevel[0]!.id)

//     expect(sends).toMatchInlineSnapshot(`[]`)
//   })

//   it("getAllSends returns all sends sorted by time", () => {
//     main.setNow(100)
//     of(1).subscribe()
//     main.setNow(200)
//     of(2).subscribe()

//     const sends = getAllSends(main.state$.value.store)

//     expect(sends.map(s => ({ created_at: s.created_at, type: s.type, value: s.value }))).toMatchInlineSnapshot(`
//       [
//         {
//           "created_at": 1000,
//           "type": "next",
//           "value": 12,
//         },
//         {
//           "created_at": 1000,
//           "type": "next",
//           "value": 12,
//         },
//         {
//           "created_at": 2000,
//           "type": "next",
//           "value": 15,
//         },
//         {
//           "created_at": 2000,
//           "type": "next",
//           "value": 15,
//         },
//         {
//           "created_at": 3000,
//           "type": "next",
//           "value": 12,
//         },
//         {
//           "created_at": 3000,
//           "type": "next",
//           "value": 12,
//         },
//         {
//           "created_at": 4000,
//           "type": "next",
//           "value": 15,
//         },
//         {
//           "created_at": 4000,
//           "type": "next",
//           "value": 15,
//         },
//         {
//           "created_at": 5000,
//           "type": "complete",
//           "value": undefined,
//         },
//         {
//           "created_at": 5000,
//           "type": "complete",
//           "value": undefined,
//         },
//       ]
//     `)
//   })

//   it("getDynamicObs returns observables created by arg during subscription", () => {
//     of(5)
//       .pipe(switchMap(val => of(val * 2)))
//       .subscribe()

//     const store = main.state$.value.store
//     const switchMapArg = Object.values(store.arg).find(a => a.is_function)!
//     const dynamicObs = getDynamicObs(store, switchMapArg.id)

//     expect(dynamicObs.map(o => ({ id: o!.id, name: o!.name }))).toMatchInlineSnapshot(`
//       [
//         {
//           "id": "39",
//           "name": "innerFrom($ref[39])",
//         },
//       ]
//     `)
//   })

//   it("isRuntimeObs identifies runtime vs static observables", () => {
//     of(5)
//       .pipe(switchMap(val => of(val * 2)))
//       .subscribe()

//     const store = main.state$.value.store
//     const roots = getRootObservables(store)
//     const argCall = Object.values(store.arg_call)[0]!

//     expect({
//       rootIsRuntime: isRuntimeObs(store, roots[0]!.id),
//       dynamicIsRuntime: isRuntimeObs(store, argCall.observable_id!),
//     }).toMatchInlineSnapshot(`
//       {
//         "dynamicIsRuntime": true,
//         "rootIsRuntime": false,
//       }
//     `)
//   })

//   it("getArgCallForObs returns the arg_call that created an observable", () => {
//     of(5)
//       .pipe(switchMap(val => of(val * 2)))
//       .subscribe()

//     const store = main.state$.value.store
//     const argCall = Object.values(store.arg_call)[0]!
//     const found = getArgCallForObs(store, argCall.observable_id!)

//     expect({ id: found!.id, arg_id: found!.arg_id, observable_id: found!.observable_id }).toMatchInlineSnapshot(`
//       {
//         "arg_id": "12",
//         "id": "38",
//         "observable_id": "39",
//       }
//     `)
//   })
// })

/**
 * if proxied, we will know the structure parse time key, and thats the constant so yea.
 * We have runtime $ref[id].pattern.access.
 * 1. Deal with hmr propogation
 * 2. use same exports check i spose, then invalidate and propogate
 */
