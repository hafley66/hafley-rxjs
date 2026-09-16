import { describe, expect, it } from "vitest"
import {
  describeLane,
  laneDepth,
  listeningWindows,
  MARBLES_VERSION,
  type MarbleDoc,
  type MarbleLane,
  normalizeMarbleDoc,
} from "./0_types.js"
import { readMarbles } from "./1_notation.js"

const lane = (id: string, source: string): MarbleLane => {
  const found = readMarbles(source).lanes.find(it => it.id === id)
  if (found === undefined) throw new Error(`no lane ${id}`)
  return found
}

const doc = (lanes: MarbleLane[], frames = 1): MarbleDoc => ({ version: MARBLES_VERSION, frames, lanes })

describe("marble document", () => {
  it("holds the extent to the content and keeps padding a producer declared", () => {
    const content = doc([lane("lane", "lane: -a-|")])
    expect(normalizeMarbleDoc(content).frames).toBe(4)
    expect(normalizeMarbleDoc({ ...content, frames: 40 }).frames).toBe(40)
  })

  it("orders notifications by frame and keeps the order they were produced in within a frame", () => {
    const scrambled = doc([
      {
        id: "lane",
        label: "lane",
        parent: null,
        notifications: [
          { kind: "next", frame: 5, value: "b" },
          { kind: "next", frame: 5, value: "a" },
          { kind: "complete", frame: 5 },
          { kind: "next", frame: 1, value: "x" },
        ],
      },
    ])
    expect(normalizeMarbleDoc(scrambled).lanes[0]?.notifications.map(it => it.value ?? it.kind)).toEqual([
      "x",
      "b",
      "a",
      "complete",
    ])
  })

  it("reports no window for a lane with no markers, and one for each subscription", () => {
    expect(listeningWindows(lane("lane", "lane: -a-|"))).toEqual([])
    expect(listeningWindows(lane("lane", "lane: -^a-!"))).toEqual([{ from: 1, to: 4 }])
    expect(listeningWindows(lane("lane", "lane: ^a"))).toEqual([{ from: 0, to: Number.POSITIVE_INFINITY }])
    // An unsubscribe with no subscription before it was listening from the start of the diagram.
    expect(listeningWindows(lane("lane", "lane: a-!"))).toEqual([{ from: 0, to: 2 }])
    expect(listeningWindows(lane("lane", "lane: ^a!^a!"))).toEqual([
      { from: 0, to: 2 },
      { from: 2, to: 4 },
    ])
  })

  it("stops walking a parent chain at a missing lane and at a cycle", () => {
    const child: MarbleLane = { id: "child", label: "child", parent: "gone", notifications: [] }
    expect(laneDepth(child, [child])).toBe(0)
    const a: MarbleLane = { id: "a", label: "a", parent: "b", notifications: [] }
    const b: MarbleLane = { id: "b", label: "b", parent: "a", notifications: [] }
    expect(laneDepth(a, [a, b])).toBe(1)
  })

  it("describes a lane that carries nothing", () => {
    expect(describeLane({ id: "empty", label: "empty", parent: null, notifications: [] })).toBe("empty: nothing")
  })
})
