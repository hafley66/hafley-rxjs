import { expect, it } from "vitest"
import { processMemory } from "./10_processMemory.js"
it("reads the current real process once even when its PID is repeated", async () => {
  const rows = await processMemory([process.pid, process.pid])
  expect(rows.map(row => row.pid)).toEqual([process.pid])
  expect(rows[0]!.rssBytes).toBeGreaterThan(0)
  expect(rows[0]!.rssBytes % 1024).toBe(0)
  expect(await processMemory([])).toEqual([])
  await expect(processMemory([-1])).rejects.toThrow("positive integer PIDs")
})
