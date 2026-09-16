import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import Fastify from "fastify"
import { chromium } from "playwright"
import { ExtensionConnection, registerExtensionBridge } from "@hafley66/bewpp"
import { buildExtension } from "@hafley66/bewpp/build"

const fixture = `<!doctype html><html><body>
<ul><li class="row">first row</li><li class="row">second row</li><li class="row">third row</li></ul>
<label for="agree">Agree</label><input id="agree" type="checkbox">
<a id="docs" href="/docs" data-kind="reference">Docs</a>
</body></html>`

test("locator surface: first, last, textContent, getAttribute, isChecked", { timeout: 60_000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), "bewpp-locators-"))
  const connection = new ExtensionConnection()
  const token = randomUUID()
  const app = Fastify()
  registerExtensionBridge(app, { connection, token })
  app.get("/fixture", (_request, reply) => reply.type("text/html").send(fixture))
  const address = await app.listen({ host: "127.0.0.1", port: 0 })
  let browser
  const until = async predicate => {
    for (let index = 0; index < 100; index++) {
      if (await predicate()) return
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error("Timed out waiting for extension state.")
  }
  try {
    const extension = await buildExtension({ outDir: join(directory, "bewpp"), token, url: address.replace("http:", "ws:") + "/extension", matches: ["http://127.0.0.1/*"] })
    browser = await chromium.launchPersistentContext(join(directory, "profile"), {
      channel: "chromium", headless: true,
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    })
    const tab = await browser.newPage()
    await tab.goto(address + "/fixture")
    await until(() => connection.status().page_ready)
    await connection.refreshTabs()
    const page = connection.getPage(connection.tabs[0].id)

    const rows = page.locator(".row")
    assert.equal(await rows.count(), 3)
    assert.equal(await rows.first().textContent(), "first row")
    assert.equal(await rows.last().textContent(), "third row")
    assert.equal(await rows.nth(1).textContent(), "second row")
    assert.equal(await rows.first().getAttribute("class"), "row")
    assert.equal(await page.locator("#docs").getAttribute("href"), "/docs")
    assert.equal(await page.locator("#docs").getAttribute("data-kind"), "reference")
    // Absent targets wait and then throw, matching the strict single-element contract.
    await assert.rejects(page.locator("#missing").getAttribute("href"), /Expected one element; found 0/)
    assert.equal(await page.locator("#agree").isChecked(), false)
    await page.locator("#agree").click()
    assert.equal(await page.locator("#agree").isChecked(), true)
  } finally {
    await browser?.close()
    await connection.shutdown()
    await app.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
