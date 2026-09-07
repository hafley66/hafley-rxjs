import { describe, expect, it } from "vitest"
import { currentPin, store } from "./3_store.js"

const mem = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
}

describe("store", () => {
  it("autosaves current values and pins under the key", () => {
    const ls = mem()
    const st = store("kit.eye.eye", ls)
    expect(st.current()).toBeNull()
    st.saveCurrent({ seed: 5 }, "seed")
    expect(st.current()).toEqual({ seed: 5 })
    expect(currentPin("kit.eye.eye", ls)).toBe("seed")
    expect([...ls.m.keys()]).toEqual(["kit.eye.eye.current"])
  })
  it("names, stars, and deletes saved states in insertion order", () => {
    const ls = mem()
    const st = store("kit.eye.eye", ls)
    const a = st.add("  ", { seed: 1 }, "")
    const b = st.add("blue", { seed: 2 }, "seed")
    expect(a.name).toBe("state 1")
    expect(st.list().map(s => s.name)).toEqual(["state 1", "blue"])
    st.star(b.id)
    expect(st.list()[1].star).toBe(true)
    st.star(b.id)
    expect(st.list()[1].star).toBe(false)
    st.remove(a.id)
    expect(st.list().map(s => s.id)).toEqual([b.id])
    expect(st.list()[0].vals).toEqual({ seed: 2 })
  })
  it("survives junk in storage", () => {
    const ls = mem()
    ls.setItem("k.states", "{not json")
    expect(store("k", ls).list()).toEqual([])
  })
})
