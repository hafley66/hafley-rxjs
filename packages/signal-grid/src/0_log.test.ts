// The sink is one module-level object, so a test that leaves it on would time every stage of every
// suite after it. `afterEach` closes it whether the expectation passed or threw.
import { afterEach, describe, expect, it } from "vitest"
import {
  disableGridLogging,
  isGridLogging,
  LOG,
  setGridLogEmit,
  type LogFields,
} from "./0_log.js"
import { flatGrid } from "./test/0_kit.js"

interface Taken {
  readonly category: readonly string[]
  readonly message: string
  readonly fields: LogFields
}

export const collect = (): Taken[] => {
  const records: Taken[] = []
  setGridLogEmit((category, message, fields) => {
    records.push({ category, message, fields })
  })
  return records
}

afterEach(() => disableGridLogging())

describe("the log surface", () => {
  it("is off until a sink is set", () => {
    expect(LOG.on).toBe(false)
    expect(isGridLogging()).toBe(false)
  })

  it("costs a call to nothing while it is off", () => {
    LOG.emit(["signal-grid", "plan"], "plan {id}", { id: "t" })
    expect(isGridLogging()).toBe(false)
  })

  it("hands a sink the category, the message and the fields", () => {
    const records = collect()
    expect(isGridLogging()).toBe(true)
    LOG.emit(["signal-grid", "plan"], "plan {id} {durationMs}ms", { id: "t", durationMs: 2 })
    expect(records).toEqual([
      {
        category: ["signal-grid", "plan"],
        message: "plan {id} {durationMs}ms",
        fields: { id: "t", durationMs: 2 },
      },
    ])
  })

  it("stops emitting once disabled", () => {
    const records = collect()
    disableGridLogging()
    expect(isGridLogging()).toBe(false)
    LOG.emit(["signal-grid", "plan"], "plan {id}", { id: "t" })
    expect(records).toHaveLength(0)
  })

  it("replaces the sink rather than fanning out to both", () => {
    const first = collect()
    const second = collect()
    LOG.emit(["signal-grid", "plan"], "plan {id}", { id: "t" })
    expect(first).toHaveLength(0)
    expect(second).toHaveLength(1)
  })
})

const named = (records: readonly Taken[], stage: string): Taken[] =>
  records.filter((record) => record.category[1] === stage)

/** Every record carries these two, which is what lets a page with two grids read one timeline. */
const stamped = (record: Taken | undefined, id: string): void => {
  expect(record?.category[0]).toBe("signal-grid")
  expect(record?.fields.id).toBe(id)
  expect(typeof record?.fields.durationMs).toBe("number")
  expect(Number.isFinite(record?.fields.durationMs as number)).toBe(true)
}

describe("the stages", () => {
  it("emits nothing while the sink is off", () => {
    const g = flatGrid()
    g.state.sort.$([{ field: "name", sort: "asc" }])
    g.view.plan.$()
    g.dispatch({ phase: "intent", type: "viewport.scroll", top: 1, left: 0 })
    const records = collect()
    expect(records).toHaveLength(0)
  })

  it("times a sort, a flatten and a plan under one grid id", () => {
    const g = flatGrid()
    g.view.plan.$()
    const records = collect()
    g.state.sort.$([{ field: "name", sort: "asc" }])
    g.view.plan.$()
    stamped(named(records, "sort")[0], "t")
    stamped(named(records, "flatten")[0], "t")
    stamped(named(records, "plan")[0], "t")
  })

  it("times a group only once the model asks for one", () => {
    const g = flatGrid()
    g.view.flat.$()
    const records = collect()
    g.view.flat.$()
    expect(named(records, "group")).toHaveLength(0)
    g.state.group.$(["name"])
    g.view.flat.$()
    const record = named(records, "group")[0]
    stamped(record, "t")
    expect(record?.fields.levels).toBe(1)
  })

  it("times one record per intent and names its type", () => {
    const g = flatGrid()
    const records = collect()
    g.dispatch({ phase: "intent", type: "viewport.scroll", top: 1, left: 0 })
    const seen = named(records, "intent")
    expect(seen).toHaveLength(1)
    stamped(seen[0], "t")
    expect(seen[0]?.fields.type).toBe("viewport.scroll")
  })

  it("keeps a change action off the intent category", () => {
    const g = flatGrid()
    const records = collect()
    g.dispatch({ phase: "change", type: "sort", sort: [{ field: "name", sort: "asc" }] })
    expect(named(records, "intent")).toHaveLength(0)
  })

  it("stops timing the stages once disabled", () => {
    const g = flatGrid()
    const records = collect()
    disableGridLogging()
    g.state.sort.$([{ field: "size", sort: "desc" }])
    g.view.plan.$()
    expect(records).toHaveLength(0)
  })
})
