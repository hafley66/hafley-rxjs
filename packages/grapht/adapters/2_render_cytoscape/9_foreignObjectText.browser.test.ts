import { describe, expect, it } from "vitest"
import { foreignObjectsToText } from "../../src/2_graph/13_foreignObjectText.ts"

const fixture = `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
  <g><foreignObject x="10" y="20" width="180" height="80"><div xmlns="http://www.w3.org/1999/xhtml"><p>Parse Markdown and code-shaped AI output, retain addressable structure.</p></div></foreignObject></g>
  <g><foreignObject x="220" y="20" width="120" height="40"><div xmlns="http://www.w3.org/1999/xhtml"><p>short body</p></div></foreignObject></g>
</svg>`

describe("foreignObjectsToText", () => {
  it("converts markdown blocks into wrapped svg text", () => {
    const converted = foreignObjectsToText(fixture)
    const parsed = new DOMParser().parseFromString(converted, "image/svg+xml")
    expect(parsed.querySelector("parsererror")).toBeNull()
    expect(parsed.querySelectorAll("foreignObject")).toHaveLength(0)

    const texts = [...parsed.querySelectorAll("text")]
    expect(texts).toHaveLength(2)
    const lines = texts[0]?.querySelectorAll("tspan") ?? []
    expect(lines.length).toBeGreaterThan(2)
    expect(lines[0]?.getAttribute("x")).toBe("10.00")
    expect(lines[0]?.getAttribute("dy")).toBe("0")
    expect(lines[1]?.getAttribute("dy")).toBe("24.00")
    expect(lines[0]?.textContent).toMatch(/^Parse Markdown/)
    expect(converted).toContain("addressable")
  })

  it("renders converted lines at the foreignObject position, not the origin", () => {
    const converted = foreignObjectsToText(fixture)
    const host = document.createElement("div")
    host.innerHTML = converted
    document.body.appendChild(host)
    try {
      const texts = [...host.querySelectorAll("text")]
      const tspans = [...(texts[0]?.querySelectorAll("tspan") ?? [])]
      const fontSize = Number.parseFloat(texts[0]?.getAttribute("style")?.match(/font-size:(\d+)px/)?.[1] ?? "16")
      const first = tspans[0]?.getBBox().y ?? Number.NaN
      const second = tspans[1]?.getBBox().y ?? Number.NaN
      // The first foreignObject sits at y=20; its first line must render below that
      // and the second line below the first, else every text lands at the origin.
      expect(first).toBeGreaterThan(20)
      expect(second).toBeGreaterThan(first + fontSize * 0.25)
    } finally {
      host.remove()
    }
  })

  it("leaves svg without foreignObject untouched", () => {
    const plain = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text x="1" y="2">t</text></svg>'
    expect(foreignObjectsToText(plain)).toContain("<text")
  })
})
