import { describe, expect, it } from "vitest"
import { parseMarbles, printMarbles, readMarbles } from "./1_notation.js"

function frames(id: string, source: string): Array<[string, number, string | undefined]> {
  const lane = readMarbles(source).lanes.find(it => it.id === id)
  if (lane === undefined) throw new Error(`no lane ${id}`)
  return lane.notifications.map(it => [it.kind, it.frame, it.value])
}

describe("marble notation", () => {
  it("spends one frame per dash and one per notification", () => {
    expect(frames("lane", "lane: -a-b-|")).toEqual([
      ["next", 1, "a"],
      ["next", 3, "b"],
      ["complete", 5, undefined],
    ])
    expect(readMarbles("lane: -a-b-|").frames).toBe(6)
  })

  it("puts a group on one frame, not one frame per character in it", () => {
    // `(ab)` is a shape, not a clock: three symbols cost three frames here, not five.
    expect(frames("lane", "lane: (ab)-c-|")).toEqual([
      ["next", 0, "a"],
      ["next", 0, "b"],
      ["next", 2, "c"],
      ["complete", 4, undefined],
    ])
  })

  it("jumps time with an `Nms`, `Ns`, or `Nm` token at a token boundary", () => {
    expect(frames("lane", "lane: a 10ms b-|")).toEqual([
      ["next", 0, "a"],
      ["next", 11, "b"],
      ["complete", 13, undefined],
    ])
    expect(frames("lane", "lane: a 2s b|").map(([, frame]) => frame)).toEqual([0, 2001, 2002])
  })

  it("keeps a digit inside a word a value symbol, not a time jump", () => {
    expect(frames("lane", "lane: a5ms|")).toEqual([
      ["next", 0, "a"],
      ["next", 1, "5"],
      ["next", 2, "m"],
      ["next", 3, "s"],
      ["complete", 4, undefined],
    ])
  })

  it("reads the subscription and unsubscribe markers without shifting time", () => {
    expect(frames("lane", "lane: ^-a-!")).toEqual([
      ["subscribe", 0, undefined],
      ["next", 2, "a"],
      ["unsubscribe", 4, undefined],
    ])
  })

  it("resolves legend symbols to their values and treats an undeclared symbol as its own value", () => {
    const source = "@legend c=click A=request\nlane: -c-A-|"
    expect(frames("lane", source)).toEqual([
      ["next", 1, "click"],
      ["next", 3, "request"],
      ["complete", 5, undefined],
    ])
    expect(frames("lane", "lane: -z-|")).toEqual([
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

  it("reports what it could not read, with the line it was on", () => {
    const { diagnostics } = parseMarbles(["@nope x", "lane: (a", "  closed: b)"].join("\n"))
    expect(diagnostics.map(it => [it.line, it.message.split(";")[0]])).toEqual([
      [1, "unknown directive @nope"],
      [2, "`(` was never closed"],
      [3, "`)` closed a group that was never opened"],
    ])
  })

  it("prints back what it read, including the group it collapsed", () => {
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
    expect(readMarbles(printed)).toEqual(doc)
    // Gaps print as jumps rather than runs of dashes, and the jump survives the round trip.
    expect(printed).toMatch(/\b250ms\b/)
    expect(printed).toMatch(/\b6ms\b/)
    expect(printed).toContain("  inner")
    expect(parseMarbles(printed).diagnostics).toEqual([])
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
