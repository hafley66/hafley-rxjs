// Throwaway probe: is chrome.userScripts available here, and can it patch the page realm before page scripts?
// Distinguishes the MV3 userScripts API from declarative MAIN-world content scripts.
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import Fastify from "fastify"
import { chromium } from "playwright"

const directory = mkdtempSync(join(tmpdir(), "bewpp-usersc-"))
const extension = join(directory, "extension")
mkdirSync(extension)

writeFileSync(join(extension, "background.js"), `
globalThis.report = { api: typeof chrome.userScripts, registered: null, error: null }
const code = \`
  window.__userScriptPatched = true
  const real = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input && input.url) || String(input)
    window.__userScriptSaw = (window.__userScriptSaw || []).concat(url)
    if (url.includes("/api/mocked")) return new Response(JSON.stringify({ via: "user-script" }), { status: 200, headers: { "content-type": "application/json" } })
    return real(input, init)
  }
\`
globalThis.tryRegister = async () => {
  try {
    await chrome.userScripts.register([{ id: "probe", matches: ["http://127.0.0.1/*"], js: [{ code }], runAt: "document_start", world: "MAIN" }])
    globalThis.report.registered = true
  } catch (error) {
    globalThis.report.error = String(error?.message ?? error)
  }
  return globalThis.report
}
chrome.runtime.onInstalled.addListener(() => { void globalThis.tryRegister() })
`)

writeFileSync(join(extension, "manifest.json"), JSON.stringify({
  manifest_version: 3, name: "userscript-probe", version: "1.0",
  permissions: ["userScripts", "scripting"],
  host_permissions: ["http://127.0.0.1/*"],
  background: { service_worker: "background.js" },
  user_scripts: {},
}, null, 2))

const page = `<!doctype html><html><body><script>
  window.__early = { patched: !!window.__userScriptPatched, fetchIsNative: /\\[native code\\]/.test(String(window.fetch)) }
  window.__results = {}
  ;(async () => {
    window.__results.mocked = await (await fetch("/api/mocked")).json()
    window.__results.real = await (await fetch("/api/real")).json()
    window.__results.saw = window.__userScriptSaw || []
    window.__results.done = true
  })()
</script></body></html>`

const app = Fastify()
app.get("/page.html", (_request, reply) => reply.type("text/html").send(page))
app.get("/api/*", request => ({ real: true, path: request.url }))
const address = await app.listen({ host: "127.0.0.1", port: 0 })

const context = await chromium.launchPersistentContext(join(directory, "profile"), {
  channel: "chromium", args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
})

try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker")
  const version = await worker.evaluate(() => navigator.userAgent)
  const api = await worker.evaluate(() => ({ api: typeof chrome.userScripts, getScripts: typeof chrome.userScripts?.getScripts }))
  const registration = await worker.evaluate("tryRegister()")

  const target = await context.newPage()
  await target.goto(`${address}/page.html`)
  await target.waitForFunction("window.__results && window.__results.done", null, { timeout: 10_000 }).catch(() => {})
  const observed = await target.evaluate(() => ({ early: window.__early, results: window.__results }))

  console.log(JSON.stringify({ userAgent: version, api, registration, observed }, null, 2))
} finally {
  await context.close()
  await app.close()
}