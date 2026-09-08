import { defaultsOf, isStatic, mulberry32, rollField, shuffle } from "@hafley66/report-shell"
import { expect, it } from "vitest"
import { PAGES } from "./0_pages.js"

it("gives geometry fields randomization sources and preserves static playback and pinned values", () => {
  for (const page of PAGES) for (const spec of Object.values(page.specs)) {
    for (const [key, field] of Object.entries(spec)) {
      expect(isStatic(field), `${page.id}.${key}`).toBe(field.group === "playback")
      if (field.kind === "number") expect([field.min, field.max].every(Number.isFinite), `${page.id}.${key} number bounds`).toBe(true)
      if (field.kind === "text") expect(field.pool?.length ?? 0, `${page.id}.${key} text pool`).toBeGreaterThan(1)
    }
    const values = defaultsOf(spec)
    const keys = Object.keys(spec)
    expect(shuffle(spec, values, mulberry32(7), new Set(keys))).toEqual(values)
    const expected = Object.fromEntries(Object.entries(spec).map(([key, field]) => [key, isStatic(field) ? values[key] : rollField(field, () => 0.8)]))
    expect(shuffle(spec, values, () => 0.8)).toEqual(expected)
  }
})
