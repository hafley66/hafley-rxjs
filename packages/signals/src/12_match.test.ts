// match$ and switch$ contract: node-policy replay (state runs now, events skip), distinct
// gating inherited from the node's selector, hole patterns matching leaf writes at exact
// depth, node identity with the proxy walk, and per-emission error containment.
import { describe, expect, it, vi } from "vitest"
import { Signal } from "./2_Signal.js"
import "./12_match.js"

describe("switch$", () => {
  it("state source replays each key now and fires per write", () => {
    const source = Signal({ a: 1, b: "x" })
    const a = vi.fn()
    const b = vi.fn()
    source.switch$({ a, b })
    expect(a).toHaveBeenCalledWith(1)
    expect(b).toHaveBeenCalledWith("x")
    source.a.$(2)
    source.b.$("y")
    expect(a).toHaveBeenLastCalledWith(2)
    expect(b).toHaveBeenLastCalledWith("y")
  })

  it("event source skips replay and fires per write", () => {
    const source = Signal<{ a: number }>()
    const a = vi.fn()
    source.switch$({ a })
    expect(a).not.toHaveBeenCalled()
    source.a.$(7)
    expect(a).toHaveBeenCalledTimes(1)
    expect(a).toHaveBeenLastCalledWith(7)
  })

  it("a state write of a shallow-equal value does not refire", () => {
    const source = Signal({ a: { n: 1 } })
    const a = vi.fn()
    source.switch$({ a })
    expect(a).toHaveBeenCalledTimes(1)
    source.a.$({ n: 1 })
    expect(a).toHaveBeenCalledTimes(1)
    source.a.$({ n: 2 })
    expect(a).toHaveBeenCalledTimes(2)
  })

  it("the disposer stops deliveries and is idempotent", () => {
    const source = Signal({ a: 1 })
    const a = vi.fn()
    const dispose = source.switch$({ a })
    dispose()
    dispose()
    source.a.$(2)
    expect(a).toHaveBeenCalledTimes(1)
  })
})

describe("match$", () => {
  it("exact pattern hands the node, reads through it, and ignores sibling writes", () => {
    const source = Signal({ deep: { value: 0 }, other: 0 })
    const seen: number[] = []
    const dispose = source.match$({
      "deep.value": it => seen.push(it.$()),
    })
    source.other.$(5)
    expect(seen).toEqual([0])
    source.deep.value.$(3)
    expect(seen).toEqual([0, 3])
    dispose()
  })

  it("handler writes through the node land in the root state", () => {
    const source = Signal({ counter: 0 })
    source.match$({
      counter: it => {
        if (it.$() < 10) it.$(it.$() + 1)
      },
    })
    expect(source.counter.$()).toBe(10)
  })

  it("state patterns run now; event roots wait for the first write", () => {
    const state = Signal({ ping: false })
    const event = Signal<{ ping: number }>()
    const onState = vi.fn()
    const onEvent = vi.fn()
    state.match$({ ping: () => onState() })
    event.match$({ ping: () => onEvent() })
    expect(onState).toHaveBeenCalledTimes(1)
    expect(onEvent).not.toHaveBeenCalled()
    event.ping.$(1)
    expect(onEvent).toHaveBeenCalledTimes(1)
  })

  it("hole patterns fire per leaf write at the pattern's exact depth and extract args", () => {
    const source = Signal<{ todos: Record<string, { done: boolean }> }>({ todos: {} })
    const fired: [string, boolean][] = []
    source.match$({
      "todos.{id}.done": (it, { id }) => fired.push([id, it.$()]),
    })
    // An ancestor write does not name an index, so no args can be extracted: no fire.
    source.todos.$({ "3": { done: true } })
    expect(fired).toEqual([])
    source.todos[3].done.$(false)
    expect(fired).toEqual([["3", false]])
  })

  it("hole patterns do not fire for paths that only share a prefix", () => {
    const source = Signal<{ todos: Record<string, { done: boolean; title: string }> }>({
      todos: {},
    })
    const fired = vi.fn()
    source.match$({ "todos.{id}.done": fired })
    source.todos[3].title.$("nope")
    expect(fired).not.toHaveBeenCalled()
  })

  it("a throwing handler is contained per emission and the channel survives", () => {
    const source = Signal({ a: 0, b: 0 })
    const seen: number[] = []
    let calls = 0
    source.match$({
      a: () => {
        calls += 1
        if (calls < 4) throw new Error("matcher boom")
      },
      b: it => seen.push(it.$()),
    })
    // Replay on subscribe counts as one call: replay + writes 1 and 2 throw, write 3 passes.
    source.a.$(1)
    source.a.$(2)
    source.a.$(3)
    source.b.$(9)
    expect(calls).toBe(4)
  })

  it("a holed pattern on a nested node is rebased to the node's path and fires", () => {
    const root = Signal({ user: { name: "chris", age: 3 } })
    const names: unknown[] = []
    const dispose = root.user.match$({
      "{name}": (it, args) => names.push([it.$(), args]),
    })
    root.user.name.$("sam")
    root.user.age.$(4)
    dispose()
    // {name} is a wildcard over user's children: both child writes fire, the hole
    // extracting the segment it matched.
    expect(names).toEqual([["sam", { name: "name" }], [4, { name: "age" }]])
  })

  it("a handlers argument that is not an object throws instead of enumerating", () => {
    const root = Signal({ user: { name: "chris" } })
    expect(() => root.match$("name" as never)).toThrow(TypeError)
    expect(() => root.switch$("name" as never)).toThrow(TypeError)
  })
})
