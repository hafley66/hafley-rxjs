// Throwaway probe: does Playwright's own injected script work when a MAIN-world content script delivers it?
// If yes, locator resolution can be Playwright's own selector semantics without chrome.debugger.
// If no, the failure tells us exactly which CDP binding the injected script depends on.
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import Fastify from "fastify"
import { chromium } from "playwright"

const BUNDLE = "/Users/chrishafley/projects/lol/playwright-local/packages/injected/lib/injectedScript.js"
if (!existsSync(BUNDLE)) throw new Error(`Run \`node utils/generate_injected.js\` in playwright-local first: ${BUNDLE} missing`)
const bundle = readFileSync(BUNDLE, "utf8")

const GLUE = `
(() => {
  const module = { exports: {} }
  const exports = module.exports
  ;((module, exports) => {
${bundle}
    globalThis.__pwExports = { InjectedScript }
  })(module, exports)
  const glue = globalThis.__pwGlue = { errors: [] }
  try {
    const direct = globalThis.__pwExports.InjectedScript
    glue.shape = { typeOfDirect: typeof direct, hasProto: !!direct?.prototype, head: String(direct).slice(0, 80), typeOfExport: typeof module.exports.InjectedScript }
    const InjectedScript = direct
    glue.exported = Object.keys(module.exports)
    const injected = new InjectedScript(window, {
      isUnderTest: false, sdkLanguage: "javascript", frameSeq: 1, testIdAttributeName: "data-testid",
      stableRafCount: 1, browserName: "chromium", isUtilityWorld: false, customEngines: [],
    })
    glue.query = (selector, strict) => {
      const parsed = injected.parseSelector(selector)
      if (strict) return [injected.querySelector(parsed, document, true)]
      return injected.querySelectorAll(parsed, document)
    }
    glue.ids = (selector, strict) => {
      try { return glue.query(selector, strict).map(e => e.id || e.tagName.toLowerCase()) }
      catch (error) { return "ERR: " + String(error && error.message || error) }
    }
    glue.ready = true
  } catch (error) {
    glue.errors.push(String(error && error.stack || error))
    glue.ready = false
  }
})()
`

const FIXTURE = `<!doctype html><html><body>
<button id="save">Save</button>
<button id="cancel">Cancel</button>
<div id="copy">Save the world</div>
<div id="secret" style="display:none">Hidden</div>
<ul><li id="li1">one</li><li id="li2">two</li><li id="li3">three</li></ul>
<label id="lbl">Search<input id="inp" data-testid="field" aria-label="Search"></label>
</body></html>`

const directory = mkdtempSync(join(tmpdir(), "bewpp-injected-"))
const extension = join(directory, "extension")
mkdirSync(extension)
writeFileSync(join(extension, "injected.js"), GLUE)
writeFileSync(join(extension, "manifest.json"), JSON.stringify({
  manifest_version: 3, name: "injected-probe", version: "1.0",
  host_permissions: ["http://127.0.0.1/*"],
  content_scripts: [{ matches: ["http://127.0.0.1/*"], js: ["injected.js"], run_at: "document_start", world: "MAIN" }],
}, null, 2))

const app = Fastify()
app.get("/fixture.html", (_request, reply) => reply.type("text/html").send(FIXTURE))
const address = await app.listen({ host: "127.0.0.1", port: 0 })

const context = await chromium.launchPersistentContext(join(directory, "profile"), {
  channel: "chromium", args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
})

try {
  const page = await context.newPage()
  const pageErrors = []
  page.on("pageerror", error => pageErrors.push(String(error.message)))
  await page.goto(`${address}/fixture.html`)

  const observed = await page.evaluate(() => {
    const glue = globalThis.__pwGlue
    if (!glue) return { ready: false, missing: "glue global absent — content script did not run in MAIN world" }
    if (!glue.ready) return { ready: false, errors: glue.errors, shape: glue.shape }
    return {
      ready: true,
      exported: glue.exported,
      "role=button[name=Save]": glue.ids('role=button[name="Save"]'),
      "role=button (2 matches, non-strict)": glue.ids("role=button"),
      "role=button strict": glue.ids("role=button", true),
      ':has-text("world")': glue.ids(':has-text("world")'),
      "nth=1 on li": glue.ids("li >> nth=1"),
      ":visible filter": glue.ids("div:visible"),
      "css=#inp": glue.ids("css=#inp"),
      "data-testid": glue.ids("data-testid=field"),
      "internal:role form": glue.ids('internal:role=button[name="Save"i]'),
      "aria-label": glue.ids('internal:label="Search"'),
    }
  })

  console.log(JSON.stringify({ ...observed, pageErrors }, null, 2))
} finally {
  await context.close()
  await app.close()
}