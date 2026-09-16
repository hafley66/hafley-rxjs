// pwp:pw-launch0: the browser fixture timeout is 0 (PW/index.js:238); this package's resource$ has
// no timeout (5_streams.ts). So a launch under testTimeout:1 still succeeds. Green pins that the
// launch is not bounded by the test timeout.
import { expect, test } from "vitest"
import { runChild } from "./helpers.js"

test("browser launch is outside the test timeout", async () => {
  const r = await runChild("pw-launch0")
  expect(r.code, r.stderr).toBe(0)
})