import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import Fastify from "fastify"
import { chromium } from "playwright"
import { ExtensionConnection, registerExtensionBridge } from "@hafley66/bewpp"
import { buildExtension } from "@hafley66/bewpp/build"

test("standalone bewpp: authenticates, drives another extension's DOM, follows navigation and reconnects", { timeout: 60_000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), "bewpp-"))
  const connection = new ExtensionConnection()
  const token = randomUUID()
  const app = Fastify()
  registerExtensionBridge(app, { connection, token })
  app.get("/fixture", async (_request, reply) => reply.type("text/html").send(`<!doctype html>
    <label>Search<input aria-label="Search"></label><button id="replace">Replace</button><button id="mutate">Mutate state</button><output id="state"></output>
    <script>document.querySelector('#replace').onclick = () => {
      const input = document.querySelector('input'); input.replaceWith(input.cloneNode());
    };
    document.querySelector('#mutate').onclick = () => {
      localStorage.setItem('fixture-message', 'assistant complete');
      document.querySelector('#state').textContent = 'assistant complete';
      const request = indexedDB.open('fixture-db', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('messages');
      request.onsuccess = () => request.result.transaction('messages', 'readwrite').objectStore('messages').put({ role: 'assistant', text: 'complete' }, 'message-1');
    };</script>`))
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
    const rejected = []
    for (const headers of [
      { host: "127.0.0.1", origin: "chrome-extension://" + "a".repeat(32), "sec-websocket-protocol": "bewpp-wrong" },
      { host: "127.0.0.1", origin: "https://example.test", "sec-websocket-protocol": `bewpp-${token}` },
      { host: "example.test", origin: "chrome-extension://" + "a".repeat(32), "sec-websocket-protocol": `bewpp-${token}` },
    ]) rejected.push((await app.inject({ method: "GET", url: "/extension", headers })).statusCode)
    assert.deepEqual(rejected, [403, 403, 403])
    const extension = await buildExtension({ outDir: join(directory, "bewpp"), token, url: address.replace("http:", "ws:") + "/extension", matches: ["http://127.0.0.1/*"] })
    const manifest = JSON.parse(readFileSync(join(extension, "manifest.json"), "utf8"))
    assert.deepEqual({ name: manifest.name, permissions: manifest.permissions, hosts: manifest.host_permissions }, {
      name: "bewpp", permissions: ["scripting", "alarms"], hosts: ["http://127.0.0.1/*"],
    })
    const other = join(directory, "fixture-extension")
    mkdirSync(other)
    writeFileSync(join(other, "manifest.json"), JSON.stringify({
      manifest_version: 3, name: "Fixture content extension", version: "0.0.1",
      content_scripts: [{ matches: ["http://127.0.0.1/*"], js: ["content.js"] }],
    }))
    writeFileSync(join(other, "content.js"), `
      const button = document.createElement('button'); button.textContent = 'Extension action';
      const output = document.createElement('output'); output.dataset.testid = 'extension-count'; output.textContent = '0';
      button.onclick = () => { output.textContent = String(Number(output.textContent) + 1); };
      document.body.append(button, output);
    `)
    browser = await chromium.launchPersistentContext(join(directory, "profile"), {
      channel: "chromium", headless: true,
      args: [`--disable-extensions-except=${extension},${other}`, `--load-extension=${extension},${other}`],
    })
    const tab = await browser.newPage()
    await tab.goto(address + "/fixture")
    await until(() => connection.status().page_ready)
    connection.tabs = []
    connection.page = null
    await connection.refreshTabs()
    assert.deepEqual({ ready: connection.status().page_ready, urls: connection.tabs.map(tab => tab.url) }, { ready: true, urls: [address + '/fixture'] })
    const page = connection.getPage(connection.tabs[0].id)
    await page.observe({ sources: ["dom", "localStorage", "indexedDB"], selector: "#state", includeValues: true, debounceMs: 0 })
    const input = page.getByLabel("Search")
    await input.fill("before")
    await page.getByRole("button", { name: "Replace" }).click()
    await input.fill("after replacement")
    await page.getByRole("button", { name: "Extension action" }).click()
    await page.getByRole("button", { name: "Mutate state" }).click()
    await until(async () => (await page.readObservations()).events.some(event => event.source === "indexedDB"))
    const observed = await page.stopObserving()
    assert.deepEqual(observed.events.map(event => event.source).sort(), ["dom", "indexedDB", "localStorage"])
    assert.deepEqual(JSON.parse(JSON.stringify(observed.events.find(event => event.source === "localStorage"))), {
      sequence: 1, timestamp: observed.events[0].timestamp, source: "localStorage", operation: "setItem",
      key: "fixture-message", oldValue: null, newValue: "assistant complete",
    })
    assert.equal(observed.events.find(event => event.source === "dom").text, "assistant complete")
    assert.equal(observed.events.find(event => event.source === "indexedDB").value, '{"role":"assistant","text":"complete"}')
    assert.deepEqual({ value: await input.inputValue(), clicks: await page.getByTestId("extension-count").allTextContents() }, {
      value: "after replacement", clicks: ["1"],
    })
    await assert.rejects(page.goto("https://example.test/"), /site permission/)
    await page.goto(address + "/fixture?next")
    await page.waitForURL(/fixture\?next$/, { timeout: 5000 })
    await page.bringToFront()
    await page.getByRole("button", { name: "Extension action" }).click()
    const socket = connection.socket
    socket.close()
    await until(() => connection.socket && connection.socket !== socket && connection.status().page_ready)
    assert.deepEqual(await connection.getPage().getByTestId("extension-count").allTextContents(), ["1"])
    await connection.disconnect()
    assert.equal(connection.getPage(), null)
    connection.connect()
    assert.deepEqual(await connection.getPage().getByTestId("extension-count").allTextContents(), ["1"])
  } finally {
    await browser?.close()
    await connection.shutdown()
    await app.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
