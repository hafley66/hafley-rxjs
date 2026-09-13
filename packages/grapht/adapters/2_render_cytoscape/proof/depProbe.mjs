import { chromium } from "@playwright/test"
const browser = await chromium.launch()
const page = await browser.newPage()
const result = await page.evaluate(async () => {
  const module = await import("/@fs/Users/chrishafley/projects/hafley-rxjs/packages/grapht/adapters/2_render_cytoscape/node_modules/.vite/deps/cytoscape.js")
  return { defaultType: typeof module.default, keys: Object.keys(module).slice(0, 6), defaultKeys: module.default ? Object.keys(module.default).slice(0, 6) : null }
})
console.log(JSON.stringify(result))
await browser.close()
