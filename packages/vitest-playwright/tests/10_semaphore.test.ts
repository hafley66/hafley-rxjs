// pkg:prove: a worker that finds every browser slot held must fail, not wait forever. A parked worker
// holds its run open, and with it the machine-wide queue lock every other lane is waiting on, so an
// unbounded slot wait is how one wedged holder stops the machine while nothing looks busy.
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { acquireSlot } from "../src/13_semaphore.js"

describe("browser slots", () => {
  it("fails on the deadline while every slot is held, and takes the slot once it frees", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pw-sema-"))
    const held = await acquireSlot({ slots: 1, dir, staleMs: 60_000, timeoutMs: 1000 })
    expect(held.index).toBe(0)
    await expect(acquireSlot({ slots: 1, dir, staleMs: 60_000, timeoutMs: 400 })).rejects.toThrow(
      /no browser slot free/,
    )
    await held.release()
    const again = await acquireSlot({ slots: 1, dir, staleMs: 60_000, timeoutMs: 1000 })
    expect(again.index).toBe(0)
    await again.release()
  })
})
