import { chromium } from "@playwright/test"
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on("pageerror", error => errors.push(`${String(error.message).slice(0, 100)} @ ${(error.stack ?? "").split("\n")[1]?.trim().slice(0, 140)}`))
await page.goto("http://localhost:5179/")
await page.waitForTimeout(2500)
const before = await page.evaluate(() => ({
  tspans: document.querySelectorAll("#host tspan").length,
  canvas: !!document.querySelector("#host canvas"),
  readout: document.querySelector("#readout")?.textContent ?? "",
}))
await page.click("#cytoscape")
await page.waitForTimeout(2000)
const after = await page.evaluate(() => ({
  tspans: document.querySelectorAll("#host tspan").length,
  canvas: !!document.querySelector("#host canvas"),
  readout: document.querySelector("#readout")?.textContent ?? "",
}))
console.log(JSON.stringify({ before, after, errors: errors.slice(0, 3) }, null, 1))
await browser.close()
