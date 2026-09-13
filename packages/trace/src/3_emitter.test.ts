import { describe, expect, it, vi } from "vitest"
import { emitter, setEmit, stamped } from "./3_emitter.js"
import type { LogFields } from "./0_types.js"

describe("emitter", () => {
  it("starts off, and off means one boolean read", () => {
    const log = emitter("probe")
    expect(log.on).toBe(false)
    log.emit(["probe", "x"], "ignored", {})
  })

  it("turns on and off with the sink", () => {
    const log = emitter("probe")
    const sink = vi.fn()
    setEmit(log, sink)
    expect(log.on).toBe(true)
    log.emit(["probe", "x"], "hello {n}", { n: 1 })
    expect(sink).toHaveBeenCalledWith(["probe", "x"], "hello {n}", { n: 1 })
    setEmit(log, null)
    expect(log.on).toBe(false)
    log.emit(["probe", "x"], "dropped", {})
    expect(sink).toHaveBeenCalledTimes(1)
  })

  it("stamps identity onto every record", () => {
    const seen: LogFields[] = []
    const wrapped = stamped((_c, _m, fields) => seen.push(fields), { service: "grid", pid: "42", parent: "17" })
    wrapped(["grid", "dom"], "wrote {rows}", { rows: 33 })
    expect(seen[0]).toMatchObject({ rows: 33, pid: "42", parent: "17", service: "grid" })
  })
})
