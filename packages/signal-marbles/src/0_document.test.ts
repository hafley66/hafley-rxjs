import { describe, expect, it } from "vitest"
import { type MarbleDocInput, MarbleDocumentError, marbleDoc } from "./0_document.js"
import { findMarble, frameAtTick, marbleColumnCount } from "./0_types.js"

const documented: MarbleDocInput = {
  lanes: [
    {
      id: "keys",
      events: [
        { tick: 1, value: "k" },
        { after: 2, value: "k" },
        { after: 2, value: "k" },
        { after: 1, ms: 300, value: "idle" },
        { kind: "complete" },
      ],
    },
  ],
}

const writtenOut: MarbleDocInput = {
  lanes: [
    {
      id: "keys",
      events: [
        { tick: 1, value: "k" },
        { tick: 3, value: "k" },
        { tick: 5, value: "k" },
        { tick: 6, ms: 300, value: "idle" },
        { tick: 7, kind: "complete" },
      ],
    },
  ],
}

const messageOf = (input: unknown): string => {
  try {
    marbleDoc(input as MarbleDocInput)
  } catch (error) {
    if (error instanceof MarbleDocumentError) return error.message
    throw error
  }
  throw new Error(`marbleDoc accepted an authored document it should have rejected: ${JSON.stringify(input)}`)
}

describe("marbleDoc", () => {
  it("turns the documented example into the documented ticks and frames", () => {
    const doc = marbleDoc(documented)
    const notifications = doc.lanes[0]?.notifications ?? []

    expect(notifications.map(notification => notification.tick)).toEqual([1, 3, 5, 6, 7])
    expect(notifications.map(notification => frameAtTick(doc, notification.tick))).toEqual([1, 3, 5, 305, 306])
    expect(doc.columns).toEqual([0, 1, 2, 3, 4, 5, 305, 306])
    expect(marbleColumnCount(doc)).toBe(8)
    expect(notifications.map(notification => notification.id)).toEqual([
      "keys#1",
      "keys#2",
      "keys#3",
      "keys#4",
      "keys#5",
    ])
    expect(notifications.map(notification => notification.value ?? notification.kind)).toEqual([
      "k",
      "k",
      "k",
      "idle",
      "complete",
    ])
  })

  it("needs no arithmetic at the call site: after and explicit ticks agree", () => {
    const authored = marbleDoc(documented)
    const explicit = marbleDoc(writtenOut)

    expect(explicit.columns).toEqual(authored.columns)
    expect(explicit.lanes[0]?.notifications.map(notification => notification.tick)).toEqual(
      authored.lanes[0]?.notifications.map(notification => notification.tick),
    )
    expect(explicit.lanes[0]?.notifications.map(notification => notification.value ?? notification.kind)).toEqual(
      authored.lanes[0]?.notifications.map(notification => notification.value ?? notification.kind),
    )
  })

  it("keeps a lane's parent and birth, and agrees on the birth's frame", () => {
    const doc = marbleDoc({
      lanes: [
        { id: "outer", events: [{ tick: 1, value: "a" }] },
        {
          id: "inner",
          label: "inner #1",
          parent: "outer",
          born: { tick: 1, from: "outer#1", cause: "a" },
          events: [{ after: 2, value: "b" }],
        },
      ],
    })

    const outer = doc.lanes[0]
    const inner = doc.lanes[1]

    expect(outer?.parent).toBeNull()
    expect(outer?.born).toBeNull()
    expect(inner?.parent).toBe("outer")
    expect(inner?.label).toBe("inner #1")
    expect(inner?.born).toEqual({ tick: 1, from: "outer#1", cause: "a" })
    expect(frameAtTick(doc, inner?.born?.tick ?? 0)).toBe(frameAtTick(doc, 1))
    expect(frameAtTick(doc, inner?.born?.tick ?? 0)).toBe(1)
    expect(inner?.notifications.map(notification => notification.tick)).toEqual([2])
  })

  it("keeps a from that resolves, naming an event the document really has", () => {
    const doc = marbleDoc({
      lanes: [
        {
          id: "outer",
          events: [
            { tick: 1, value: "a" },
            { tick: 2, value: "b" },
          ],
        },
        {
          id: "inner",
          parent: "outer",
          born: { tick: 2, from: "outer#2" },
          events: [{ tick: 2, value: "b", from: "outer#2" }],
        },
      ],
    })

    const routed = findMarble(doc, "inner#1")
    const source = findMarble(doc, routed?.notification.from ?? "missing")

    expect(routed?.notification.from).toBe("outer#2")
    expect(source).not.toBeNull()
    expect(source?.lane.id).toBe("outer")
    expect(source?.notification.value).toBe("b")
    expect(findMarble(doc, doc.lanes[1]?.born?.from ?? "missing")).not.toBeNull()
  })

  it("rejects an authored document by throwing MarbleDocumentError", () => {
    expect(() => marbleDoc({ lanes: [] })).toThrow(MarbleDocumentError)
  })

  it("names the offending field in every rejection", () => {
    const cases: Array<{ field: string; input: unknown }> = [
      { field: "kind", input: { lanes: [{ id: "keys", events: [{ kind: "boom" }] }] } },
      { field: "noot", input: { lanes: [{ id: "keys", events: [{ value: "a", noot: "typo" }] }] } },
      { field: "events.1.tick", input: { lanes: [{ id: "keys", events: [{ tick: 5 }, { tick: 2 }] }] } },
      {
        field: "duplicate lane id",
        input: {
          lanes: [
            { id: "keys", events: [] },
            { id: "keys", events: [] },
          ],
        },
      },
      { field: "parent", input: { lanes: [{ id: "inner", parent: "ghost", events: [] }] } },
      {
        field: "from",
        input: {
          lanes: [
            { id: "outer", events: [{ tick: 1 }] },
            { id: "inner", parent: "outer", events: [{ from: "outer#9" }] },
          ],
        },
      },
      {
        field: "column 3",
        input: { msPerTick: 10, lanes: [{ id: "keys", events: [{ tick: 1 }, { tick: 3, frame: 5 }] }] },
      },
      {
        field: "pinned to both",
        input: {
          lanes: [
            { id: "first", events: [{ tick: 2, frame: 10 }] },
            { id: "second", events: [{ tick: 2, frame: 20 }] },
          ],
        },
      },
    ]

    for (const { field, input } of cases) expect(messageOf(input)).toContain(field)
  })
})
