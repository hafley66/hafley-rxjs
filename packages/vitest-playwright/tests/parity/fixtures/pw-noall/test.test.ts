// pwp:pw-noall: using context/page in a beforeAll hook must throw (PW/index.js:368-375). This package
// has no guard, so the page fixture fails with a different "no attempt root" error. The parent asserts
// the missing "per-test basis" message, so this row is red today.
import { beforeAll } from "vitest"
import { expect, test } from "../../../../src/4_test.js"
import type { Page } from "playwright"

beforeAll(async ({ page }: { page: Page }) => {
  await page.goto("about:blank")
})

test("unreachable placeholder", () => {
  expect(true).toBe(true)
})