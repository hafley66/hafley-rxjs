import { chromium } from "@playwright/test"
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on("pageerror", error => errors.push(String(error)))
await page.goto("http://localhost:5179/")
await page.waitForTimeout(1500)

const vb = () => page.evaluate(() => document.querySelector("#host svg")?.getAttribute("viewBox"))
const initial = await vb()

await page.mouse.move(640, 400)
await page.mouse.wheel(0, 300)
await page.waitForTimeout(200)
const plain = await vb()

await page.keyboard.down("Meta")
await page.mouse.wheel(0, -300)
await page.mouse.wheel(0, -300)
await page.waitForTimeout(200)
await page.keyboard.up("Meta")
const zoomed = await vb()

console.log(JSON.stringify({ initial, plain, zoomed, errors: errors.slice(0, 2) }, null, 1))
await browser.close()
