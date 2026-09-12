import { chromium } from "@playwright/test"
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on("pageerror", error => errors.push(String(error)))
page.on("console", message => { if (message.type() === "error") errors.push(message.text()) })
await page.goto("http://localhost:5179/")
await page.waitForTimeout(2000)

const initial = await page.evaluate(() => document.querySelector("#host svg")?.getAttribute("viewBox"))

// wheel zoom at center
await page.mouse.move(640, 400)
await page.mouse.wheel(0, -600)
await page.waitForTimeout(400)
const zoomed = await page.evaluate(() => document.querySelector("#host svg")?.getAttribute("viewBox"))

// background drag pan
await page.mouse.move(640, 400)
await page.mouse.down()
await page.mouse.move(740, 450, { steps: 5 })
await page.mouse.up()
await page.waitForTimeout(300)
const panned = await page.evaluate(() => document.querySelector("#host svg")?.getAttribute("viewBox"))

// zoom until text is big, then select it
for (let i = 0; i < 10; i++) await page.mouse.wheel(0, -400)
await page.waitForTimeout(400)
await page.mouse.dblclick(640, 400)
await page.waitForTimeout(200)
const selection = await page.evaluate(() => String(document.getSelection()))

const readout = await page.evaluate(() => document.querySelector("#readout")?.textContent ?? "")
const fps = await page.evaluate(() => new Promise(resolve => {
  let frames = 0
  const start = performance.now()
  const tick = () => {
    frames += 1
    if (performance.now() - start < 1000) requestAnimationFrame(tick)
    else resolve(frames)
  }
  requestAnimationFrame(tick)
}))
console.log(JSON.stringify({ initial, zoomed, panned, selection: selection.slice(0, 60), readout, fps, errors: errors.slice(0, 3) }, null, 1))
await browser.close()
