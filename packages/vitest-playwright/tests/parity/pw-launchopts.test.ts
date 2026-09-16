// pwp:pw-launchopts: launch options reach the browser (PW/index.js:213). This package passes
// o.browser.launch into type.launch, so the configured arg appears on the DEBUG=pw:browser
// `<launching>` command line. Green pin.
import { expect, test } from "vitest"
import { runChild } from "./helpers.js"

test("launch options flow through to the browser", async () => {
  const r = await runChild("pw-launchopts", { env: { DEBUG: "pw:browser" } })
  expect(r.code, r.stderr).toBe(0)
  expect(`${r.stdout}\n${r.stderr}`).toMatch(/--pw-parity-launch-marker/)
})