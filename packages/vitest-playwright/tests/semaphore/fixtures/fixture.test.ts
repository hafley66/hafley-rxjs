// One child of the semaphore test. Using `page` forces the plugin to ensure the worker browser, which is
// exactly when the semaphore slot is acquired. Records launch (browser up, slot held) and close (test body
// done) as JSON-lines; the worker teardown that frees the slot follows the recorded close, so a later child
// can only launch after this child's close timestamp.
import { appendFileSync } from "node:fs"
import { test } from "../../../src/4_test.js"

const record = (event: "launch" | "close") => {
  const log = process.env.PW_SEMA_LOG!
  appendFileSync(log, `${JSON.stringify({ event, t: Date.now(), pid: process.pid })}\n`, "utf8")
}

test("holds a browser slot for the browser lifetime", async ({ page }) => {
  await page.goto("about:blank")
  record("launch")
  await new Promise(r => setTimeout(r, 1500))
  record("close")
})