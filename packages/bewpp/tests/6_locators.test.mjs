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

const engineFixture = `<!doctype html><html><body>
<button id="save">Save</button><button id="cancel" aria-label="Cancel">Discard</button>
<label for="agree">Agree</label><input id="agree" type="checkbox">
<input id="search" placeholder="Search the catalog">
<output id="pressed" data-testid="pressed"></output>
<ul><li class="row">first row</li><li class="row">second row</li><li class="row">third row</li></ul>
<div id="group" role="group"><button id="inner">Inner</button></div>
<div id="secret" style="display:none">Hidden</div>
<script>
  for (const id of ["save", "cancel", "inner"])
    document.getElementById(id).addEventListener("click", event => { document.getElementById("pressed").textContent = event.currentTarget.id })
  setTimeout(() => { const late = document.createElement("button"); late.id = "late"; late.textContent = "Late"; document.body.append(late) }, 300)
</script></body></html>`

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
    // The engine ships inside the extension, so every permitted page can resolve Playwright selectors.
    assert.equal((await page.resolveSelector("css=body")).count, 1)

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

test(
  "engine-backed locators: queries resolve through Playwright's own selector engine",
  { timeout: 60_000 },
  async () => {
    const directory = mkdtempSync(join(tmpdir(), "bewpp-engine-locators-"))
    const connection = new ExtensionConnection()
    const token = randomUUID()
    const app = Fastify()
    registerExtensionBridge(app, { connection, token })
    app.get("/fixture", (_request, reply) => reply.type("text/html").send(engineFixture))
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

      // Role and name come from Playwright's engine, not from Testing Library: a lowercase substring of
      // the accessible name matches, and an aria-label beats the element's text.
      await page.getByRole("button", { name: "save" }).click()
      assert.equal(await page.getByTestId("pressed").textContent(), "save")
      assert.equal(await page.getByRole("button", { name: "Cancel" }).textContent(), "Discard")

      // Label, placeholder, and state reads address the elements the engine tagged for the operation.
      await page.getByLabel("Agree").click()
      assert.equal(await page.getByLabel("Agree").isChecked(), true)
      await page.getByPlaceholder("catalog").fill("kettles")
      assert.equal(await page.getByPlaceholder("Search the catalog").inputValue(), "kettles")

      // nth/first/last compose into the selector; multi-element reads resolve loosely.
      assert.equal(await page.locator(".row").count(), 3)
      assert.deepEqual(await page.locator(".row").allTextContents(), ["first row", "second row", "third row"])
      // Playwright's text pseudo-classes, which the browser's own querySelectorAll rejects.
      assert.equal(await page.locator('li.row:has-text("second")').count(), 1)
      assert.equal(await page.locator(':text-matches("th(ird|ree)", "i")').count(), 1)
      assert.equal(await page.locator(".row").first().textContent(), "first row")
      assert.equal(await page.locator(".row").last().textContent(), "third row")
      assert.equal(await page.locator(".row").nth(1).textContent(), "second row")
      assert.equal(await page.locator(".row").filter({ visible: true }).count(), 3)
      assert.equal(await page.locator("div").filter({ has: page.locator("#inner") }).count(), 1)
      assert.equal(await page.locator("div").filter({ has: page.locator("#save") }).count(), 0)
      assert.equal(await page.locator("#group").getByRole("button").count(), 1)
      assert.equal(await page.locator("#secret").isVisible(), false)
      assert.equal(await page.getByRole("button", { name: "Cancel" }).isVisible(), true)
      assert.equal(await page.locator("#missing").isVisible({ timeout: 200 }), false)

      // Single-element reads and actions are strict, and the violation is the engine's own text.
      await assert.rejects(page.locator(".row").textContent(), /strict mode violation[\s\S]*resolved to 3 elements/)
      await assert.rejects(page.locator(".row").click(), /strict mode violation/)
      await assert.rejects(page.locator("#missing").textContent({ timeout: 400 }), /Expected one element; found 0/)

      // Waiting resolves again on every poll, so an element the document adds later is found.
      await page.locator("#late").waitFor({ state: "visible" })
      assert.equal(await page.locator("#late").textContent(), "Late")
      await assert.rejects(page.locator("#late").waitFor({ state: "detached", timeout: 300 }), /Timed out waiting/)
      await page.locator("#cancel").waitFor({ state: "attached" })

      // Declared-narrow Playwright options fail loudly instead of changing the action's meaning.
      await assert.rejects(page.locator("#cancel").click({ trial: true }), /trial is unsupported/)
      await assert.rejects(page.locator("#cancel").click({ position: { x: 1, y: 1 } }), /position is unsupported/)

      // Every operation resolves again, so the same locator works across a navigation.
      await page.goto(address + "/fixture?again")
      await until(async () => (await page.resolveSelector("role=button").catch(() => ({ count: 0 }))).count === 4)
      await page.getByRole("button", { name: "save" }).click()
      assert.equal(await page.getByTestId("pressed").textContent(), "save")
    } finally {
      await browser?.close()
      await connection.shutdown()
      await app.close()
      rmSync(directory, { recursive: true, force: true })
    }
  },
)

test(
  "background mode drives an inactive tab without RAF or focus changes",
  { timeout: 60_000 },
  async () => {
    const directory = mkdtempSync(join(tmpdir(), "bewpp-background-"))
    const connection = new ExtensionConnection()
    const token = randomUUID()
    const app = Fastify()
    registerExtensionBridge(app, { connection, token })
    app.get("/background", (_request, reply) => reply.type("text/html").send(`<!doctype html><body>
      <input id="entry" aria-label="Entry"><button id="run">Run</button>
      <button id="submit" type="submit">Submit</button><button id="disabled" disabled>Disabled</button>
      <output id="result"></output><div id="secret" hidden data-kind="hidden">attached hidden</div>
      <ul><li class="row">zero</li><li class="row">one</li><li class="row">two</li></ul>
      <script>
        window.requestAnimationFrame = () => 0;
        document.querySelector('#run').onclick = () => document.querySelector('#result').textContent = document.querySelector('#entry').value;
        document.querySelector('#entry').addEventListener('keydown', event => { if (event.key === 'Enter') document.querySelector('#result').textContent = 'entered'; });
        const host = document.createElement('div'); host.id = 'shadow-host'; const root = host.attachShadow({mode:'open'});
        const button = document.createElement('button'); button.textContent = 'Shadow'; button.onclick = () => document.querySelector('#result').textContent = 'shadow'; root.append(button); document.body.append(host);
      </script></body>`))
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
      const foreground = await browser.newPage()
      await foreground.goto(address + "/background?foreground")
      const target = await browser.newPage()
      await target.goto(address + "/background?target")
      await foreground.bringToFront()
      await until(() => connection.tabs.length === 2 && connection.tabs.some(tab => tab.active))
      await connection.refreshTabs()
      const targetTab = connection.tabs.find(tab => tab.url.endsWith("background?target"))
      assert.ok(targetTab)
      assert.equal(targetTab.active, false)
      const page = connection.getPage(targetTab.id)
      const background = page.background()

      // The target stays inactive while fill, Enter, click, and wait run through host-timed polling.
      await background.getByLabel("Entry").fill("background value")
      await background.getByLabel("Entry").press("Enter")
      await background.getByRole("button", { name: "Run" }).click()
      await background.locator("#result").waitFor({ state: "visible", timeout: 2_000 })
      assert.equal(await background.locator("#result").textContent(), "background value")
      assert.equal(connection.tabs.find(tab => tab.id === targetTab.id)?.active, false)

      // Attached hidden reads, open-shadow marker actions, and chained positional selectors.
      assert.equal(await background.locator("#secret").textContent(), "attached hidden")
      assert.equal(await background.locator("#secret").getAttribute("data-kind"), "hidden")
      await assert.rejects(background.locator(".row").nth(1).nth(1).textContent(), /Expected one element; found 0/)
      await background.getByRole("button", { name: "Shadow" }).click()
      assert.equal(await background.locator("#result").textContent(), "shadow")

      await assert.rejects(background.locator("#disabled").click(), /disabled/)
      await assert.rejects(background.locator("#submit").click(), /allowSubmit/)
      await background.locator("#submit").click({ allowSubmit: true })
    } finally {
      await browser?.close()
      await connection.shutdown()
      await app.close()
      rmSync(directory, { recursive: true, force: true })
    }
  },
)
