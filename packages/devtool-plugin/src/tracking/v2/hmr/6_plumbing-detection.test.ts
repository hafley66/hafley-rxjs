/**
 * Plumbing Detection Tests
 *
 * Validates that the internal plumbing detection in the accumulator works correctly.
 * When trackedObservable subscribes to its inner observable, that wrapper→inner
 * subscription should be detected and skipped (not added to store).
 */

import { Subject } from "rxjs"
import { describe, expect, it } from "vitest"
import { _eventBuffer, state$ } from "../00.types"
import { __$ } from "./0_runtime"
import "../03_scan-accumulator"
import { useTrackingTestSetup } from "../0_test-utils"
import { findTrackByKey } from "./1_queries"

describe("plumbing detection", () => {
  useTrackingTestSetup()

  it("captures event flow for tracked observable", () => {
    _eventBuffer.length = 0

    // Create tracked Subject
    let rawSubject: Subject<number> | undefined
    const wrapper = __$("test:baseline", () => {
      rawSubject = new Subject<number>()
      return rawSubject
    })

    const eventsAfterCreate = _eventBuffer.map(e => e.type)

    // Subscribe to wrapper
    const values: number[] = []
    wrapper.subscribe(v => values.push(v))

    const eventsAfterSubscribe = _eventBuffer.map(e => e.type)

    // Emit value
    rawSubject!.next(42)

    const eventsAfterEmit = _eventBuffer.map(e => e.type)

    // Snapshot all events with their key details
    const eventSummary = _eventBuffer.map(e => {
      const base: Record<string, any> = { type: e.type }
      if ("observable_id" in e) base.observable_id = e.observable_id
      if ("subscription_id" in e) base.subscription_id = e.subscription_id
      if ("id" in e && e.type !== "track-call" && e.type !== "track-call-return") {
        base.id = e.id
      }
      return base
    })

    expect({
      eventsAfterCreate,
      eventsAfterSubscribe,
      eventsAfterEmit,
      eventSummary,
      values,
      subscriptionCount: Object.keys(state$.value.store.subscription).length,
      trackKeys: Object.values(state$.value.store.hmr_track).map(t => t.key),
      track: findTrackByKey(state$.value, "test:baseline"),
    }).toMatchSnapshot()
  })

  it("detects and skips wrapper→inner subscription", () => {
    _eventBuffer.length = 0

    // Create tracked Subject
    let rawSubject: Subject<number> | undefined
    const wrapper = __$("test:notrack", () => {
      rawSubject = new Subject<number>()
      return rawSubject
    })

    const eventsAfterCreate = _eventBuffer.map(e => e.type)

    // Subscribe to wrapper
    const values: number[] = []
    wrapper.subscribe(v => values.push(v))

    const eventsAfterSubscribe = _eventBuffer.map(e => e.type)

    // Emit value
    rawSubject!.next(42)

    const eventsAfterEmit = _eventBuffer.map(e => e.type)

    // Snapshot all events with their key details
    const eventSummary = _eventBuffer.map(e => {
      const base: Record<string, any> = { type: e.type }
      if ("observable_id" in e) base.observable_id = e.observable_id
      if ("subscription_id" in e) base.subscription_id = e.subscription_id
      if ("id" in e && e.type !== "track-call" && e.type !== "track-call-return") {
        base.id = e.id
      }
      return base
    })

    // Check if internal plumbing detection worked
    const subscriptions = Object.values(state$.value.store.subscription)
    const track = findTrackByKey(state$.value, "test:notrack")

    // The wrapper subscription should exist (user → wrapper)
    // The inner subscription should NOT exist (wrapper → inner = internal plumbing)
    const wrapperSub = subscriptions.find(s => s.observable_id === track?.stable_observable_id)
    const innerSub = subscriptions.find(s => s.observable_id === track?.mutable_observable_id)

    expect({
      eventsAfterCreate,
      eventsAfterSubscribe,
      eventsAfterEmit,
      eventSummary,
      values,
      subscriptionCount: Object.keys(state$.value.store.subscription).length,
      trackKeys: Object.values(state$.value.store.hmr_track).map(t => t.key),
      track,
      detection: {
        wrapperSubExists: !!wrapperSub,
        innerSubExists: !!innerSub,
        innerSubShouldBeSkipped: !innerSub, // This is what we want
      },
    }).toMatchSnapshot()
  })

  it("verify track has both stable and mutable IDs set", () => {
    _eventBuffer.length = 0

    // Create tracked Subject
    let rawSubject: Subject<number> | undefined
    __$("test:verify", () => {
      rawSubject = new Subject<number>()
      return rawSubject
    })

    const track = findTrackByKey(state$.value, "test:verify")

    // Verify the track has both IDs set correctly
    expect({
      hasStableId: !!track?.stable_observable_id,
      hasMutableId: !!track?.mutable_observable_id,
      stableId: track?.stable_observable_id,
      mutableId: track?.mutable_observable_id,
      areDistinct: track?.stable_observable_id !== track?.mutable_observable_id,
    }).toMatchSnapshot()
  })

  it("verify subscription stack during inner subscribe", () => {
    _eventBuffer.length = 0

    // Create tracked Subject
    let rawSubject: Subject<number> | undefined
    const wrapper = __$("test:stack", () => {
      rawSubject = new Subject<number>()
      return rawSubject
    })

    // Find the subscribe-call events and their stack context
    const subscribeEvents = _eventBuffer.filter(
      (e): e is Extract<typeof e, { type: "subscribe-call" }> => e.type === "subscribe-call",
    )

    const track = findTrackByKey(state$.value, "test:stack")

    // Subscribe to wrapper - this should trigger both wrapper and inner subscribe-call events
    wrapper.subscribe(() => {})

    const subscribeEventsAfter = _eventBuffer.filter(
      (e): e is Extract<typeof e, { type: "subscribe-call" }> => e.type === "subscribe-call",
    )

    expect({
      subscribeEventsBefore: subscribeEvents.length,
      subscribeEventsAfter: subscribeEventsAfter.map(e => ({
        id: e.id,
        observable_id: e.observable_id,
        isWrapperSub: e.observable_id === track?.stable_observable_id,
        isInnerSub: e.observable_id === track?.mutable_observable_id,
      })),
      track: {
        stable_observable_id: track?.stable_observable_id,
        mutable_observable_id: track?.mutable_observable_id,
      },
    }).toMatchSnapshot()
  })
})
