// pwp:pw-noall: context/page asked for in a beforeAll hook must throw the playwright message
// "created on a per-test basis" (PW/index.js:368-375, study line 298). 4_test.ts has no such guard,
// so the child fails with the generic "no attempt root" error and this assert is red.
import { expect, test } from "vitest"
import { runChild } from "./helpers.js"

test("beforeAll with page fails with the per-test message", async () => {
  const r = await runChild("pw-noall")
  expect(r.code, "pw-noall: a beforeAll hook using page must fail the run").not.toBe(0)
  expect(
    `${r.stdout}\n${r.stderr}`,
    "pw-noall: the beforeAll failure must name the per-test basis rule",
  ).toMatch(/per-test basis/)
})
