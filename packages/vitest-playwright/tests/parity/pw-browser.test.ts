// pwp:pw-browser: one browser per worker, handleSIGINT:false (PW/index.js:201-238). Two files in the
// same worker under isolate:false must produce exactly one browser launch, counted by DEBUG=pw:browser
// `<launching>` lines.
import { expect, test } from "vitest"
import { countLaunches, runChild } from "./helpers.js"

test("two files in one worker share a single browser launch", async () => {
  const r = await runChild("pw-browser", { env: { DEBUG: "pw:browser" } })
  expect(r.code, r.stderr).toBe(0)
  expect(countLaunches(r)).toBe(1)
})