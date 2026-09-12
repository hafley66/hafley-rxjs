import { chromium } from "playwright"
import { createServer } from "node:http"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const REPO = new URL("..", import.meta.url).pathname
const GRAPHT = join(REPO, "packages/grapht/site/dist")
const STRIP = join(REPO, "pages/dist/strip.js")
const GOTHIC = "<!doctype html><title>gothic-marker</title><h1 id=gothic>gothic root</h1>"
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" }

const server = createServer((request, response) => {
  const path = request.url.split("?")[0]
  const send = (body, type) => { response.setHeader("Content-Type", type); response.end(body) }
  if (path === "/hafley-rxjs/strip.js") return send(readFileSync(STRIP), "text/javascript")
  if (path.startsWith("/hafley-rxjs/gothic")) return send(GOTHIC, "text/html")
  if (path.startsWith("/hafley-rxjs/grapht")) {
    let rest = path.slice("/hafley-rxjs/grapht/".length)
    if (rest === "" || rest.endsWith("/")) rest += "index.html"
    for (const candidate of [rest, `${rest}.html`, `${rest}/index.html`]) {
      try {
        const body = readFileSync(join(GRAPHT, candidate))
        const dot = candidate.lastIndexOf(".")
        return send(body, MIME[candidate.slice(dot)] ?? "application/octet-stream")
      } catch {}
    }
  }
  response.statusCode = 404
  send("missing", "text/plain")
})
await new Promise(resolve => server.listen(5196, resolve))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.goto("http://localhost:5196/hafley-rxjs/grapht/")
await page.waitForSelector(".pages-strip a[data-tab=gothic]")

const tabs = await page.$$eval(".pages-strip a", links => links.map(link => ({ tab: link.dataset.tab, href: link.getAttribute("href"), target: link.getAttribute("target") })))
await page.click(".pages-strip a[data-tab=gothic]")
await page.waitForTimeout(1200)

const landed = await page.evaluate(() => ({
  url: location.pathname,
  title: document.title,
  gothicMarker: document.querySelector("#gothic") !== null,
  vitepress404: /404|PAGE NOT FOUND/i.test(document.body.innerText.slice(0, 400)),
}))
console.log(JSON.stringify({ tabs, landed }, null, 2))
await browser.close()
server.close()
