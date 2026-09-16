// Throwaway probe: does a MAIN-world document_start content script inherit page CSP?
// Decides whether the selector engine can be eval'd on demand or must ship as a registered file.
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import Fastify from "fastify"
import { chromium } from "playwright"

const directory = mkdtempSync(join(tmpdir(), "bewpp-csp-"))
const extension = join(directory, "extension")
mkdirSync(extension)

writeFileSync(join(extension, "probe.js"), `
globalThis.__csp = { ran: true, errors: [] }
try { globalThis.__csp.evalResult = eval("1 + 1") } catch (error) { globalThis.__csp.errors.push("eval: " + error.name) }
try { globalThis.__csp.functionResult = new Function("return 2 + 2")() } catch (error) { globalThis.__csp.errors.push("new Function: " + error.name) }
try { const element = document.createElement("script"); element.textContent = "globalThis.__csp.inline = true"; document.documentElement.appendChild(element) } catch (error) { globalThis.__csp.errors.push("inline script: " + error.name) }
`)

writeFileSync(join(extension, "manifest.json"), JSON.stringify({
  manifest_version: 3, name: "csp-probe", version: "1.0",
  host_permissions: ["http://127.0.0.1/*"],
  content_scripts: [{ matches: ["http://127.0.0.1/*"], js: ["probe.js"], run_at: "document_start", world: "MAIN" }],
}, null, 2))

const strict = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="script-src 'self'"></head>
<body><script src="/app.js"></script></body></html>`
const relaxed = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="script-src 'self' 'unsafe-eval'"></head>
<body><script src="/app.js"></script></body></html>`
const bare = `<!doctype html><html><body><script src="/app.js"></script></body></html>`

const app = Fastify()
app.get("/app.js", (_request, reply) => reply.type("text/javascript").send("window.__appRan = true"))
app.get("/strict.html", (_request, reply) => reply.type("text/html").send(strict))
app.get("/relaxed.html", (_request, reply) => reply.type("text/html").send(relaxed))
app.get("/bare.html", (_request, reply) => reply.type("text/html").send(bare))
const address = await app.listen({ host: "127.0.0.1", port: 0 })

const context = await chromium.launchPersistentContext(join(directory, "profile"), {
  channel: "chromium", args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
})

try {
  const results = {}
  for (const name of ["strict", "relaxed", "bare"]) {
    const page = await context.newPage()
    await page.goto(`${address}/${name}.html`)
    results[name] = await page.evaluate(() => globalThis.__csp ?? "MAIN-world script did not run")
    await page.close()
  }
  console.log(JSON.stringify(results, null, 2))
} finally {
  await context.close()
  await app.close()
}