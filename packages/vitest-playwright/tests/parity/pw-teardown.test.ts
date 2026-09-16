// pwp:pw-teardown: the teardown order is context.close, then afterAll, then browser.close
// (PW/worker/workerProcessEntry.js:1692-1704). Unverified until now; the receipt proves or refutes it.
import { expect, test } from "vitest"
import { readReceipt, runChild } from "./helpers.js"

test("teardown closes context before afterAll before browser", async () => {
  const r = await runChild("pw-teardown")
  const order = readReceipt<string[]>(r.dir, "order.json") ?? []
  const ci = order.indexOf("context.close")
  const ai = order.indexOf("afterAll")
  const bi = order.indexOf("browser.close")
  expect(order, `pw-teardown: order was ${order.join(", ")}`).toEqual(expect.arrayContaining(["context.close", "afterAll", "browser.close"]))
  expect(ci, `pw-teardown: context.close(${ci}) must precede afterAll(${ai})`).toBeLessThan(ai)
  expect(ai, `pw-teardown: afterAll(${ai}) must precede browser.close(${bi})`).toBeLessThan(bi)
})