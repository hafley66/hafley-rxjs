// pwp:pw-failkill: a failed test must stop the worker so the next file gets a fresh browser
// (PW/runner/index.js:5293-5296). File A fails and file B runs in the same worker; a fresh browser
// after the failure shows up as a second DEBUG=pw:browser `<launching>` line. Today the runner has no
// failure recycle, so both files share one launch and this is red.
import { expect, test } from "vitest"
import { countLaunches, runChild } from "./helpers.js"

test("a failed test launches a fresh browser for the next file", async () => {
  const r = await runChild("pw-failkill", { env: { DEBUG: "pw:browser" } })
  const launches = countLaunches(r)
  expect(launches, `pw-failkill: expected a second browser launch after the failure, saw ${launches}`).toBe(2)
})