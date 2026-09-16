// pwp:pw-debug1: a debug environment forces one worker, like PW/common/index.js:579 where debug or
// pause pins workers to 1. The child is spawned with VITEST_PLAYWRIGHT_DEBUG=1; the plugin must
// resolve workers to 1. Absent today, so this assert fails red.
import { inject } from "vitest"
import { expect, test } from "../../../../src/4_test.js"
import { KEY } from "../../../../src/0_options.js"
import { writeReceipt } from "../../helpers.js"

const o = inject(KEY.options)
writeReceipt("workers.json", { workers: o.workers })

test("debug environment forces workers=1", () => {
  expect(
    o.workers,
    `pw-debug1: VITEST_PLAYWRIGHT_DEBUG must force workers=1, resolved ${String(o.workers)}`,
  ).toBe(1)
})