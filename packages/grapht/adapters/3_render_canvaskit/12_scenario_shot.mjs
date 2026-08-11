import { chromium } from "@playwright/test"
import { mkdir, writeFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.GRAPHT_SCENARIO_PORT ?? 4174)
const nodeCount = Number(process.env.GRAPHT_SCENARIO_NODES ?? 1000)
const results = resolve(here, "../../results/scenario_screens")

async function waitForServer(p) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await fetch(`http://127.0.0.1:${p}`); return } catch {}
    await new Promise(r => setTimeout(r, 100))
  }
  throw new Error(`vite did not start on ${p}`)
}

async function main() {
  const server = spawn("pnpm", ["exec", "vite", "--host", "127.0.0.1", "--port", String(port)], { cwd: here, stdio: ["ignore", "pipe", "pipe"] })
  try {
    await waitForServer(port)
    const browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    const pageError = []
    page.on("pageerror", error => pageError.push(`${error.name}: ${error.message}`))
    await page.goto(`http://127.0.0.1:${port}/11_scenario_index.html?nodes=${nodeCount}`, { waitUntil: "domcontentloaded" })
    await page.waitForFunction(() => { const e = document.querySelector("#receipt"); return Boolean(e && (e.textContent || e.value)) })
    const value = JSON.parse(await page.locator("#receipt").evaluate(e => e.textContent?.trim() || ("value" in e ? String(e.value) : "{}")))
    if (pageError.length) value.pageError = pageError.join("\n")
    const valid = value.visualValidity?.valid === true
    if (valid) {
      await mkdir(results, { recursive: true })
      const screenshot = resolve(results, `canvaskit-scenarios-${nodeCount}.png`)
      await page.screenshot({ path: screenshot, fullPage: true })
      value.screenshot = screenshot
    } else {
      value.status = "visual-invalid"
      value.setupValid = false
    }
    await writeFile(resolve(results, "receipt.json"), JSON.stringify(value, null, 2))
    process.stdout.write(`${JSON.stringify(value)}\n`)
    await browser.close()
  } finally {
    server.kill("SIGTERM")
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
