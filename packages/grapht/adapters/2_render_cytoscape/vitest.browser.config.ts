import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

// Chromium: the graph renderer imports XML-parsed SVG into an HTML document and
// reads SVGSVGElement and SVGGraphicsElement interfaces, which jsdom does not
// implement. The same file also runs Cytoscape against a real layout engine.
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: "chromium", viewport: { width: 1280, height: 800 } }],
      headless: true,
      screenshotFailures: true,
    },
    include: ["6_graphRenderer.browser.test.ts", "7_proof.browser.test.ts"],
  },
})
