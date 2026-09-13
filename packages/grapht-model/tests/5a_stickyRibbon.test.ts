import { describe, expect, it } from "vitest"
import { layoutStickyRibbon, type RibbonInput, type RibbonItem } from "../src/5a_stickyRibbon.js"

const actor = (id: string, left: number, order: number): RibbonItem => ({
  id,
  left,
  width: 100,
  top: 0,
  bottom: 4000,
  order,
})

const input = (overrides: Partial<RibbonInput> = {}): RibbonInput => ({
  items: [actor("alice", 0, 0), actor("bob", 300, 1), actor("carol", 600, 2)],
  camera: { x: 0, y: 0, scale: 1 },
  viewport: { x: 0, y: 0, width: 800, height: 600 },
  inset: 8,
  fullWidth: 60,
  chipWidth: 32,
  gap: 4,
  ...overrides,
})

describe("layoutStickyRibbon", () => {
  it("pins every column header at the ribbon row, following its world x", () => {
    const placed = layoutStickyRibbon(input())
    expect(placed.map(placement => [placement.id, placement.left, placement.width, placement.detail, placement.state])).toEqual([
      ["alice", 8, 100, "full", "clamped-start"],
      ["bob", 300, 100, "full", "pinned"],
      ["carol", 600, 100, "full", "pinned"],
    ])
    expect(placed.every(placement => placement.top === 8)).toBe(true)
  })

  it("condenses to a chip when the column is too narrow to read at this zoom", () => {
    const placed = layoutStickyRibbon(input({ camera: { x: 0, y: 0, scale: 0.4 } }))
    expect(placed.map(placement => [placement.id, placement.width, placement.detail])).toEqual([
      ["alice", 32, "chip"],
      ["bob", 32, "chip"],
      ["carol", 32, "chip"],
    ])
  })

  it("chips a column scrolled off the left edge and keeps the order readable", () => {
    const placed = layoutStickyRibbon(input({ camera: { x: -500, y: 0, scale: 1 } }))
    expect(placed[0]).toMatchObject({ id: "alice", left: 8, width: 32, detail: "chip", state: "clamped-start" })
    expect(placed[1]).toMatchObject({ id: "bob", left: 44, width: 32, detail: "chip", state: "clamped-start" })
    expect(placed[2]).toMatchObject({ id: "carol", left: 100, width: 100, detail: "full", state: "pinned" })
  })

  it("chips a column past the right edge and clamps it to the end", () => {
    const placed = layoutStickyRibbon(input({ camera: { x: 250, y: 0, scale: 1 } }))
    expect(placed[1]).toMatchObject({ id: "bob", left: 550, detail: "full", state: "pinned" })
    expect(placed[2]).toMatchObject({ id: "carol", left: 760, width: 32, detail: "chip", state: "clamped-end" })
  })

  it("releases a header whose lifeline has left the viewport", () => {
    const above = layoutStickyRibbon(input({ camera: { x: 0, y: -5000, scale: 1 } }))
    expect(above.map(placement => placement.state)).toEqual(["released", "released", "released"])
    const below = layoutStickyRibbon(input({ camera: { x: 0, y: 900, scale: 1 } }))
    expect(below.map(placement => placement.state)).toEqual(["released", "released", "released"])
  })

  it("never overlaps two headers", () => {
    const placed = layoutStickyRibbon(
      input({ items: [actor("a", 0, 0), actor("b", 20, 1), actor("c", 40, 2)] }),
    ).filter(placement => placement.state !== "released")
    for (const [index, placement] of placed.slice(1).entries()) {
      const previous = placed[index]
      expect(placement.left).toBeGreaterThanOrEqual(previous.left + previous.width + 4)
    }
  })
})
