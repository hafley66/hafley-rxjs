import { describe, expect, it } from "vitest"
import { LaneIdSchema, type MarbleDoc, type MarbleKind, type MarbleLane } from "./0_types.js"
import { parseMarbles, printMarbles, readMarbles } from "./1_notation.js"

/** One lane of a document, by id, out of a source that is supposed to be valid. */
function laneOf(doc: MarbleDoc, id: string): MarbleLane {
  const found = doc.lanes.find(it => it.id === id)
  if (found === undefined) throw new Error(`no lane ${id}`)
  return found
}

/** What a consumer sees on a lane: the kind, the column it sits on, and the value it carries. */
function marks(lane: MarbleLane): Array<[MarbleKind, number, string | undefined]> {
  return lane.notifications.map(it => [it.kind, it.tick, it.value])
}

/** The virtual milliseconds a lane's notifications sit at, which is the column each one is on. */
function frames(doc: MarbleDoc, lane: MarbleLane): number[] {
  return lane.notifications.map(it => doc.columns[it.tick] ?? -1)
}

describe("marble notation", () => {
  it("spends one column per element and keeps the milliseconds at the column", () => {
    const doc = readMarbles("lane: -a-b-|")
    const lane = laneOf(doc, "lane")
    expect(marks(lane)).toEqual([
      ["next", 1, "a"],
      ["next", 3, "b"],
      ["complete", 5, undefined],
    ])
    expect(doc.columns).toEqual([0, 1, 2, 3, 4, 5])
    expect(frames(doc, lane)).toEqual([1, 3, 5])
  })

  it("ids every notification as `lane#n`, 1-based in the order the lane produced it", () => {
    const doc = readMarbles(["outer : -a-b|", "  inner : --a|"].join("\n"))
    expect(doc.lanes.map(lane => lane.notifications.map(it => it.id))).toEqual([
      ["outer#1", "outer#2", "outer#3"],
      ["inner#1", "inner#2"],
    ])
  })

  it("puts a group on one column, not one column per element in it", () => {
    // `(ab)` is a shape, not a clock: both values sit on the column the group opens, and the columns
    // the lane goes on to spend are the milliseconds those frames used to be.
    const doc = readMarbles("lane: (ab)-c-|")
    const lane = laneOf(doc, "lane")
    expect(marks(lane)).toEqual([
      ["next", 0, "a"],
      ["next", 0, "b"],
      ["next", 5, "c"],
      ["complete", 7, undefined],
    ])
    expect(doc.columns).toEqual([0, 0, 0, 0, 1, 2, 3, 4])
    expect(frames(doc, lane)).toEqual([0, 0, 2, 4])
  })

  it("jumps the clock with an `Nms`, `Ns`, or `Nm` token at a token boundary", () => {
    // A jump is one column of its own, and the column after it is where the jump lands.
    const jumped = readMarbles("lane: a 10ms b-|")
    expect(jumped.columns).toEqual([0, 1, 11, 12, 13])
    expect(marks(laneOf(jumped, "lane"))).toEqual([
      ["next", 0, "a"],
      ["next", 2, "b"],
      ["complete", 4, undefined],
    ])
    expect(frames(jumped, laneOf(jumped, "lane"))).toEqual([0, 11, 13])
    expect(readMarbles("lane: a 2s b|").columns).toEqual([0, 1, 2001, 2002])
    expect(readMarbles("lane: a 1m b|").columns).toEqual([0, 1, 60001, 60002])
  })

  it("keeps a digit inside a word a value symbol, not a time jump", () => {
    expect(marks(laneOf(readMarbles("lane: a5ms|"), "lane"))).toEqual([
      ["next", 0, "a"],
      ["next", 1, "5"],
      ["next", 2, "m"],
      ["next", 3, "s"],
      ["complete", 4, undefined],
    ])
  })

  it("reads the subscription and unsubscribe markers at the columns they were written on", () => {
    expect(marks(laneOf(readMarbles("lane: --^--a-!"), "lane"))).toEqual([
      ["subscribe", 2, undefined],
      ["next", 5, "a"],
      ["unsubscribe", 7, undefined],
    ])
    // `!` closes the window without spending a millisecond, so the column after it costs nothing.
    expect(readMarbles("lane: ^a!^a!").columns).toEqual([0, 1, 2, 2, 3, 4])
  })

  it("resolves legend symbols to their values and treats an undeclared symbol as its own value", () => {
    const source = "@legend c=click A=request\nlane: -c-A-|"
    expect(marks(laneOf(readMarbles(source), "lane"))).toEqual([
      ["next", 1, "click"],
      ["next", 3, "request"],
      ["complete", 5, undefined],
    ])
    expect(marks(laneOf(readMarbles("lane: -z-|"), "lane"))).toEqual([
      ["next", 1, "z"],
      ["complete", 3, undefined],
    ])
  })

  it("indents a derived lane under the nearest shallower one", () => {
    const doc = readMarbles(["outer : -a----|", "  inner : ---b-|", "  other : ---c-|", "top   : ----|"].join("\n"))
    expect(doc.lanes.map(lane => [lane.id, lane.parent])).toEqual([
      ["outer", null],
      ["inner", "outer"],
      ["other", "outer"],
      ["top", null],
    ])
  })

  it("makes a lane id a machine name and keeps what the author wrote as the label", () => {
    const doc = readMarbles(["1st thing : -a|", "  inner #1 : -b|", "1st thing : -c|"].join("\n"))
    const ids = doc.lanes.map(lane => lane.id)
    for (const id of ids) expect(LaneIdSchema.safeParse(id).success).toBe(true)
    expect(ids).toEqual(["lane-1st-thing", "inner-1", "lane-1st-thing-2"])
    expect(doc.lanes.map(lane => lane.label)).toEqual(["1st thing", "inner #1", "1st thing"])
    expect(doc.lanes.map(lane => lane.parent)).toEqual([null, "lane-1st-thing", null])
  })

  it("reports what it could not read, with the line it was on", () => {
    const { diagnostics } = parseMarbles(["@nope x", "lane: (a", "  closed: b)"].join("\n"))
    expect(diagnostics.map(it => [it.line, it.message.split(";")[0]])).toEqual([
      [1, "unknown directive @nope"],
      [2, "`(` was never closed"],
      [3, "`)` closed a group that was never opened"],
    ])
  })

  it("prints a document back and reads the same document", () => {
    const source = [
      "@title switchMap drops the inner request",
      "@legend a=alpha b=beta",
      "",
      "outer   : -a---b------|",
      "  inner : ---a---b----|",
      "  gap   : -a 250ms b--|",
      "  hot   : --^--a-!",
    ].join("\n")
    const doc = readMarbles(source)
    const printed = printMarbles(doc)
    const reread = readMarbles(printed)
    expect(parseMarbles(printed).diagnostics).toEqual([])
    expect(marks(laneOf(reread, "gap"))).toEqual(marks(laneOf(doc, "gap")))
    expect(marks(laneOf(reread, "hot"))).toEqual(marks(laneOf(doc, "hot")))
    // Every lane, every kind, every value, every tick, and the columns they all sit on.
    expect(reread).toEqual(doc)
  })

  it("prints a gap between adjacent columns as a jump token rather than a run of dashes", () => {
    const doc = readMarbles("lane: a 250ms b|")
    expect(printMarbles(doc)).toContain("250ms")
    expect(readMarbles(printMarbles(doc)).columns).toEqual(doc.columns)
  })

  it("prints a multi-character value through the legend and reads it back", () => {
    const only = readMarbles("@legend z=alpha\nlane: -z-|")
    const printed = printMarbles(only)
    expect(printed).toContain("=alpha")
    expect(readMarbles(printed)).toEqual(only)
  })

  it("ignores blank lines and comments", () => {
    expect(readMarbles(["# a note", "", "lane: -a-|", "   "].join("\n")).lanes).toHaveLength(1)
  })
})
