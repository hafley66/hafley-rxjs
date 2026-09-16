// pwp:pw-teardown: teardown runs test scope, then afterAll, then worker scope, matching
// PW/worker/workerProcessEntry.js:268-284,1692-1704. The child appends context.close, afterAll and
// browser.close to a receipt as they happen; the parent reads the order.
import { afterAll } from "vitest"
import { test } from "../../../../src/4_test.js"
import { writeReceipt } from "../../helpers.js"

const order: string[] = []
function log(name: string): void {
  order.push(name)
  writeReceipt("order.json", order)
}

afterAll(() => log("afterAll"))

test("teardown order is recorded", async ({ browser, context }) => {
  context.on("close", () => log("context.close"))
  browser.on("disconnected", () => log("browser.close"))
  await context.newPage()
})
