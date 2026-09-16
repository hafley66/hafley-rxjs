// pkg:prove: the serve slot must not outlive a run that failed to start. `resource$` reports an `open()`
// rejection and never reaches its close half, and the command is spawned detached in its own process
// group, so a server that never answers is the plugin's to kill or it outlives every signal the run sends.
import { existsSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import globalSetup from "../src/2_global-setup.js"

const alive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

describe("serve teardown", () => {
  it("kills a command that never answers instead of orphaning it", async () => {
    const pidFile = join(tmpdir(), `pw-serve-teardown-${process.pid}.pid`)
    rmSync(pidFile, { force: true })
    // The child's own 15s lifetime is the subject, not a wait: the leak is that it outlives the run that
    // spawned it, and it would exit on its own long after this test is finished.
    process.env.VITEST_PLAYWRIGHT_SERVE = JSON.stringify({
      kind: "command",
      command: `node -e "require('fs').writeFileSync('${pidFile}', String(process.pid)); setTimeout(() => {}, 15000)"`,
      url: "http://127.0.0.1:9/never",
      readyTimeoutMs: 1500,
    })
    try {
      await expect(globalSetup({ provide() {} })).rejects.toThrow(/did not answer/)
    } finally {
      delete process.env.VITEST_PLAYWRIGHT_SERVE
    }
    expect(existsSync(pidFile)).toBe(true)
    const pid = Number(readFileSync(pidFile, "utf8"))
    await expect.poll(() => alive(pid), { timeout: 5000 }).toBe(false)
  })
})
