import { readFile } from "node:fs/promises"
import { describe, expect, test } from "vitest"

const fixtureUrl = (name: string) => new URL(`../../fixtures/sequence/${name}`, import.meta.url)

type Fixture = {
  schema: number
  source: string
  viewBox: { x: number; y: number; width: number; height: number }
  actors: Array<{ id: string; label: string; left: number; width: number; top: number; bottom: number; elementId: string }>
  groups: Array<{ id: string; label: string; left: number; width: number; top: number; bottom: number; depth: number; elementId: string }>
  counts: { participants: number; messages: number; groups: number }
}

const fixture = (await readFile(fixtureUrl("large.json"), "utf8")) as string
const json = JSON.parse(fixture) as Fixture
const svg = await readFile(fixtureUrl("large.svg"), "utf8")

describe("large sequence fixture", () => {
  test("meets the size floor for a large unreadable diagram", () => {
    expect(json.counts.participants).toBeGreaterThanOrEqual(14)
    expect(json.counts.messages).toBeGreaterThanOrEqual(120)
    expect(json.counts.groups).toBeGreaterThanOrEqual(6)
  })

  test("every actor has a label, positive width, and a descending lifeline", () => {
    for (const actor of json.actors) {
      expect(actor.label.length).toBeGreaterThan(0)
      expect(actor.width).toBeGreaterThan(0)
      expect(actor.bottom).toBeGreaterThan(actor.top)
    }
  })

  test("actors are ordered left to right without horizontal overlap", () => {
    const sorted = [...json.actors].sort((a, b) => a.left - b.left)
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1]
      const current = sorted[index]
      expect(current.left).toBeGreaterThan(previous.left)
      expect(current.left).toBeGreaterThanOrEqual(previous.left + previous.width)
    }
  })

  test("every group has height and at least one group is nested one level deep", () => {
    for (const group of json.groups) {
      expect(group.bottom).toBeGreaterThan(group.top)
    }
    expect(json.groups.some(group => group.depth === 1)).toBe(true)
  })

  test("every binding element id resolves to an element in the SVG", () => {
    const elementIds = [
      ...json.actors.map(actor => actor.elementId),
      ...json.groups.map(group => group.elementId),
    ]
    for (const elementId of elementIds) {
      expect(svg).toContain(elementId)
    }
  })

  test("SVG parses with a viewBox matching the JSON", () => {
    const root = svg.match(/^\s*<svg\b/)
    expect(root).not.toBeNull()
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true)
    const match = svg.match(/\bviewBox="([^"]+)"/)
    expect(match).not.toBeNull()
    const parts = match![1].split(/[\s,]+/).map(Number)
    expect(parts[0]).toBeCloseTo(json.viewBox.x)
    expect(parts[1]).toBeCloseTo(json.viewBox.y)
    expect(parts[2]).toBeCloseTo(json.viewBox.width)
    expect(parts[3]).toBeCloseTo(json.viewBox.height)
  })
})
