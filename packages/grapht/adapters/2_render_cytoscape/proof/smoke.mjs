import { chromium } from "@playwright/test"
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on("pageerror", error => errors.push(String(error)))
page.on("console", message => { if (message.type() === "error") errors.push(message.text()) })
await page.goto("http://localhost:5179/")
await page.waitForTimeout(1500)

const before = await page.evaluate(() => document.querySelector("#host svg")?.getAttribute("viewBox"))
await page.keyboard.down("Shift")
await page.mouse.move(640, 400)
await page.mouse.wheel(0, 400)
await page.waitForTimeout(300)
const after = await page.evaluate(() => document.querySelector("#host svg")?.getAttribute("viewBox"))
await page.keyboard.up("Shift")

await page.waitForTimeout(800)
const readout = await page.evaluate(() => document.querySelector("#readout")?.textContent ?? "")
console.log(JSON.stringify({ before, after, readout, errors: errors.slice(0, 2) }, null, 1))
await browser.close()
