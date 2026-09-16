import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import Fastify from "fastify"
import { chromium } from "playwright"
import { ClickLog, ExtensionConnection, registerExtensionBridge } from "@hafley66/bewpp"
import { buildExtension } from "@hafley66/bewpp/build"

const enginePath = [
  process.env.BEWPP_ENGINE_SOURCE,
  join(process.env.HOME ?? "", "projects/lol/playwright-local/packages/injected/lib/injectedScript.js"),
]
  .filter(Boolean)
  .find(path => existsSync(path))

const fixture = `<!doctype html><html><body>
<button id="checkout" aria-label="Checkout">Checkout</button>
<button id="apply">Apply promo</button>
<output id="pressed" data-testid="pressed"></output>
<script>
  for (const id of ["checkout", "apply"])
    document.getElementById(id).addEventListener("click", event => { document.getElementById("pressed").textContent = event.currentTarget.id })
</script></body></html>`

test("click recording: clicks come back with Playwright selectors, persist to sqlite, and read back", { timeout: 60_000, skip: enginePath ? false : "no injected script: set BEWPP_ENGINE_SOURCE" }, async () => {
  const directory = mkdtempSync(join(tmpdir(), "bewpp-clicks-"))
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
    const extension = await buildExtension({
      outDir: join(directory, "bewpp"),
      token,
      url: address.replace("http:", "ws:") + "/extension",
      matches: ["http://127.0.0.1/*"],
    })
    browser = await chromium.launchPersistentContext(join(directory, "profile"), {
      channel: "chromium",
      headless: true,
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    })
    const tab = await browser.newPage()
    await tab.goto(address + "/fixture")
    await until(() => connection.status().page_ready)
    await connection.refreshTabs()
    const page = connection.getPage(connection.tabs[0].id)
    const url = page.url()

    // The recorder prefers the engine's own selector generator; without it only the CSS candidates remain.
    await page.installSelectorEngine(readFileSync(enginePath, "utf8"))
    await page.observe({ sources: ["click"], debounceMs: 0 })
    await page.getByRole("button", { name: "Checkout" }).click()
    await page.getByRole("button", { name: "Apply promo" }).click()
    await until(async () => (await page.readObservations()).events.length >= 2)
    const batch = await page.stopObserving()
    const clicks = batch.events.filter(event => event.source === "click")
    assert.equal(clicks.length, 2)
    const [checkout, apply] = clicks
    assert.equal(checkout.text, "Checkout")
    assert.match(String(checkout.playwrightSelector), /button/)
    assert.ok(checkout.candidates.includes("#checkout"), `expected #checkout in ${JSON.stringify(checkout.candidates)}`)
    assert.deepEqual({ ...checkout.path[0] }, { tag: "button", role: null, name: "Checkout", id: "checkout" })
    assert.deepEqual(checkout.path.at(-1)?.tag, "html")
    assert.equal(apply.text, "Apply promo")

    const log = new ClickLog({ path: join(directory, "clicks.sqlite") })
    try {
      assert.equal(log.record(clicks, { url }), 2)
      assert.equal(log.record([{ ...clicks[0], source: "dom" }]), 0)
      const recent = log.recent(1)
      assert.equal(recent.length, 1)
      assert.equal(recent[0].text, "Apply promo")
      assert.equal(recent[0].url, url)
      assert.ok(recent[0].candidates.includes("#apply"))
      const oldestFirst = log.recent(5, { oldestFirst: true }).map(record => record.text)
      assert.deepEqual(oldestFirst.slice(-2), ["Checkout", "Apply promo"])
    } finally {
      log.unsubscribe()
    }
  } finally {
    await browser?.close()
    await connection.shutdown()
    await app.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
