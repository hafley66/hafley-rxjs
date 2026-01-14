import { Subject } from "rxjs"
import { describe, expect, it } from "vitest"
import { useTrackingTestSetup } from "../0_test-utils"
import { state$ } from "../00.types"
import { defer, of } from "../04.operators"
import { findTrackByKey } from "./1_queries"
import { _rxjs_debugger_module_start } from "./4_module-scope"

describe("ModuleScope", () => {
  useTrackingTestSetup()

  describe("_rxjs_debugger_module_start", () => {
    it("creates hmr_module in store", () => {
      const __$ = _rxjs_debugger_module_start("file:///a.ts")
      __$.end()

      const mod = state$.value.store.hmr_module["file:///a.ts"]
      expect(mod).toMatchInlineSnapshot(`
        {
          "created_at": 0,
          "created_at_end": 0,
          "id": "file:///a.ts",
          "prev_keys": [],
          "url": "file:///a.ts",
          "version": 1,
        }
      `)
    })

    it("increments version on HMR reload", () => {
      const url = `file:///version-test-${Date.now()}.ts`

      // First load with Subject
      const __$1 = _rxjs_debugger_module_start(url)
      expect(state$.value.store.hmr_module[url]?.version).toBe(1)

      __$1("obs", () => new Subject())
      expect(state$.value.store.hmr_module[url]?.version).toBe(1)

      __$1.end()
      expect(state$.value.store.hmr_module[url]?.version).toBe(1)

      // HMR reload
      const __$2 = _rxjs_debugger_module_start(url)
      expect(state$.value.store.hmr_module[url]?.version).toBe(2)

      __$2("obs", () => new Subject())
      expect(state$.value.store.hmr_module[url]?.version).toBe(2)

      __$2.end()
      expect(state$.value.store.hmr_module[url]?.version).toBe(2)
    })

    it("stamps module_id on hmr_track entities", () => {
      const __$ = _rxjs_debugger_module_start("file:///c.ts")
      __$("myObs", () => new Subject())
      __$.end()

      expect(findTrackByKey(state$.value, "myObs")?.module_id).toBe("file:///c.ts")
    })
  })

  describe("nested keys", () => {
    it("concatenates keys with colon delimiter", () => {
      const __$ = _rxjs_debugger_module_start("file:///d.ts")
      __$("outer", $ => {
        $("inner", () => new Subject())
      })
      __$.end()

      expect(findTrackByKey(state$.value, "outer:inner")).toBeDefined()
      expect(findTrackByKey(state$.value, "outer:inner")?.module_id).toBe("file:///d.ts")
    })

    it("deeply nested keys work correctly", () => {
      const __$ = _rxjs_debugger_module_start("file:///e.ts")
      __$("a", $ => {
        $("b", $ => {
          $("c", () => new Subject())
        })
      })
      __$.end()

      expect(findTrackByKey(state$.value, "a:b:c")).toBeDefined()
    })
  })

  describe("orphan detection", () => {
    it("snapshots prev_keys on HMR reload", () => {
      // First load - create obs1 and obs2
      const __$1 = _rxjs_debugger_module_start("file:///f.ts")
      __$1("obs1", () => new Subject())
      __$1("obs2", () => new Subject())
      __$1.end()

      // At start of HMR reload, prev_keys should capture current keys
      const __$2 = _rxjs_debugger_module_start("file:///f.ts")
      // prev_keys set at hmr-module-call, before any tracks created this version
      // After end(), prev_keys cleared
      __$2("obs1", () => new Subject())
      __$2.end()

      // prev_keys cleared after processing
      expect(state$.value.store.hmr_module["file:///f.ts"]?.prev_keys).toEqual([])
    })

    it("cleans up orphaned tracks: deletes from store and completes wrapper", () => {
      // First load - create obs1 and obs2
      const __$1 = _rxjs_debugger_module_start("file:///orphan-cleanup.ts")
      const wrapper1 = __$1("orphan_obs1", () => new Subject())
      const wrapper2 = __$1("orphan_obs2", () => new Subject())
      __$1.end()

      // Subscribe to wrapper2 to detect complete
      let wrapper2Completed = false
      wrapper2.subscribe({ complete: () => (wrapper2Completed = true) })

      // Snapshot before HMR: both tracks exist
      const trackKeysBefore = Object.values(state$.value.store.hmr_track)
        .map(t => t.key)
        .filter(k => k.startsWith("orphan_"))
      expect(trackKeysBefore).toMatchInlineSnapshot(`
        [
          "orphan_obs1",
          "orphan_obs2",
        ]
      `)

      // HMR reload - only re-create obs1, orphan obs2
      const __$2 = _rxjs_debugger_module_start("file:///orphan-cleanup.ts")
      __$2("orphan_obs1", () => new Subject())
      // orphan_obs2 NOT re-created
      __$2.end()

      // Snapshot after HMR: obs2 deleted, obs1 remains
      const trackKeysAfter = Object.values(state$.value.store.hmr_track)
        .map(t => t.key)
        .filter(k => k.startsWith("orphan_"))
      expect(trackKeysAfter).toMatchInlineSnapshot(`
        [
          "orphan_obs1",
        ]
      `)

      // wrapper2 was completed (triggers watcher cleanup)
      expect(wrapper2Completed).toMatchInlineSnapshot(`true`)
    })

    it("unsubscribes subscriptions to orphaned observables via sub_ref", () => {
      // First load - create tracked observable and subscribe to it
      const __$1 = _rxjs_debugger_module_start("file:///sub-cleanup.ts")
      const wrapper = __$1("data$", () => new Subject<number>())
      __$1.end()

      // External subscription to the tracked observable
      const received: number[] = []
      const sub = wrapper.subscribe(v => received.push(v))
      expect(sub.closed).toBe(false)

      // HMR reload - orphan data$ (don't re-create it)
      const __$2 = _rxjs_debugger_module_start("file:///sub-cleanup.ts")
      // data$ NOT re-created - it's an orphan
      __$2.end()

      // Subscription should be unsubscribed via sub_ref cleanup
      expect(sub.closed).toBe(true)
    })
  })

  describe(".sub() wrapper", () => {
    it("returns the subscription from factory", () => {
      const __$ = _rxjs_debugger_module_start("file:///g.ts")
      const subject$ = new Subject<number>()
      const received: number[] = []

      const sub = __$.sub("mySub", () => subject$.subscribe(v => received.push(v)))
      __$.end()

      subject$.next(1)
      subject$.next(2)

      expect(received).toEqual([1, 2])
      expect(sub.closed).toBe(false)

      sub.unsubscribe()
      expect(sub.closed).toBe(true)
    })
  })

  describe("module_id property", () => {
    it("exposes module_id on scope", () => {
      const __$ = _rxjs_debugger_module_start("file:///h.ts")
      expect(__$.module_id).toBe("file:///h.ts")
      __$.end()
    })
  })

  describe("defer/lazy factory", () => {
    it("defer factory runs with subscription context", () => {
      const __$ = _rxjs_debugger_module_start("file:///defer-test.ts")

      const innerValues: number[] = []
      const fetch$ = __$("fetch$", () =>
        defer(() => {
          // Factory runs at subscribe time
          return __$("inner", () => of(Math.random()))
        }),
      )
      __$.end()

      // Two subscriptions
      fetch$.subscribe(v => innerValues.push(v))
      fetch$.subscribe(v => innerValues.push(v))

      // Each subscription should get independent value
      expect(innerValues).toHaveLength(2)
      expect(innerValues[0]).not.toBe(innerValues[1])

      // Snapshot the store to understand current behavior
      // Filter to just the tracks from this test - key by track.key for readability
      const relevantTracks = Object.fromEntries(
        Object.values(state$.value.store.hmr_track)
          .filter(t => t.key.includes("fetch$") || t.key.includes("inner"))
          .map(t => [t.key, t]),
      )
      expect(relevantTracks).toMatchInlineSnapshot(`
        {
          "$ref[3]:subscription[20]:inner": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "22",
            "index": 0,
            "key": "$ref[3]:subscription[20]:inner",
            "module_id": "file:///defer-test.ts",
            "module_version": 1,
            "mutable_observable_id": "23",
            "parent_track_id": "0",
            "prev_observable_ids": [],
            "stable_observable_id": "25",
            "version": 0,
          },
          "$ref[3]:subscription[4]:inner": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "6",
            "index": 0,
            "key": "$ref[3]:subscription[4]:inner",
            "module_id": "file:///defer-test.ts",
            "module_version": 1,
            "mutable_observable_id": "7",
            "parent_track_id": "0",
            "prev_observable_ids": [],
            "stable_observable_id": "9",
            "version": 0,
          },
          "fetch$": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "0",
            "index": 0,
            "key": "fetch$",
            "module_id": "file:///defer-test.ts",
            "module_version": 1,
            "mutable_observable_id": "1",
            "parent_track_id": undefined,
            "prev_observable_ids": [],
            "stable_observable_id": "3",
            "version": 0,
          },
        }
      `)
    })

    it("sync observable (of) completes before subscribe-call-return", () => {
      const __$ = _rxjs_debugger_module_start("file:///sync-test.ts")

      const timeline: string[] = []
      const obs$ = __$("obs$", () => of(1, 2, 3))
      __$.end()

      obs$.subscribe({
        next: v => timeline.push(`next:${v}`),
        complete: () => timeline.push("complete"),
      })

      // All happens synchronously
      expect(timeline).toMatchInlineSnapshot(`
        [
          "next:1",
          "next:2",
          "next:3",
          "complete",
        ]
      `)
    })
  })
})
