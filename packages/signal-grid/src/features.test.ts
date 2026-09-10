import { describe, expect, it } from "vitest"
import { FEATURE_AXES, FEATURE_IDS, FEATURES } from "./features.js"
import type { FeatureId } from "./features.js"

const entries = Object.entries(FEATURES) as [FeatureId, (typeof FEATURES)[FeatureId]][]

describe("FEATURES", () => {
  it("has one entry per FEATURE_IDS member", () => {
    const missing = FEATURE_IDS.filter((id) => FEATURES[id] === undefined)
    expect(missing).toEqual([])
  })

  it("has no entry outside FEATURE_IDS", () => {
    const listed = new Set<string>(FEATURE_IDS)
    expect(entries.map(([id]) => id).filter((id) => !listed.has(id))).toEqual([])
  })

  it("keys every entry by its own id", () => {
    expect(entries.filter(([key, meta]) => meta.id !== key).map(([key]) => key)).toEqual([])
  })

  it("lists every id exactly once", () => {
    expect(new Set(FEATURE_IDS).size).toBe(FEATURE_IDS.length)
  })

  it("names an axis that exists", () => {
    const legal = new Set<string>(FEATURE_AXES)
    expect(entries.filter(([, meta]) => !legal.has(meta.axis)).map(([id]) => id)).toEqual([])
  })

  // A repeated title means two ids describe the same thing, which the matrix would print as two rows
  // a reviewer cannot tell apart.
  it("gives every feature a distinct title", () => {
    const seen = new Map<string, FeatureId>()
    const clashes: string[] = []
    for (const [id, meta] of entries) {
      const first = seen.get(meta.title)
      if (first === undefined) seen.set(meta.title, id)
      else clashes.push(`${first} and ${id} share "${meta.title}"`)
    }
    expect(clashes).toEqual([])
  })

  it("gives every feature a title and a why", () => {
    const blank = entries
      .filter(([, meta]) => meta.title.trim() === "" || meta.why.trim() === "")
      .map(([id]) => id)
    expect(blank).toEqual([])
  })

  // The prefix is the contract the parity script sorts on, so an id whose dotted head disagrees with
  // its axis would file itself under the wrong table.
  it("prefixes every id with its axis", () => {
    const wrong = entries.filter(([id, meta]) => !id.startsWith(`${meta.axis}.`)).map(([id]) => id)
    expect(wrong).toEqual([])
  })
})
