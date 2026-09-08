import { readFileSync } from "node:fs"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { expect, it } from "vitest"

it("serves one HTML beneath a repository path and preserves notebook links, inputs and reloads", async () => {
  const html = readFileSync(resolve("dist/index.html"))
  const missing: string[] = []
  const server = createServer((req, res) => {
    if (req.url === "/favicon.ico") { res.writeHead(204).end(); return }
    if (req.url === "/hafley-rxjs/" || req.url === "/hafley-rxjs/index.html") {
      res.writeHead(200, { "content-type": "text/html" }).end(html)
    } else { missing.push(req.url ?? ""); res.writeHead(404).end() }
  })
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve))
  const browser = await chromium.launch()
  try {
    const base = process.env.GOTHIC_PAGES_URL ?? `http://127.0.0.1:${(server.address() as AddressInfo).port}/hafley-rxjs/`
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors: string[] = [], assets: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    page.on("request", request => { if (["script", "stylesheet"].includes(request.resourceType())) assets.push(request.url()) })
    const response = await page.goto(base)
    expect(response?.status()).toBe(200)
    await page.waitForSelector("#eye svg")
    expect(await page.locator('[data-tab="slice"]').getAttribute("href")).toBe("#/slice")
    await page.locator('[data-tab="fma"]').click()
    await page.waitForSelector("#fma2 svg")
    const n = page.locator('#fma2 input[data-key="n"]')
    await n.evaluate(el => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, "7")
      el.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(page.url()).toContain(`${base}#/fma?`)
    expect(page.url()).toContain("fma2.n=7")
    expect((await page.reload())?.status()).toBe(200)
    await page.waitForSelector("#fma2 svg")
    expect(await n.inputValue()).toBe("7")
    await page.locator('[data-tab="slice"]').click()
    await page.waitForSelector("#slice .ink path")
    expect(page.url()).toContain(`${base}#/slice`)
    expect(assets).toEqual([])
    expect(missing).toEqual([])
    expect(errors).toEqual([])
  } finally {
    await browser.close()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
