import { describe, expect, it } from "vitest"
import {
  AXIS_MAX_PITCH,
  AXIS_PITCH,
  describeLane,
  describeMarbleDoc,
  findMarble,
  frameAtTick,
  laneDepth,
  listeningWindows,
  MARBLES_VERSION,
  type MarbleBirth,
  type MarbleDoc,
  type MarbleKind,
  type MarbleLane,
  type MarbleNotification,
  marbleAxis,
  marbleChain,
  marbleColumnCount,
  marbleEdges,
  normalizeMarbleDoc,
} from "./0_types.js"

const event = (
  id: string,
  kind: MarbleKind,
  tick: number,
  extra: { value?: string; note?: string; from?: string } = {},
): MarbleNotification => ({ id, kind, tick, ...extra })

const lane = (
  id: string,
  notifications: MarbleNotification[] = [],
  options: { label?: string; parent?: string | null; born?: MarbleBirth | null } = {},
): MarbleLane => ({
  id,
  label: options.label ?? id,
  parent: options.parent ?? null,
  born: options.born ?? null,
  notifications,
})

const doc = (columns: number[], lanes: MarbleLane[] = []): MarbleDoc => ({
  version: MARBLES_VERSION,
  columns,
  lanes,
})

describe("the two-number document", () => {
  it("keeps two ticks that share a frame as two columns at the same millisecond", () => {
    const shared = doc(
      [0, 5, 5, 12],
      [
        lane("keys", [
          event("keys#1", "next", 1, { value: "a" }),
          event("keys#2", "next", 2, { value: "b" }),
          event("keys#3", "complete", 3),
        ]),
      ],
    )

    expect(shared.columns).toEqual([0, 5, 5, 12])
    expect(marbleColumnCount(shared)).toBe(4)
    expect(frameAtTick(shared, 1)).toBe(5)
    expect(frameAtTick(shared, 2)).toBe(5)
    expect(frameAtTick(shared, 1)).toBe(frameAtTick(shared, 2))
    expect(frameAtTick(shared, 3)).toBe(12)
  })
})

describe("the axis", () => {
  it("gives equal gaps equal pitch", () => {
    const axis = marbleAxis(doc([0, 10, 20, 30]))

    expect(axis.unitMs).toBe(10)
    expect(axis.columns.map(column => column.pitch)).toEqual([null, AXIS_PITCH, AXIS_PITCH, AXIS_PITCH])
    expect(axis.columns.map(column => column.frame)).toEqual([0, 10, 20, 30])
  })

  it("draws a gap past the max pitch at the cap and carries the milliseconds it refused to draw", () => {
    const axis = marbleAxis(doc([0, 1, 1001]))

    expect(axis.unitMs).toBe(1)
    expect(axis.columns[1]?.pitch).toBe(AXIS_PITCH)
    expect(axis.columns[1]?.compressedMs).toBeNull()
    expect(axis.columns[2]?.pitch).toBe(AXIS_MAX_PITCH)
    expect(axis.columns[2]?.compressedMs).toBe(1000)
  })

  it("uses the floor pitch and claims no break when every gap is zero", () => {
    const axis = marbleAxis(doc([7, 7, 7]))

    expect(axis.unitMs).toBe(1)
    expect(axis.columns.map(column => column.pitch)).toEqual([null, AXIS_PITCH, AXIS_PITCH])
    expect(axis.columns.map(column => column.compressedMs)).toEqual([null, null, null])
  })

  it("takes the smallest positive gap as the unit, and 1 when there is none", () => {
    expect(marbleAxis(doc([0, 4, 10, 20])).unitMs).toBe(4)
    expect(marbleAxis(doc([3, 3])).unitMs).toBe(1)
    expect(marbleAxis(doc([3, 3, 3])).unitMs).toBe(1)
  })

  it("sizes the strip to cover the last column", () => {
    const axis = marbleAxis(doc([0, 10, 20, 300]))
    const last = axis.columns[axis.columns.length - 1]

    expect(last?.tick).toBe(3)
    expect(last?.frame).toBe(300)
    expect(axis.width).toBeGreaterThan(last?.x ?? 0)
    expect(axis.width).toBeGreaterThanOrEqual((last?.x ?? 0) + AXIS_PITCH)
  })
})

describe("edges and lookup", () => {
  it("states an edge for every notification from and every lane born from, and none otherwise", () => {
    const wired = doc(
      [0, 1, 2, 3],
      [
        lane("outer", [event("outer#1", "next", 0, { value: "a" }), event("outer#2", "next", 1, { value: "b" })]),
        lane("inner", [event("inner#1", "next", 2, { value: "b", from: "outer#2" })], {
          label: "inner #1",
          parent: "outer",
          born: { tick: 1, from: "outer#1" },
        }),
      ],
    )

    expect(marbleEdges(wired)).toEqual([
      { from: "outer#1", to: "inner", kind: "born", label: "inner #1" },
      { from: "outer#2", to: "inner#1", kind: "value", label: "inner #1" },
    ])

    const stated = doc([0, 1], [lane("keys", [event("keys#1", "next", 1, { value: "a" })])])
    expect(marbleEdges(stated)).toEqual([])
  })

  it("finds an event by id and nothing for an unknown id", () => {
    const found = doc(
      [0, 1, 2],
      [lane("keys", [event("keys#1", "next", 1, { value: "a" }), event("keys#2", "complete", 2)])],
    )

    expect(findMarble(found, "keys#2")?.lane.id).toBe("keys")
    expect(findMarble(found, "keys#2")?.notification.kind).toBe("complete")
    expect(findMarble(found, "keys#2")?.index).toBe(1)
    expect(findMarble(found, "keys#9")).toBeNull()
  })

  it("walks from backwards through a two-hop chain", () => {
    const chained = doc(
      [0, 1, 2, 3],
      [
        lane("source", [event("source#1", "next", 1, { value: "a" })]),
        lane("mid", [event("mid#1", "next", 2, { value: "a", from: "source#1" })]),
        lane("inner", [event("inner#1", "next", 3, { value: "a", from: "mid#1" })]),
      ],
    )

    expect(marbleChain(chained, "inner#1")).toEqual(["source#1", "mid#1", "inner#1"])
  })
})

describe("normalization", () => {
  it("sorts a lane by tick while keeping its ids and the order of ties", () => {
    const scrambled = doc(
      [0, 1, 2, 3],
      [
        lane("keys", [
          event("keys#1", "next", 2, { value: "c" }),
          event("keys#2", "next", 1, { value: "a" }),
          event("keys#3", "next", 2, { value: "d" }),
        ]),
      ],
    )

    const sorted = normalizeMarbleDoc(scrambled).lanes[0]

    expect(sorted?.notifications.map(notification => notification.id)).toEqual(["keys#2", "keys#1", "keys#3"])
    expect(sorted?.notifications.map(notification => notification.value)).toEqual(["a", "c", "d"])
  })

  it("extends the columns for an event that claims a tick past them instead of rejecting it", () => {
    const short = doc([0, 5], [lane("keys", [event("keys#1", "next", 4, { value: "a" })])])

    const extended = normalizeMarbleDoc(short)

    expect(extended.columns).toEqual([0, 5, 5, 5, 5])
    expect(frameAtTick(extended, 4)).toBe(5)
    expect(short.columns).toEqual([0, 5])
  })
})

describe("lane relations", () => {
  it("follows parent for depth and stops on a missing parent or a cycle", () => {
    const root = lane("root")
    const mid = lane("mid", [], { parent: "root" })
    const leaf = lane("leaf", [], { parent: "mid" })
    const orphan = lane("orphan", [], { parent: "ghost" })
    const lanes = [root, mid, leaf, orphan]

    expect(laneDepth(root, lanes)).toBe(0)
    expect(laneDepth(mid, lanes)).toBe(1)
    expect(laneDepth(leaf, lanes)).toBe(2)
    expect(laneDepth(orphan, lanes)).toBe(0)

    const a = lane("a", [], { parent: "b" })
    const b = lane("b", [], { parent: "a" })
    expect(laneDepth(a, [a, b])).toBe(1)
  })

  it("reports the tick window each subscription covers, including one still listening at the end", () => {
    const twice = lane("keys", [
      event("keys#1", "subscribe", 1),
      event("keys#2", "next", 2, { value: "a" }),
      event("keys#3", "unsubscribe", 4),
      event("keys#4", "subscribe", 5),
      event("keys#5", "next", 6, { value: "b" }),
    ])

    expect(listeningWindows(twice)).toEqual([
      { from: 1, to: 4 },
      { from: 5, to: Number.POSITIVE_INFINITY },
    ])

    expect(listeningWindows(lane("keys", [event("keys#1", "next", 1, { value: "a" })]))).toEqual([])
  })
})

describe("the text forms", () => {
  const described = doc(
    [0, 5, 5],
    [lane("keys", [event("keys#1", "next", 1, { value: "a" }), event("keys#2", "complete", 2)])],
  )

  it("describes a lane in ticks", () => {
    const text = describeLane(described.lanes[0], described)

    expect(text).toContain("tick 1")
    expect(text).toContain("tick 2")
    expect(text).not.toContain("frame")
  })

  it("describes a document in ticks", () => {
    const text = describeMarbleDoc(described)

    expect(text).toContain("keys")
    expect(text).toContain("tick 1")
    expect(text).toContain("tick 2")
    expect(text).not.toContain("frame")
  })
})
