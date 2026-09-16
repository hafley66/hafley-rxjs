import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import Fastify from "fastify"
import { chromium } from "playwright"
import { ExtensionConnection, registerExtensionBridge } from "@hafley66/bewpp"
import { buildExtension } from "@hafley66/bewpp/build"

const engineCandidates = [
  process.env.BEWPP_ENGINE_SOURCE,
  join(process.env.HOME ?? "", "projects/lol/playwright-local/packages/injected/lib/injectedScript.js"),
].filter(Boolean)
const enginePath = engineCandidates.find(path => existsSync(path))

const fixture = `<!doctype html><html><body>
<button id="save">Save</button><button id="cancel">Cancel</button>
<div id="copy">Save the world</div><div id="secret" style="display:none">Hidden</div>
<output id="pressed" data-testid="pressed"></output>
<script>
  document.querySelector("#save").addEventListener("click", () => { document.querySelector("#pressed").textContent = "save" })
  document.querySelector("#cancel").addEventListener("click", () => { document.querySelector("#pressed").textContent = "cancel" })
</script></body></html>`

test(
  "selector engine: the extension installs Playwright's engine in the page realm and resolves its selectors",
  { timeout: 60_000, skip: enginePath ? false : "no injected script: run `node utils/generate_injected.js` in a playwright checkout and set BEWPP_ENGINE_SOURCE" },
  async () => {
    const source = readFileSync(enginePath, "utf8")
    const directory = mkdtempSync(join(tmpdir(), "bewpp-engine-"))
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
      const manifest = JSON.parse(readFileSync(join(extension, "manifest.json"), "utf8"))
      assert.deepEqual(manifest.permissions, ["scripting", "alarms", "webNavigation"])

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

      assert.equal((await page.installSelectorEngine(source)).installed, true)
      assert.equal((await page.installSelectorEngine(source)).installed, false)

      const unique = await page.resolveSelector('role=button[name="Save"]')
      assert.equal(unique.count, 1)
      // The engine's marker is what the content-script action path addresses.
      await page.locator(`[data-bewpp-hit="${unique.marker}-0"]`).click()
      assert.deepEqual(await page.getByTestId("pressed").allTextContents(), ["save"])

      const all = await page.resolveSelector("role=button")
      assert.equal(all.count, 2)
      assert.notEqual(all.marker, unique.marker)

      // Visibility filtering is the engine's, not ours: the display:none div is excluded.
      assert.equal((await page.resolveSelector("div:visible")).count, 1)

      await assert.rejects(page.resolveSelector("role=button", { strict: true }), /resolved to 2 elements/)

      await page.goto(address + "/fixture?again")
      await until(async () => (await page.resolveSelector("role=button")).count === 2)
      assert.deepEqual(await page.resolveSelector("role=button").then(result => result.count), 2)
    } finally {
      await browser?.close()
      await connection.shutdown()
      await app.close()
      rmSync(directory, { recursive: true, force: true })
    }
  },
)
