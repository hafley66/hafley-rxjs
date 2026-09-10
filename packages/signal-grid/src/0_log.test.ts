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
