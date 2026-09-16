// Throwaway probe: does a MAIN-world, document_start page hook recreate what Fetch.enable gives Playwright?
// Asserts: pre-page-script timing, fetch/XHR interception + fulfill, Set-Cookie on a synthetic Response,
// subresource + navigation coverage, worker coverage, iframe realm coverage, isTrusted on synthetic clicks.
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import Fastify from "fastify"
import { chromium } from "playwright"

const PATCH = `
(() => {
  const probe = window.__probe = { fetch: [], xhr: [], patchedAt: performance.now(), earlyPatched: false }
  const realFetch = window.fetch.bind(window)
  const mocked = body => new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": "probe=1; Path=/" },
  })
  const wrapped = async (input, init) => {
    const url = typeof input === "string" ? input : (input && input.url) || String(input)
    probe.fetch.push(url)
    if (url.includes("/api/mocked")) return mocked({ mocked: true, via: "page-hook" })
    return realFetch(input, init)
  }
  wrapped.__probePatched = true
  Object.defineProperty(window, "fetch", { value: wrapped, writable: true, configurable: true })
  const open = XMLHttpRequest.prototype.open, send = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (method, url, ...rest) { this.__probeUrl = String(url); probe.xhr.push(String(url)); return open.call(this, method, url, ...rest) }
  XMLHttpRequest.prototype.send = function (...args) {
    if (String(this.__probeUrl || "").includes("/api/mocked")) {
      const self = this
      setTimeout(() => {
        Object.defineProperty(self, "readyState", { value: 4, configurable: true })
        Object.defineProperty(self, "status", { value: 200, configurable: true })
        Object.defineProperty(self, "responseText", { value: JSON.stringify({ mocked: true, via: "xhr-hook" }), configurable: true })
        self.dispatchEvent(new Event("load"))
      }, 0)
      return
    }
    return send.apply(this, args)
  }
})()
`

const PAGE = `<!doctype html><html><body>
<img src="/api/img.gif">
<script src="/api/script.js"></script>
<button id="b">go</button>
<iframe id="f" src="/frame.html"></iframe>
<script>
  window.__earlyPatched = !!(window.fetch && window.fetch.__probePatched);
  document.getElementById("b").addEventListener("click", e => { window.__clickTrusted = e.isTrusted });
  document.getElementById("b").click();
  window.__results = {};
  (async () => {
    const mocked = await (await fetch("/api/mocked")).json();
    window.__results.fetchMocked = mocked;
    const real = await (await fetch("/api/real")).json();
    window.__results.fetchReal = real;
    const xhrMocked = await new Promise(resolve => {
      const x = new XMLHttpRequest(); x.open("GET", "/api/mocked"); x.onload = () => resolve(x.responseText); x.send();
    });
    window.__results.xhrMocked = xhrMocked;
    window.__results.cookieAfterMockedResponse = document.cookie;
    const frame = document.getElementById("f");
    if (frame.contentDocument?.readyState !== "complete") await new Promise(resolve => { frame.onload = resolve });
    window.__results.iframeFetchPatched = !!(frame.contentWindow.fetch && frame.contentWindow.fetch.__probePatched);
    window.__results.iframeHookPresent = !!frame.contentWindow.__probe;
    const worker = new Worker("/api/worker.js");
    window.__results.workerBody = await new Promise(resolve => { worker.onmessage = e => resolve(e.data); worker.postMessage("go") });
    window.__results.done = true;
    // Bypass probes, last: a fresh realm is unpatched, and reassigning window.fetch discards the hook.
    const fresh = document.createElement("iframe");
    document.body.appendChild(fresh);
    window.__results.freshRealmPatched = !!(fresh.contentWindow.fetch && fresh.contentWindow.fetch.__probePatched);
    const pristine = fresh.contentWindow.fetch;
    window.__results.pristineViaFreshRealm = await (await pristine("/api/real")).json();
    window.fetch = pristine;
    window.__results.patchSurvivesReassign = !!(window.fetch && window.fetch.__probePatched);
  })();
</script>
</body></html>`

const FRAME = `<!doctype html><html><body><script>
  (async () => { window.__frameOwnFetch = await (await fetch("/api/real")).json() })()
</script></body></html>`

const hits = []
const directory = mkdtempSync(join(tmpdir(), "bewpp-probe-"))
const extension = join(directory, "extension")
mkdirSync(extension)
writeFileSync(join(extension, "patch.js"), PATCH)
writeFileSync(join(extension, "manifest.json"), JSON.stringify({
  manifest_version: 3, name: "probe", version: "1.0",
  permissions: ["scripting"], host_permissions: ["http://127.0.0.1/*"],
  content_scripts: [{ matches: ["http://127.0.0.1/*"], js: ["patch.js"], run_at: "document_start", world: "MAIN", all_frames: true }],
}, null, 2))

const app = Fastify()
app.addHook("onRequest", async request => { hits.push(request.url) })
app.get("/page.html", (_request, reply) => reply.type("text/html").send(PAGE))
app.get("/frame.html", (_request, reply) => reply.type("text/html").send(FRAME))
app.get("/api/worker.js", (_request, reply) => reply.type("text/javascript").send(
  `self.onmessage = async () => { const body = await (await fetch("/api/real")).json(); self.postMessage({ body, patched: !!(self.fetch && self.fetch.__probePatched) }) }`))
app.get("/api/*", (request, reply) => { hits.push(request.url); return reply.type(request.url.endsWith(".gif") ? "image/gif" : "application/json").send(JSON.stringify({ real: true, path: request.url })) })

const address = await app.listen({ host: "127.0.0.1", port: 0 })
const context = await chromium.launchPersistentContext(join(directory, "profile"), {
  channel: "chromium",
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
})
try {
  const page = await context.newPage()
  await page.goto(`${address}/page.html`)
  await page.waitForFunction("window.__results && window.__results.done", null, { timeout: 15_000 })
  const observed = await page.evaluate(() => ({
    probe: window.__probe, results: window.__results,
    earlyPatched: window.__earlyPatched, clickTrusted: window.__clickTrusted,
    frameOwnFetch: document.getElementById("f").contentWindow.__frameOwnFetch,
  }))
  const patched = observed.probe
  const report = {
    "hook ran before page scripts": observed.earlyPatched === true,
    "fetch fulfilled by hook": observed.results.fetchMocked?.via === "page-hook",
    "xhr fulfilled by hook": String(observed.results.xhrMocked).includes("xhr-hook"),
    "unmocked fetch reaches network": observed.results.fetchReal?.real === true,
    "Set-Cookie on synthetic Response sets cookie": /probe=1/.test(observed.results.cookieAfterMockedResponse || ""),
    "hook saw page fetch calls": patched.fetch,
    "hook saw page xhr calls": patched.xhr,
    "subresource /api/img.gif hit the network (not the hook)": hits.includes("/api/img.gif"),
    "subresource /api/script.js hit the network (not the hook)": hits.includes("/api/script.js"),
    "hook saw subresource calls": patched.fetch.filter(u => /img\.gif|script\.js/.test(u)),
    "page document request hit the network": hits.includes("/page.html"),
    "worker fetch patched": observed.results.workerBody?.patched === true,
    "worker fetch reached network unpatched": hits.includes("/api/real") && observed.results.workerBody?.body?.real === true,
    "same-origin iframe fetch patched": observed.results.iframeFetchPatched === true, "iframe hook object present": observed.results.iframeHookPresent === true, "api/real network hits": hits.filter(h => h === "/api/real").length,
    "fresh realm (new iframe) is unpatched": observed.results.freshRealmPatched === false,
    "pristine fetch via fresh realm bypasses hook": observed.results.pristineViaFreshRealm?.real === true,
    "patch survives window.fetch reassignment": observed.results.patchSurvivesReassign,
    "synthetic click isTrusted": observed.clickTrusted,
    networkHits: hits,
  }
  console.log(JSON.stringify(report, null, 2))
} finally {
  await context.close()
  await app.close()
}
