import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import Fastify from "fastify"
import { chromium } from "playwright"
import { BrowserControlHost, ExtensionConnection, registerExtensionBridge } from "@hafley66/bewpp"
import { buildExtension } from "@hafley66/bewpp/build"

const fixture = `<!doctype html><html><head><style>
  body { margin: 0 }
  #box { width: 320px; height: 180px; background: #2277ff }
  #spacer { height: 2400px; background: #f4f4f4 }
</style></head><body><div id="box"></div><div id="spacer"></div></body></html>`

const pngSize = base64 => {
  const buffer = Buffer.from(base64, "base64")
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

test("screenshot: element clip and full page rasterize in the page realm", { timeout: 60_000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), "bewpp-shot-"))
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
      viewport: { width: 800, height: 600 },
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    })
    const tab = await browser.newPage()
    await tab.goto(address + "/fixture")
    await until(() => connection.status().page_ready)
    await connection.refreshTabs()
    const page = connection.getPage(connection.tabs[0].id)

    const element = await page.screenshot({ selector: "#box" })
    assert.equal(element.mime, "image/png")
    assert.deepEqual(pngSize(element.base64), { width: 320, height: 180 })

    const full = await page.screenshot({ fullPage: true })
    const fullSize = pngSize(full.base64)
    assert.equal(fullSize.width, 800)
    assert.ok(fullSize.height >= 2400, `full page height was ${fullSize.height}`)

    const jpeg = await page.screenshot({ selector: "#box", format: "jpeg" })
    assert.equal(jpeg.mime, "image/jpeg")

    await assert.rejects(page.screenshot({ selector: "#missing" }), /selector did not match/)

    // The host path routes page-level operations too, not only DOM commands.
    const host = new BrowserControlHost(connection)
    const throughHost = await host.execute({ op: "screenshot", tabId: connection.tabs[0].id, fullPage: false })
    assert.equal(throughHost.mime, "image/png")
    assert.deepEqual(pngSize(throughHost.base64).width, 800)
  } finally {
    await browser?.close()
    await connection.shutdown()
    await app.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
