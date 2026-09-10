// Mounts every example in a real chromium and fails the run when one throws, leaves a subscription
// or a listener behind after teardown, or carries an empty `source`.
//
// Playwright rather than a headless DOM, because the examples read `?raw` and `*.css` imports that
// only a bundler resolves, and because the render plan is a function of a measured viewport: a
// stubbed DOM would report a zero-height scroll box and every example would window nothing. Both
// vite and playwright are already devDependencies, so nothing is added to run this.
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { createServer } from "vite"

const root = fileURLToPath(new URL("..", import.meta.url))
const ENTRY = "/examples/_check/index.html"

const pad = (text, width) => String(text).padEnd(width)

async function main() {
  const server = await createServer({
    root,
    configFile: false,
    logLevel: "warn",
    // HMR off and the watcher blind: a source edit landing mid-run would reload the page and
    // destroy the execution context the results are being read from.
    server: { port: 0, strictPort: false, hmr: false, watch: { ignored: ["**"] } },
  })
  await server.listen()
  const url = server.resolvedUrls?.local?.[0]
  if (url === undefined) throw new Error("vite did not report a local url")

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  const consoleErrors = []
  page.on("pageerror", (error) => consoleErrors.push(String(error)))
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })

  let results = []
  let videos = []
  try {
    await page.goto(new URL(ENTRY, url).toString(), { waitUntil: "load" })
    await page.waitForFunction(() => window.__ready === true, undefined, { timeout: 60_000 })
    results = await page.evaluate(() => window.__exampleCheck())
    videos = await page.evaluate(async () => {
      const module = await import("/examples/videos.ts")
      return module.VIDEOS.map((v) => ({ id: v.id, sourcePath: v.sourcePath, missing: v.missing }))
    })
  } finally {
    await browser.close()
    await server.close()
  }

  const width = Math.max(...results.map((r) => r.id.length), 7)
  console.log(
    `${pad("example", width)}   ok   bytes   rows   left   open   pinned  listen  resize  failures`,
  )
  for (const result of results) {
    console.log(
      [
        pad(result.id, width),
        result.ok ? " ok " : "FAIL",
        String(result.sourceBytes).padStart(6),
        String(result.rowsRendered).padStart(5),
        String(result.nodesAfterTeardown).padStart(5),
        String(result.openOwned).padStart(5),
        String(result.retainedByDeps).padStart(7),
        String(result.listenerBalance).padStart(6),
        String(result.observerBalance).padStart(6),
        result.failures.join("; "),
      ].join("  "),
    )
  }

  const videoProblems = []
  for (const video of videos) {
    const present = existsSync(new URL(video.sourcePath, new URL("../", import.meta.url)))
    if (video.missing && present) videoProblems.push(`${video.id}: marked missing but the mp4 is there`)
    if (!video.missing && !present) videoProblems.push(`${video.id}: ${video.sourcePath} is not on disk`)
  }
  console.log(`\nvideos: ${videos.length} listed, ${videoProblems.length} mismatched`)
  for (const problem of videoProblems) console.log(`  ${problem}`)

  const failed = results.filter((result) => !result.ok)
  if (consoleErrors.length > 0) {
    console.log("\npage errors:")
    for (const error of consoleErrors.slice(0, 20)) console.log(`  ${error}`)
  }
  console.log(
    `\n${results.length} examples, ${results.length - failed.length} clean, ${failed.length} failed`,
  )
  if (failed.length > 0 || videoProblems.length > 0 || consoleErrors.length > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
