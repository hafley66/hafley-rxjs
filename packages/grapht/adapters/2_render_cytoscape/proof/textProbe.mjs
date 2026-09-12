import { chromium } from "@playwright/test"
import { createServer } from "node:http"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, "../../../site/dist/proof")
const svgSource = readFileSync(join(here, "arch.svg"), "utf8")

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" }
const PREFIX = "/hafley-rxjs/grapht/proof/"
const server = createServer((request, response) => {
  const path = request.url === PREFIX ? `${PREFIX}index.html` : request.url
  if (!path.startsWith(PREFIX)) {
    response.statusCode = 404
    response.end("outside the app base")
    return
  }
  try {
    const body = readFileSync(join(dist, path.slice(PREFIX.length)))
    const dot = path.lastIndexOf(".")
    response.setHeader("Content-Type", MIME[dot >= 0 ? path.slice(dot) : ""] ?? "application/octet-stream")
    response.end(body)
  } catch {
    response.statusCode = 404
    response.end("missing")
  }
})
await new Promise(resolve => server.listen(5197, resolve))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
const failed = []
page.on("pageerror", error => errors.push(String(error)))
page.on("console", message => {
  if (message.type() === "error") errors.push(message.text())
})
page.on("requestfailed", request => failed.push(`${request.url()} ${request.failure()?.errorText}`))
page.on("response", response => {
  if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`)
})
await page.goto("http://localhost:5197/hafley-rxjs/grapht/proof/")
await page.waitForTimeout(1500)

const report = await page.evaluate(source => {
  const texts = [...document.querySelectorAll("#host text")]
  const rows = texts.slice(0, 6).map(text => {
    const tspans = [...text.querySelectorAll("tspan")]
    return {
      attrX: text.getAttribute("x"),
      attrY: text.getAttribute("y"),
      tspans: tspans.length,
      firstTspan: { x: tspans[0]?.getAttribute("x"), y: tspans[0]?.getAttribute("y"), dy: tspans[0]?.getAttribute("dy") },
      rectTop: Math.round(text.getBoundingClientRect().top),
    }
  })
  const raw = document.querySelector("#host svg")?.outerHTML ?? ""
  return {
    hostChildren: document.querySelector("#host")?.children.length ?? -1,
    svgBytes: raw.length,
    readout: document.querySelector("#readout")?.textContent ?? null,
    count: texts.length,
    rows,
    nanY: (raw.match(/y="NaN/g) ?? []).length,
    missingY: texts.filter(text => text.getAttribute("y") === null).length,
    sourceForeignObjects: (source.match(/<foreignObject/g) ?? []).length,
    liveForeignObjects: document.querySelectorAll("#host foreignObject").length,
  }
}, svgSource)

console.log(JSON.stringify(report, null, 2))
console.log("errors:", errors.length === 0 ? "none" : errors.join(" | "))
console.log("failed:", failed.length === 0 ? "none" : failed.join(" | "))
await browser.close()
server.close()
