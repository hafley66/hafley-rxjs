/**
 * DIAGNOSTIC: Verify the entity_id change theory
 */

import { Subject } from "rxjs"
import { describe, expect, it } from "vitest"
import { useTrackingTestSetup } from "../0_test-utils"
import { __withNoTrack, state$ } from "../00.types"
import { state$$ } from "../03_scan-accumulator"
import { proxy } from "../04.operators"
import { _rxjs_debugger_module_start } from "./4_module-scope"

describe("VERIFY: entity_id change causing reconnection", () => {
  useTrackingTestSetup()

  it("SIMPLE: just track a Subject directly", () => {
    const __$ = _rxjs_debugger_module_start("file:///simple.ts")
    let inner$: Subject<number> | null = null

    const tracked$ = __$("simple", () => (inner$ = new Subject<number>()))
    __$.end()

    const received: number[] = []
    __withNoTrack(() => tracked$.subscribe(v => received.push(v)))

    inner$!.next(1)
    inner$!.next(2)

    expect(received).toMatchInlineSnapshot(`
      [
        1,
        2,
      ]
    `)
  })

  it("PIPE: track Subject with .pipe(map)", () => {
    const __$ = _rxjs_debugger_module_start("file:///pipe.ts")
    const inner$: null | Subject<number> = __$("inner$", () => new Subject<number>())

    const tracked$ = __$("piped", () => inner$.pipe(proxy.map(x => x * 2)))
    __$.end()

    const received: number[] = []
    __withNoTrack(() => tracked$.subscribe(v => received.push(v)))

    inner$.next(1)
    inner$.next(2)

    expect(received).toMatchInlineSnapshot(`
      [
        2,
        4,
      ]
    `)
  })

  it("SWITCHMAP: outer track with switchMap", () => {
    const log: string[] = []
    const __$ = _rxjs_debugger_module_start("file:///switchmap.ts")
    const trigger$: null | Subject<string> = __$("sw_trigger$", () => new Subject<string>())
    const response$: null | Subject<number> = __$("sw_response$", () => new Subject<number>())

    const tracked$ = __$("sw_outer", () =>
      trigger$.pipe(
        proxy.switchMap((num, index) => {
          log.push("switchMap callback " + num + "/" + index)
          return response$
        }),
      ),
    )
    __$.end()

    const received: number[] = []
    __withNoTrack(() => tracked$.subscribe(v => received.push(v)))

    trigger$.next("go")
    log.push("after trigger")

    response$.next(42)
    log.push("after response")

    expect({ log, received }).toMatchInlineSnapshot(`
      {
        "log": [
          "switchMap callback go/0",
          "after trigger",
          "after response",
        ],
        "received": [
          42,
        ],
      }
    `)
  })

  it("DEFER: track Subject wrapped in defer", () => {
    const log: string[] = []
    const __$ = _rxjs_debugger_module_start("file:///defer.ts")
    const response$: null | Subject<number> = __$("defer_response$", () => new Subject<number>())

    const tracked$ = __$("deferred", () =>
      proxy.defer(() => {
        log.push("defer callback")
        return response$
      }),
    )
    __$.end()

    const received: number[] = []
    __withNoTrack(() => tracked$.subscribe(v => received.push(v)))
    log.push("after subscribe")

    response$.next(42)
    log.push("after emit")

    expect({ log, received }).toMatchInlineSnapshot(`
      {
        "log": [
          "defer callback",
          "after subscribe",
          "after emit",
        ],
        "received": [
          42,
        ],
      }
    `)
  })

  it("NESTED: track inside defer callback", () => {
    const log: string[] = []
    const __$ = _rxjs_debugger_module_start("file:///nested.ts")
    const response$: null | Subject<number> = __$("n_response$", () => new Subject<number>())

    const tracked$ = __$("n_outer", $ =>
      proxy.defer(() => {
        log.push("defer callback")
        const inner = $("inner", () => {
          log.push("inner factory")
          return response$
        })
        log.push("defer after $inner")
        return inner
      }),
    )
    __$.end()

    // Defer should NOT have run yet - it's lazy
    expect(log).toMatchInlineSnapshot(`[]`)

    const received: number[] = []
    __withNoTrack(() => tracked$.subscribe(v => received.push(v)))

    // NOW defer should have run exactly once
    expect(log).toMatchInlineSnapshot(`
      [
        "defer callback",
        "inner factory",
        "defer after $inner",
      ]
    `)

    response$.next(42)
    expect(received).toMatchInlineSnapshot(`
      [
        42,
      ]
    `)
  })
})
