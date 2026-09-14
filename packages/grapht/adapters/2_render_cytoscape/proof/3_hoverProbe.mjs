// Repeat logical pointer transitions once per animation frame. Report, rather than assert,
// timing because CI hardware and display scheduling differ. Style-write tests enforce the invariant.
import { chromium } from "@playwright/test"
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.goto(process.argv[2] ?? "http://127.0.0.1:5179")
  for (const source of ["arch", "sequence"]) {
    await page.locator(`#${source}`).click()
    await page.locator("#renderer-cytoscape").click()
    await page.waitForSelector("#host canvas")
    const result = await page.locator("#host").evaluate(async el => {
      const cy = el._cyreg.cy
      const nodes = cy.nodes('[nativeKind="actor-shape"]')
      const samples = []
      let last = performance.now()
      for (let i = 0; i < 90; i++) {
        await new Promise(requestAnimationFrame)
        const now = performance.now()
        samples.push(now - last); last = now
        nodes[i % nodes.length].emit("mouseout")
        nodes[(i + 1) % nodes.length].emit("mouseover")
      }
      const sorted = samples.slice(5).sort((a, b) => a - b)
      return { elements: cy.elements().length, frames: sorted.length, p95FrameMs: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 10) / 10, over32ms: sorted.filter(time => time > 32).length }
    })
    console.log(JSON.stringify({ source, ...result }))
  }
} finally { await browser.close() }
