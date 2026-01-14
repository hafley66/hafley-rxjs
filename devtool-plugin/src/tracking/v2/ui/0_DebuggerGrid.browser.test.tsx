import { cleanup, render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { page } from "vitest/browser"

import "../03_scan-accumulator"
import { proxy } from "../04.operators"
import { useTrackingTestSetup } from "../0_test-utils"

import { DebuggerGrid } from "./0_DebuggerGrid"

describe("DebuggerGrid", () => {
  useTrackingTestSetup({ fakeTrack: true, cleanup })

  it("renders switchMap with dynamic observables", async () => {
    // Create observable chain
    proxy
      .of(5)
      .pipe(proxy.switchMap((val, index) => proxy.of(index + "/" + val)))
      .subscribe()
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
          "18": {
            "created_at": 0,
            "id": "18",
            "is_function": false,
            "observable_id": "17",
            "owner_id": "17",
            "path": "$args.0.0",
            "value": "0/5",
          },
          "19": {
            "created_at": 0,
            "id": "19",
            "is_function": false,
            "observable_id": "17",
            "owner_id": "17",
            "path": "$args.0.0",
            "value": "0/5",
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
          "20": {
            "created_at": 0,
            "id": "20",
            "is_function": false,
            "observable_id": "17",
            "owner_id": "17",
            "path": "$args.0",
            "value": "0/5",
          },
          "21": {
            "created_at": 0,
            "id": "21",
            "is_function": false,
            "observable_id": "17",
            "owner_id": "17",
            "path": "$args.0",
            "value": "0/5",
          },
          "22": {
            "created_at": 0,
            "id": "22",
            "is_function": false,
            "observable_id": "17",
            "owner_id": "17",
            "path": "$args.0",
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
          "4": {
            "created_at": 0,
            "id": "4",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0",
            "value": 5,
          },
          "7": {
            "created_at": 0,
            "fn_source": "(val, index) => proxy.of(index + "/" + val)",
            "id": "7",
            "is_function": true,
            "owner_id": "6",
            "path": "$args.0",
          },
          "9": {
            "created_at": 0,
            "fn_source": "(...args2) => {
            const id = createId();
            _observableEvents$.next({
              type: "arg-call",
              id,
              arg_id,
              args: args2
            });
            const out = value(...args2);
            _observableEvents$.next({
              type: "arg-call-return",
              id,
              observable_id: observableIdMap.get(out) ?? "UNKNOWN"
            });
            return out;
          }",
            "id": "9",
            "is_function": true,
            "owner_id": "8",
            "path": "$args.0",
          },
        },
        "arg_call": {
          "15": {
            "arg_id": "9",
            "created_at": 0,
            "created_at_end": 0,
            "id": "15",
            "input_values": [
              5,
              0,
            ],
            "observable_id": "17",
            "subscription_id": "12",
          },
          "16": {
            "arg_id": "7",
            "created_at": 0,
            "created_at_end": 0,
            "id": "16",
            "input_values": [
              5,
              0,
            ],
            "observable_id": "17",
            "subscription_id": "12",
          },
        },
        "observable": {
          "0": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "0",
            "name": "of",
          },
          "17": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "17",
            "name": "innerFrom",
          },
        },
        "operator": {
          "10": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "10",
            "index": 0,
            "operator_fun_id": "6",
            "pipe_id": "5",
            "source_observable_id": "0",
            "target_observable_id": "11",
          },
        },
        "operator_fun": {
          "6": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "6",
            "name": "switchMap",
          },
          "8": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "8",
            "name": "switchMap",
          },
        },
        "pipe": {
          "5": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "5",
            "observable_id": "11",
            "parent_observable_id": "0",
          },
        },
        "send": {
          "14": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "14",
            "observable_id": "0",
            "subscription_id": "13",
            "type": "next",
            "value": 5,
          },
          "24": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "24",
            "observable_id": "17",
            "subscription_id": "23",
            "type": "next",
            "value": "0/5",
          },
          "25": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "25",
            "observable_id": "11",
            "subscription_id": "12",
            "type": "next",
            "value": "0/5",
          },
          "26": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "26",
            "observable_id": "17",
            "subscription_id": "23",
            "type": "complete",
          },
          "27": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "27",
            "observable_id": "0",
            "subscription_id": "13",
            "type": "complete",
          },
          "28": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "28",
            "observable_id": "11",
            "subscription_id": "12",
            "type": "complete",
          },
        },
        "subscription": {
          "12": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "12",
            "is_sync": false,
            "observable_id": "11",
            "parent_subscription_id": undefined,
          },
          "13": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "13",
            "is_sync": false,
            "observable_id": "0",
            "parent_subscription_id": "12",
          },
          "23": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "23",
            "is_sync": false,
            "observable_id": "17",
            "parent_subscription_id": "12",
          },
        },
      }
    `)
    const { container } = render(<DebuggerGrid />)
    await new Promise(r => setTimeout(r, 100))
    await page.screenshot({
      path: "./__snapshots__/v2-grid-switchmap.png",
    })
    expect(container.textContent).toContain("of")
    expect(container.textContent).toContain("switchMap")
  })

  it("renders multiple roots with subscriptions", async () => {
    const a$ = proxy.of(1).pipe(proxy.map(x => x * 2))
    const b$ = proxy.of(2).pipe(proxy.filter(x => x > 0))
    a$.subscribe()
    b$.subscribe()
    const { container } = render(<DebuggerGrid />)
    await new Promise(r => setTimeout(r, 100))
    await page.screenshot({
      path: "./__snapshots__/v2-grid-multi-root.png",
    })
    expect(container.textContent).toMatchInlineSnapshot(
      `"StructureSub #24of #0●  .pipe(    map() → #11●2  ) → #11of #12  .pipe(    filter() → #23●  ) → #23Sendsnext: 2complete"`,
    )
  })
  it("renders repeat with sends", async () => {
    setNow(1000)
    let index = 0
    proxy
      .from([12, 15])
      .pipe(
        proxy.repeat({
          delay: () => proxy.of(true),
          count: 2,
        }),
        proxy.tap({
          next: () => setNow(++index * 1000),
          complete: () => setNow(++index * 1000),
          error: () => setNow(++index * 1000),
        }),
      )
      .subscribe()

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
          "10": {
            "created_at": 1000,
            "id": "10",
            "is_function": false,
            "owner_id": "8",
            "path": "$args.0.count",
            "value": 2,
          },
          "12": {
            "created_at": 1000,
            "fn_source": "(...args2) => {
            const id = createId();
            _observableEvents$.next({
              type: "arg-call",
              id,
              arg_id,
              args: args2
            });
            const out = value(...args2);
            _observableEvents$.next({
              type: "arg-call-return",
              id,
              observable_id: observableIdMap.get(out) ?? "UNKNOWN"
            });
            return out;
          }",
            "id": "12",
            "is_function": true,
            "owner_id": "11",
            "path": "$args.0.delay",
          },
          "13": {
            "created_at": 1000,
            "id": "13",
            "is_function": false,
            "owner_id": "11",
            "path": "$args.0.count",
            "value": 2,
          },
          "15": {
            "created_at": 1000,
            "fn_source": "() => setNow(++index * 1e3)",
            "id": "15",
            "is_function": true,
            "owner_id": "14",
            "path": "$args.0.next",
          },
          "16": {
            "created_at": 1000,
            "fn_source": "() => setNow(++index * 1e3)",
            "id": "16",
            "is_function": true,
            "owner_id": "14",
            "path": "$args.0.complete",
          },
          "17": {
            "created_at": 1000,
            "fn_source": "() => setNow(++index * 1e3)",
            "id": "17",
            "is_function": true,
            "owner_id": "14",
            "path": "$args.0.error",
          },
          "19": {
            "created_at": 1000,
            "fn_source": "(...args2) => {
            const id = createId();
            _observableEvents$.next({
              type: "arg-call",
              id,
              arg_id,
              args: args2
            });
            const out = value(...args2);
            _observableEvents$.next({
              type: "arg-call-return",
              id,
              observable_id: observableIdMap.get(out) ?? "UNKNOWN"
            });
            return out;
          }",
            "id": "19",
            "is_function": true,
            "owner_id": "18",
            "path": "$args.0.next",
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
          "20": {
            "created_at": 1000,
            "fn_source": "(...args2) => {
            const id = createId();
            _observableEvents$.next({
              type: "arg-call",
              id,
              arg_id,
              args: args2
            });
            const out = value(...args2);
            _observableEvents$.next({
              type: "arg-call-return",
              id,
              observable_id: observableIdMap.get(out) ?? "UNKNOWN"
            });
            return out;
          }",
            "id": "20",
            "is_function": true,
            "owner_id": "18",
            "path": "$args.0.complete",
          },
          "21": {
            "created_at": 1000,
            "fn_source": "(...args2) => {
            const id = createId();
            _observableEvents$.next({
              type: "arg-call",
              id,
              arg_id,
              args: args2
            });
            const out = value(...args2);
            _observableEvents$.next({
              type: "arg-call-return",
              id,
              observable_id: observableIdMap.get(out) ?? "UNKNOWN"
            });
            return out;
          }",
            "id": "21",
            "is_function": true,
            "owner_id": "18",
            "path": "$args.0.error",
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
          "4": {
            "created_at": 1000,
            "id": "4",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0.1",
            "value": 15,
          },
          "43": {
            "created_at": 2000,
            "id": "43",
            "is_function": false,
            "observable_id": "42",
            "owner_id": "42",
            "path": "$args.0.0",
            "value": true,
          },
          "44": {
            "created_at": 2000,
            "id": "44",
            "is_function": false,
            "observable_id": "42",
            "owner_id": "42",
            "path": "$args.0.0",
            "value": true,
          },
          "45": {
            "created_at": 2000,
            "id": "45",
            "is_function": false,
            "observable_id": "42",
            "owner_id": "42",
            "path": "$args.0",
            "value": true,
          },
          "46": {
            "created_at": 2000,
            "id": "46",
            "is_function": false,
            "observable_id": "42",
            "owner_id": "42",
            "path": "$args.0",
            "value": true,
          },
          "47": {
            "created_at": 2000,
            "id": "47",
            "is_function": false,
            "observable_id": "42",
            "owner_id": "42",
            "path": "$args.0",
          },
          "5": {
            "created_at": 1000,
            "id": "5",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0.0",
            "value": 12,
          },
          "6": {
            "created_at": 1000,
            "id": "6",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0.1",
            "value": 15,
          },
          "9": {
            "created_at": 1000,
            "fn_source": "() => proxy.of(true)",
            "id": "9",
            "is_function": true,
            "owner_id": "8",
            "path": "$args.0.delay",
          },
        },
        "arg_call": {
          "40": {
            "arg_id": "12",
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "40",
            "input_values": [
              1,
            ],
            "observable_id": "42",
            "subscription_id": "26",
          },
          "41": {
            "arg_id": "9",
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "41",
            "input_values": [
              1,
            ],
            "observable_id": "42",
            "subscription_id": "26",
          },
        },
        "observable": {
          "0": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "0",
            "name": "from",
          },
          "42": {
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "42",
            "name": "innerFrom",
          },
        },
        "operator": {
          "22": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "22",
            "index": 0,
            "operator_fun_id": "8",
            "pipe_id": "7",
            "source_observable_id": "0",
            "target_observable_id": "23",
          },
          "24": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "24",
            "index": 1,
            "operator_fun_id": "14",
            "pipe_id": "7",
            "source_observable_id": "23",
            "target_observable_id": "25",
          },
        },
        "operator_fun": {
          "11": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "11",
            "name": "repeat",
          },
          "14": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "14",
            "name": "tap",
          },
          "18": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "18",
            "name": "tap",
          },
          "8": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "8",
            "name": "repeat",
          },
        },
        "pipe": {
          "7": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "7",
            "observable_id": "25",
            "parent_observable_id": "0",
          },
        },
        "send": {
          "29": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "29",
            "observable_id": "0",
            "subscription_id": "28",
            "type": "next",
            "value": 12,
          },
          "30": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "30",
            "observable_id": "23",
            "subscription_id": "27",
            "type": "next",
            "value": 12,
          },
          "33": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "33",
            "observable_id": "25",
            "subscription_id": "26",
            "type": "next",
            "value": 12,
          },
          "34": {
            "created_at": 1000,
            "created_at_end": 2000,
            "id": "34",
            "observable_id": "0",
            "subscription_id": "28",
            "type": "next",
            "value": 15,
          },
          "35": {
            "created_at": 1000,
            "created_at_end": 2000,
            "id": "35",
            "observable_id": "23",
            "subscription_id": "27",
            "type": "next",
            "value": 15,
          },
          "38": {
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "38",
            "observable_id": "25",
            "subscription_id": "26",
            "type": "next",
            "value": 15,
          },
          "39": {
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "39",
            "observable_id": "0",
            "subscription_id": "28",
            "type": "complete",
          },
          "49": {
            "created_at": 2000,
            "created_at_end": 5000,
            "id": "49",
            "observable_id": "42",
            "subscription_id": "48",
            "type": "next",
            "value": true,
          },
          "51": {
            "created_at": 2000,
            "created_at_end": 3000,
            "id": "51",
            "observable_id": "0",
            "subscription_id": "50",
            "type": "next",
            "value": 12,
          },
          "52": {
            "created_at": 2000,
            "created_at_end": 3000,
            "id": "52",
            "observable_id": "23",
            "subscription_id": "27",
            "type": "next",
            "value": 12,
          },
          "55": {
            "created_at": 3000,
            "created_at_end": 3000,
            "id": "55",
            "observable_id": "25",
            "subscription_id": "26",
            "type": "next",
            "value": 12,
          },
          "56": {
            "created_at": 3000,
            "created_at_end": 4000,
            "id": "56",
            "observable_id": "0",
            "subscription_id": "50",
            "type": "next",
            "value": 15,
          },
          "57": {
            "created_at": 3000,
            "created_at_end": 4000,
            "id": "57",
            "observable_id": "23",
            "subscription_id": "27",
            "type": "next",
            "value": 15,
          },
          "60": {
            "created_at": 4000,
            "created_at_end": 4000,
            "id": "60",
            "observable_id": "25",
            "subscription_id": "26",
            "type": "next",
            "value": 15,
          },
          "61": {
            "created_at": 4000,
            "created_at_end": 5000,
            "id": "61",
            "observable_id": "0",
            "subscription_id": "50",
            "type": "complete",
          },
          "62": {
            "created_at": 4000,
            "created_at_end": 5000,
            "id": "62",
            "observable_id": "23",
            "subscription_id": "27",
            "type": "complete",
          },
          "65": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "65",
            "observable_id": "25",
            "subscription_id": "26",
            "type": "complete",
          },
          "66": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "66",
            "observable_id": "42",
            "subscription_id": "48",
            "type": "complete",
          },
        },
        "subscription": {
          "26": {
            "created_at": 1000,
            "created_at_end": 5000,
            "id": "26",
            "is_sync": false,
            "observable_id": "25",
            "parent_subscription_id": undefined,
          },
          "27": {
            "created_at": 1000,
            "id": "27",
            "is_sync": false,
            "observable_id": "23",
            "parent_subscription_id": "26",
          },
          "28": {
            "created_at": 1000,
            "id": "28",
            "is_sync": false,
            "observable_id": "0",
            "parent_subscription_id": "27",
            "unsubscribed_at": 2000,
            "unsubscribed_at_end": 2000,
          },
          "48": {
            "created_at": 2000,
            "id": "48",
            "is_sync": false,
            "observable_id": "42",
            "parent_subscription_id": "26",
          },
          "50": {
            "created_at": 2000,
            "created_at_end": 5000,
            "id": "50",
            "is_sync": false,
            "observable_id": "0",
            "parent_subscription_id": "48",
          },
        },
      }
    `)
    const { container } = render(<DebuggerGrid />)
    await new Promise(r => setTimeout(r, 100))
    await page.screenshot({
      path: "./__snapshots__/v2-grid-repeat.png",
    })
    expect(container.textContent).toMatchInlineSnapshot(
      `"StructureSub #26from #0  .pipe(    repeat() → #23●    tap() → #25●5  ) → #25Sendsnext: 12next: 15next: 12next: 15complete"`,
    )
  })

  it("clicks sub header to show marble diagram", async () => {
    // Use the repeat test data which has interesting subscription tree
    setNow(1000)
    let index = 0
    proxy
      .from([12, 15])
      .pipe(
        proxy.repeat({
          delay: () => proxy.of(true),
          count: 2,
        }),
        proxy.tap({
          next: () => setNow(++index * 1000),
          complete: () => setNow(++index * 1000),
          error: () => setNow(++index * 1000),
        }),
      )
      .subscribe()

    const { container } = render(<DebuggerGrid />)
    await new Promise(r => setTimeout(r, 100))

    // Click on Sub #15 header to enter marble diagram view
    const subButton = container.querySelector('button[title="Click to view marble diagram"]') as HTMLButtonElement
    expect(subButton).not.toBeNull()
    subButton.click()

    await new Promise(r => setTimeout(r, 100))
    await page.screenshot({
      path: "./__snapshots__/v2-marble-diagram.png",
    })

    // Verify we're in marble diagram view
    expect(container.textContent).toContain("← Back to Overview")
    expect(container.textContent).toMatch(/Sub #\d+ Tree/)
    expect(container.textContent).toMatchInlineSnapshot(
      `"← Back to OverviewSub #26 Tree#26 (tap)●●●●|└─#27 (repeat)●●●●|└─#28 (from)⊗●●|└─#48 (innerFrom)$●|└─#50 (from)●●|1600ms2400ms3200ms4000ms4800ms● next| complete✗ error⊗ unsubscribed$ dynamic observable"`,
    )
  })
})
