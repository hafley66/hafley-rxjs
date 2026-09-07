// Smoke: boot vite, walk every tab in the header, assert zero console errors, svg on every route, tab x identical
// across routes, every header/bar control carries a tooltip, then open dist/index.html from file:// if it exists. Exit 1 on any failure.
// run: pnpm --filter @hafley66/gothic smoke   (or via `pnpm check`)
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { createServer } from "vite"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const server = await createServer({ root, server: { port: 0, strictPort: false }, logLevel: "silent" })
await server.listen()
const base = server.resolvedUrls.local[0].replace(/\/$/, "")
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
const errors = []
page.on("console", m => m.type() === "error" && errors.push(`${page.url()} ${m.text()}`))
page.on("pageerror", e => errors.push(`${page.url()} ${e}`))

await page.goto(`${base}/`)
await page.waitForSelector("header a[data-tab]")
const tabs = await page.$$eval("header a[data-tab]", as => as.map(a => a.dataset.tab))
const rows = []
let tabX = null
let fail = 0
for (const t of tabs) {
  await page.goto(`${base}/${t}`)
  await page.waitForTimeout(600)
  const xs = JSON.stringify(await page.$$eval("header a[data-tab]", as => as.map(a => Math.round(a.getBoundingClientRect().x))))
  const svg = await page.$$eval("svg", s => s.length)
  const anchors = await page.$$eval("header .kit-anchor", as => as.length)
  // every control in the header and the bars has a title on itself or its label (non-interactive hover tooltip)
  const untitled = await page.$$eval("header input, header select, header button, .kit-drawer input, .kit-drawer select, .kit-drawer button", els =>
    els.filter(e => !(e.title || e.closest("label")?.title || e.closest(".kit-row")?.title)).map(e => `${e.tagName.toLowerCase()}#${e.id || e.dataset.key || e.textContent?.trim().slice(0, 12)}`),
  )
  tabX ??= xs
  const ok = svg > 0 && xs === tabX && untitled.length === 0
  if (!ok) fail++
  rows.push(
    `${ok ? "ok  " : "FAIL"} /${t.padEnd(8)} svg=${String(svg).padStart(3)} anchors=${anchors} tabs=${xs === tabX ? "same" : xs}${untitled.length ? ` untitled=${untitled.join(",")}` : ""}`,
  )
}
const single = resolve(root, "dist/index.html")
if (existsSync(single)) {
  await page.goto(`file://${single}#/${tabs[0]}`)
  await page.waitForTimeout(800)
  const svg = await page.$$eval("svg", s => s.length)
  const ok = svg > 0
  if (!ok) fail++
  rows.push(`${ok ? "ok  " : "FAIL"} file://dist/index.html#/${tabs[0]} svg=${svg}`)
} else rows.push("skip file:// (no dist/index.html; run build:single)")
console.log(rows.join("\n"))
if (errors.length) console.log(`console/page errors (${errors.length}):\n${errors.slice(0, 10).join("\n")}`)
await browser.close()
await server.close()
process.exit(fail || errors.length ? 1 : 0)
