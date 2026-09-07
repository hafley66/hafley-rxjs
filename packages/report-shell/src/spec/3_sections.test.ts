import { describe, expect, it } from "vitest"
import type { AnySpec } from "./0_spec.js"
import type { Mode } from "./1_url.js"
import { memoryStorage } from "./2_store.js"
import { createSections, type SectionHost } from "./3_sections.js"

const SPEC = {
  cut: { kind: "range", min: 0, max: 100, step: 1, default: 10 },
  seed: { kind: "int", min: 0, max: 1000, default: 1 },
} as const satisfies AnySpec

// a host that keeps its query string in a variable and logs every history write
function memHost(search = "", storage = memoryStorage()) {
  const writes: [string, Mode][] = []
  const host: SectionHost & { writes: typeof writes; storage: ReturnType<typeof memoryStorage> } = {
    search: () => search,
    write(s, m) {
      search = s
      writes.push([s, m])
    },
    storage,
    prefix: "t",
    writes,
  }
  return host
}

describe("createSections", () => {
  it("starts from defaults, then the autosave, then keys present in the url", () => {
    const host = memHost("?slice.cut=20")
    host.storage.set("t.p.slice.current", JSON.stringify({ vals: { cut: 30, seed: 7 }, pin: "seed" }))
    const s = createSections(host).sectionState("p", "slice", SPEC)
    expect(s.values.$()).toEqual({ cut: 20, seed: 7 })
    expect(s.pins.$().pin).toBe("seed")
  })

  it("writes replace on set and push inside rollAll; pins print and shuffle skips them", () => {
    const host = memHost()
    const k = createSections(host)
    k.setActivePage("p", "")
    const s = k.sectionState("p", "slice", SPEC)
    s.set({ cut: 20 })
    expect(host.writes.at(-1)).toEqual(["?slice.cut=20", "replace"])
    s.togglePin("cut")
    expect(host.writes.at(-1)).toEqual(["?slice.cut=20&slice.pin=cut", "replace"])
    s.rollAll()
    expect(s.values.$().cut).toBe(20)
    expect(host.writes.at(-1)?.[1]).toBe("push")
    expect(JSON.parse(host.storage.get("t.p.slice.current") ?? "null")).toMatchObject({ pin: "cut" })
  })

  it("roll changes one field with one push", () => {
    const host = memHost()
    const k = createSections(host)
    k.setActivePage("p", "")
    const s = k.sectionState("p", "slice", SPEC)
    s.set({ cut: 42 })
    const n = host.writes.length
    s.roll("seed")
    expect(s.values.$().cut).toBe(42)
    expect(host.writes.length).toBe(n + 1)
    expect(host.writes.at(-1)?.[1]).toBe("push")
  })

  it("syncFromUrl applies values without echoing a write; foreign keys survive a write", () => {
    const host = memHost("?x=1")
    const k = createSections(host)
    k.setActivePage("p", "?x=1")
    const s = k.sectionState("p", "slice", SPEC)
    const n = host.writes.length
    k.syncFromUrl("?x=1&slice.cut=12")
    expect(s.values.$().cut).toBe(12)
    expect(host.writes.length).toBe(n)
    s.set({ seed: 5 })
    expect(host.writes.at(-1)?.[0]).toBe("?x=1&slice.cut=12&slice.seed=5")
  })

  it("save by name creates then overwrites; the selected state receives later edits; remove clears selected", () => {
    const host = memHost()
    const k = createSections(host)
    k.setActivePage("p", "")
    const s = k.sectionState("p", "slice", SPEC)
    s.set({ cut: 1 })
    s.save("tight")
    s.set({ cut: 2 })
    s.save("tight")
    expect(s.states.$()).toHaveLength(1)
    const id = s.states.$()[0].id
    expect(s.selected.$()).toBe(id)
    s.set({ cut: 3 })
    expect(s.states.$()[0].vals).toEqual({ cut: 3, seed: 1 })
    s.remove(id)
    expect(s.states.$()).toEqual([])
    expect(s.selected.$()).toBeNull()
  })

  it("load pushes the saved values and selects; a second store over the same backend sees them", () => {
    const host = memHost()
    const k = createSections(host)
    k.setActivePage("p", "")
    const s = k.sectionState("p", "slice", SPEC)
    s.set({ cut: 7 })
    s.save("seven")
    s.select(null)
    s.set({ cut: 8 })
    const id = s.states.$()[0].id
    s.load(id)
    expect(s.values.$().cut).toBe(7)
    expect(host.writes.at(-1)).toEqual(["?slice.cut=7", "push"])
    const again = createSections(memHost("", host.storage)).sectionState("p", "slice", SPEC)
    expect(again.states.$().map(x => x.name)).toEqual(["seven"])
    expect(again.selected.$()).toBe(id)
  })

  it("page * cells ride along with every active page; the same page+id returns the cached state", () => {
    const host = memHost()
    const k = createSections(host)
    const PAGE = { z: { kind: "range", min: 0, max: 1, step: 0.05, default: 0 } } as const satisfies AnySpec
    const pg = k.sectionState("*", "page", PAGE)
    k.setActivePage("a", "")
    const a = k.sectionState("a", "s", SPEC)
    pg.set({ z: 0.5 })
    expect(host.writes.at(-1)?.[0]).toBe("?page.z=0.5")
    k.setActivePage("b", "?page.z=0.5")
    expect(pg.values.$().z).toBe(0.5)
    expect(k.sectionState("a", "s", SPEC)).toBe(a)
  })
})
