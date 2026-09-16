import {
  asapScheduler,
  concat,
  concatMap,
  from,
  groupBy,
  interval,
  map,
  Observable,
  observeOn,
  of,
  take,
  throwError,
} from "rxjs"
import { describe, expect, it } from "vitest"
import type { MarbleDoc, MarbleLane } from "./0_types.js"
import { frameAtTick, marbleEntries } from "./0_types.js"
import { readMarbleDemo, runMarbleDemo } from "./2_run.js"

function lane(doc: MarbleDoc, id: string): MarbleLane {
  const found = doc.lanes.find(it => it.id === id)
  if (found === undefined) throw new Error(`no lane ${id} in ${doc.lanes.map(it => it.id).join(", ")}`)
  return found
}

/** `[tick, value]` for every `next`, which is what a reader of the diagram sees. */
function emissions(doc: MarbleDoc, id: string): Array<[number, string | undefined]> {
  return lane(doc, id)
    .notifications.filter(it => it.kind === "next")
    .map(it => [it.tick, it.value])
}

function kinds(doc: MarbleDoc, id: string): string[] {
  return lane(doc, id).notifications.map(it => `${it.kind}@${it.tick}`)
}

describe("runMarbleDemo", () => {
  it("calls one synchronous burst one turn, and gives each rescheduled value a turn of its own", () => {
    const burst = runMarbleDemo({ values: of(1, 2, 3) }).doc
    const turned = runMarbleDemo({
      values: of(1, 2, 3).pipe(concatMap(value => of(value).pipe(observeOn(asapScheduler)))),
    }).doc

    expect(burst.columns).toEqual([0])
    expect(turned.columns).toEqual([0, 0, 0, 0])
    expect(kinds(burst, "values")).toEqual(["subscribe@0", "next@0", "next@0", "next@0", "complete@0"])
    expect(kinds(turned, "values")).toEqual(["subscribe@0", "next@1", "next@2", "next@3", "complete@3"])
    // Every column sits at frame 0. The difference is turns, not time — which is why a frame axis
    // cannot show it and the document has to store it.
    expect(turned.columns.every(frame => frame === 0)).toBe(true)
  })

  it("puts the virtual milliseconds on the column, where a timed lane and a delayed one agree", () => {
    const run = runMarbleDemo({
      ticks: interval(1000).pipe(take(3)),
      late: of("a").pipe(observeOn(asapScheduler, 5)),
    })
    expect(emissions(run.doc, "late")).toEqual([[1, "a"]])
    expect(frameAtTick(run.doc, 1)).toBe(5)
    expect(emissions(run.doc, "ticks").map(([tick]) => frameAtTick(run.doc, tick))).toEqual([1000, 2000, 3000])
  })

  it("cuts a lane that outruns the window and calls the cut a truncate, never an unsubscribe", () => {
    const run = runMarbleDemo({ endless: interval(1) }, { windowMs: 5 })
    expect(kinds(run.doc, "endless")).toEqual([
      "subscribe@0",
      "next@1",
      "next@2",
      "next@3",
      "next@4",
      "next@5",
      "truncate@5",
    ])
    expect(lane(run.doc, "endless").notifications.at(-1)?.note).toContain("window closed")
  })

  it("shows switchMap cancelling the inner and mergeMap letting it finish", () => {
    const run = runMarbleDemo(
      lanes => {
        const outer = lanes.through("outer", interval(10).pipe(take(3)))
        lanes.each("switched", outer, () => interval(6).pipe(take(3)), { op: "switch", name: "req", parent: "outer" })
        lanes.each("merged", outer, () => interval(6).pipe(take(3)), { op: "merge", name: "inner", parent: "outer" })
      },
      { windowMs: 60 },
    )
    const doc = run.doc

    // One subscription to the source, shared: both derived lanes sit on the source's columns.
    const outerTicks = lane(doc, "outer")
      .notifications.filter(it => it.kind === "next")
      .map(it => it.tick)
    expect(outerTicks.map(tick => frameAtTick(doc, tick))).toEqual([10, 20, 30])
    // An inner of `interval(6)` under an outer of `interval(10)` gets one value out before the next
    // outer value cancels it; the last one, past the source's completion, runs to its own end.
    expect(lane(doc, "req1").notifications.map(it => it.kind)).toEqual(["subscribe", "next", "unsubscribe"])
    expect(lane(doc, "req3").notifications.map(it => it.kind)).toEqual([
      "subscribe",
      "next",
      "next",
      "next",
      "complete",
    ])
    expect(lane(doc, "inner1").notifications.map(it => it.kind)).toEqual([
      "subscribe",
      "next",
      "next",
      "next",
      "complete",
    ])

    // Each inner is born on the very column of the outer value that started it, and knows its id.
    // Named through the document rather than written down, because a lane that gains an entry
    // renumbers every value after it.
    const outerValues = lane(doc, "outer").notifications.filter(it => it.kind === "next")
    expect(lane(doc, "req2").born).toEqual({ tick: outerTicks[1], from: outerValues[1]?.id, cause: "1" })
    expect(lane(doc, "req2").parent).toBe("outer")
    expect(lane(doc, "req3").born?.tick).toBe(outerTicks[2])
    // A value on the merged lane lands on the same column as the inner value it came from.
    expect(emissions(doc, "merged")[0]?.[0]).toBe(lane(doc, "inner1").notifications[1]?.tick)
    expect(
      lane(doc, "merged")
        .notifications.filter(it => it.kind === "next")
        .every(it => it.from?.startsWith("inner")),
    ).toBe(true)
    expect(lane(doc, "req1").notifications.at(-1)?.note).toContain("switch dropped it")
  })

  it("opens a shared lane's window on the column its first reader reached it, and says so", () => {
    const run = runMarbleDemo(lanes => {
      const source = lanes.through("source", interval(10).pipe(take(2)), { label: "interval(10)" })
      lanes.each("left", source, () => of("l"), { op: "merge", name: "in" })
      lanes.each("right", source, () => of("r"), { op: "merge", name: "in" })
    })
    const doc = run.doc
    const source = lane(doc, "source")
    // Read, never declared: the only moment this lane entered a state is the one `share` opened for
    // its first reader, so that is the entry the document carries.
    expect(source.notifications[0]?.kind).toBe("subscribe")
    expect(source.notifications[0]?.tick).toBe(0)
    expect(source.notifications[0]?.note).toContain("first reader")
    // One subscription between them: `left` opened it, `right` joined it.
    expect(source.notifications.filter(it => it.kind === "subscribe")).toHaveLength(1)
    expect(source.notifications.filter(it => it.kind === "next")).toHaveLength(2)
    // And the well-order is the lift order, which is not the declaration order: subscribing `left`
    // is what lifted the source, and `right` only joined afterwards.
    expect(marbleEntries(doc, 0).map(entry => `${entry.lane.id}:${entry.notification.kind}`)).toEqual([
      "left:subscribe",
      "source:subscribe",
      "right:subscribe",
    ])
  })

  it("gives groupBy a lane per key, born on the turn that key first appeared", () => {
    const run = runMarbleDemo(lanes => {
      const keys = lanes.through(
        "keys",
        interval(10).pipe(
          take(6),
          map(index => "abacba"[index] ?? ""),
        ),
      )
      lanes.each("out", keys.pipe(groupBy(value => value)), group => group as Observable<unknown>, {
        name: "group",
        parent: "keys",
        innerLabel: value => `key ${(value as { key: string }).key}`,
      })
    })

    expect(run.doc.lanes.map(it => it.id)).toEqual(["keys", "out", "group1", "group2", "group3"])
    expect(lane(run.doc, "group1").label).toBe("key a")
    expect(lane(run.doc, "group3").label).toBe("key c")
    // The source lane's own entry comes first, so every value on it is one past its kind's ordinal:
    // ask the document for the ids instead of counting them.
    const keyValues = lane(run.doc, "keys")
      .notifications.filter(it => it.kind === "next")
      .map(it => it.id)
    expect(lane(run.doc, "group1").born).toMatchObject({ tick: 1, from: keyValues[0] })
    expect(lane(run.doc, "group3").born).toMatchObject({ tick: 4, from: keyValues[3] })
    // Every value a group carries says which source event routed it there.
    expect(emissions(run.doc, "group1").map(([tick]) => tick)).toEqual([1, 3, 6])
    expect(
      lane(run.doc, "group1")
        .notifications.filter(it => it.kind === "next")
        .map(it => it.from),
    ).toEqual([keyValues[0], keyValues[2], keyValues[5]])
    expect(lane(run.doc, "group2").notifications.at(-1)?.kind).toBe("complete")
  })

  it("records the accumulator each scan inner was handed", () => {
    const mergeScanRun = runMarbleDemo(lanes => {
      const source = lanes.through(
        "source",
        interval(10).pipe(
          take(3),
          map(index => index + 1),
        ),
      )
      lanes.each("total", source, value => of((value as number) * 2), { op: "merge", name: "inner", seed: 0 })
    })
    expect(lane(mergeScanRun.doc, "inner2").born).toMatchObject({ seed: "2", cause: "2" })
    expect(emissions(mergeScanRun.doc, "total")).toEqual([
      [1, "2"],
      [2, "4"],
      [3, "6"],
    ])

    const switchScanRun = runMarbleDemo(lanes => {
      const source = lanes.through(
        "source",
        interval(10).pipe(
          take(3),
          map(index => index + 1),
        ),
      )
      lanes.each(
        "total",
        source,
        value =>
          interval(6).pipe(
            take(2),
            map(index => (value as number) * 10 + index),
          ),
        {
          op: "switch",
          name: "inner",
          seed: 0,
        },
      )
    })
    expect(lane(switchScanRun.doc, "inner1").notifications.map(it => it.kind)).toEqual([
      "subscribe",
      "next",
      "unsubscribe",
    ])
    expect(lane(switchScanRun.doc, "inner2").born).toMatchObject({ seed: "10" })
  })

  it("follows expand by the event that spawned each depth", () => {
    const tree: Record<string, string[]> = { root: ["a", "b"], a: ["a1"], b: ["b1"] }
    const run = runMarbleDemo(lanes => {
      lanes.each("tree", of("root"), value => from(tree[value as string] ?? []), { op: "expand", name: "expand" })
    })

    expect(run.doc.lanes.map(it => it.id)).toEqual(["tree", "expand1", "expand2", "expand3", "expand4", "expand5"])
    expect(lane(run.doc, "expand1").born).toMatchObject({ cause: "root", from: null })
    expect(lane(run.doc, "expand2").born).toMatchObject({ from: "expand1#2", cause: "a" })
    expect(lane(run.doc, "expand2").parent).toBe("expand1")
    expect(lane(run.doc, "expand4").born).toMatchObject({ from: "expand1#3", cause: "b" })
    expect(lane(run.doc, "expand3").notifications.map(it => it.kind)).toEqual(["subscribe", "complete"])
    expect(emissions(run.doc, "tree").map(([, value]) => value)).toEqual(["root", "a", "a1", "b", "b1"])
  })

  it("says out loud that a Promise is not on the virtual clock", () => {
    const run = runMarbleDemo({ promised: from(Promise.resolve(9)) })
    expect(run.diagnostics.map(it => it.code)).toEqual(["silent"])
    expect(run.diagnostics[0]?.message).toContain("not on the virtual clock")
    expect(() => readMarbleDemo(run)).toThrow(/virtual clock/)
  })

  it("records an error lane as an error, with the message as its value", () => {
    const doc = runMarbleDemo({
      failing: concat(
        of(1, 2),
        throwError(() => new Error("boom")),
      ),
    }).doc
    expect(kinds(doc, "failing")).toEqual(["subscribe@0", "next@0", "next@0", "error@0"])
    expect(lane(doc, "failing").notifications.at(-1)?.value).toBe("boom")
  })

  it("formats a non-primitive value for the marble", () => {
    const doc = runMarbleDemo({ objects: of({ id: 7, tag: "a" }) }).doc
    expect(emissions(doc, "objects")[0]?.[1]).toBe('{"id":7,"tag":"a"}')
  })

  it("orders lanes by `order` first and by declaration order after it", () => {
    const doc = runMarbleDemo({ b: of(1), a: of(1), c: of(1) }, { order: ["c"] }).doc
    expect(doc.lanes.map(it => it.id)).toEqual(["c", "b", "a"])
  })

  it("maps a lane label when one is given", () => {
    const doc = runMarbleDemo({ a: of(1) }, { labels: { a: "the source" } }).doc
    expect(doc.lanes[0]?.label).toBe("the source")
  })

  it("refuses a lane id an event id could not be split from", () => {
    expect(() => runMarbleDemo(lanes => lanes.lane("has#hash", new Observable<number>()))).toThrow(/lane id/)
  })
})
