import { concat, delay, interval, mergeMap, of, switchMap, take, throwError } from "rxjs"
import { describe, expect, it } from "vitest"
import type { MarbleDoc, MarbleLane } from "./0_types.js"
import { runMarbleDemo } from "./2_run.js"

function lane(doc: MarbleDoc, id: string): MarbleLane {
  const found = doc.lanes.find(it => it.id === id)
  if (found === undefined) throw new Error(`no lane ${id} in ${doc.lanes.map(it => it.id).join(", ")}`)
  return found
}

/** `[frame, value]` for every `next`, which is what a reader of the diagram sees. */
function emissions(doc: MarbleDoc, id: string): Array<[number, string | undefined]> {
  return lane(doc, id)
    .notifications.filter(it => it.kind === "next")
    .map(it => [it.frame, it.value])
}

function kinds(doc: MarbleDoc, id: string): string[] {
  return lane(doc, id).notifications.map(it => `${it.kind}@${it.frame}`)
}

describe("runMarbleDemo", () => {
  it("records synchronous emissions on one frame and the completion after them", () => {
    const doc = runMarbleDemo({ values: of(1, 2, 3) })
    expect(kinds(doc, "values")).toEqual(["subscribe@0", "next@0", "next@0", "next@0", "complete@0"])
    expect(lane(doc, "values").notifications.map(it => it.value)).toEqual([undefined, "1", "2", "3", undefined])
    expect(doc.frames).toBe(1)
  })

  it("runs timed sources in virtual milliseconds, not wall clock", () => {
    const doc = runMarbleDemo({ ticks: interval(1000).pipe(take(3)) })
    expect(emissions(doc, "ticks")).toEqual([
      [1000, "0"],
      [2000, "1"],
      [3000, "2"],
    ])
    expect(doc.frames).toBe(3001)
  })

  it("delays schedule on the same virtual clock", () => {
    const doc = runMarbleDemo({ late: of("a").pipe(delay(5)) })
    expect(kinds(doc, "late")).toEqual(["subscribe@0", "next@5", "complete@5"])
  })

  it("cuts a lane that outruns the window and calls the cut an unsubscribe", () => {
    const doc = runMarbleDemo({ endless: interval(1) }, { frames: 5 })
    // The window closes at frame 5 before the tick scheduled for frame 5 runs.
    expect(emissions(doc, "endless")).toEqual([
      [1, "0"],
      [2, "1"],
      [3, "2"],
      [4, "3"],
    ])
    expect(kinds(doc, "endless")).toContain("unsubscribe@5")
    expect(kinds(doc, "endless")).not.toContain("complete@5")
  })

  it("shows switchMap dropping the inner lane where mergeMap keeps it", () => {
    const outer = interval(10)
    const doc = runMarbleDemo(
      {
        outer,
        switched: outer.pipe(switchMap(() => interval(3))),
        merged: outer.pipe(mergeMap(() => interval(3))),
      },
      { frames: 24, parents: { switched: "outer", merged: "outer" } },
    )
    expect(emissions(doc, "outer").map(([frame]) => frame)).toEqual([10, 20])
    expect(emissions(doc, "switched").map(([frame]) => frame)).toEqual([13, 16, 19, 23])
    expect(emissions(doc, "merged").map(([frame]) => frame)).toEqual([13, 16, 19, 22, 23])
    expect(lane(doc, "switched").parent).toBe("outer")
  })

  it("records an error lane as an error, with the message as its value", () => {
    const doc = runMarbleDemo({
      failing: concat(
        of(1, 2),
        throwError(() => new Error("boom")),
      ),
    })
    expect(kinds(doc, "failing")).toEqual(["subscribe@0", "next@0", "next@0", "error@0"])
    expect(lane(doc, "failing").notifications.at(-1)?.value).toBe("boom")
  })

  it("formats a non-primitive value for the marble", () => {
    const doc = runMarbleDemo({ objects: of({ id: 7, tag: "a" }) })
    expect(emissions(doc, "objects")[0]?.[1]).toBe('{"id":7,"tag":"a"}')
  })

  it("orders lanes by `order` first and by key order after it", () => {
    const doc = runMarbleDemo({ b: of(1), a: of(1), c: of(1) }, { order: ["c"] })
    expect(doc.lanes.map(it => it.id)).toEqual(["c", "b", "a"])
  })

  it("maps a lane label when one is given", () => {
    const doc = runMarbleDemo({ a: of(1) }, { labels: { a: "the source" } })
    expect(doc.lanes[0]?.label).toBe("the source")
  })
})
