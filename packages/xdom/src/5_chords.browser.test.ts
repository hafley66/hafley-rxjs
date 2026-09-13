// Chromium tests for the keyboard operators: real elements, real dispatchEvent, real timers.
import { describe, expect, it } from "vitest"
import { fromEvent, type Observable } from "rxjs"
import { chord, held, parseChord, sequence, typeahead } from "./5_chords.js"

function press(
  type: "keydown" | "keyup",
  init: Partial<KeyboardEventInit> & { key: string },
): KeyboardEvent {
  return new KeyboardEvent(type, { bubbles: true, ...init })
}

function makeEl(): HTMLDivElement {
  const el = document.createElement("div")
  el.tabIndex = 0
  document.body.append(el)
  return el
}

function record<T>(source: Observable<T>): { next: T[]; unsubscribe: () => void } {
  const next: T[] = []
  const sub = source.subscribe(value => next.push(value))
  return { next, unsubscribe: () => sub.unsubscribe() }
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// The node vitest run matches `*.test.ts` and would pick this file up without a DOM;
// the browser run provides one, so only node skips.
const inBrowser = typeof document !== "undefined"

const d = describe.skipIf(!inBrowser)

d("parseChord", () => {
  it("maps Mod to the platform modifier", () => {
    const isMac = /mac|iphone|ipad/i.test(navigator.platform)
    const spec = parseChord("Mod+Shift+K")
    expect(spec.key).toBe("K")
    expect(spec.shift).toBe(true)
    expect(spec.alt).toBe(false)
    if (isMac) {
      expect(spec.meta).toBe(true)
      expect(spec.ctrl).toBe(false)
    } else {
      expect(spec.meta).toBe(false)
      expect(spec.ctrl).toBe(true)
    }
  })

  it("throws on a spec with no key part, naming the spec", () => {
    expect(() => parseChord("Shift+")).toThrowError(/Shift\+/)
  })
})

d("chord", () => {
  it("matches Mod+K only with the modifier and K only without", () => {
    const el = makeEl()
    const isMac = /mac|iphone|ipad/i.test(navigator.platform)
    const modEvents = record(fromEvent<KeyboardEvent>(el, "keydown").pipe(chord("Mod+K")))
    const plainEvents = record(fromEvent<KeyboardEvent>(el, "keydown").pipe(chord("K")))

    el.dispatchEvent(press("keydown", { key: "K", metaKey: isMac, ctrlKey: !isMac }))
    el.dispatchEvent(press("keydown", { key: "K" }))
    expect(modEvents.next.length).toBe(1)
    expect(plainEvents.next.length).toBe(1)
    // Exact modifier match: a modified K is not a plain K.
    el.dispatchEvent(press("keydown", { key: "K", metaKey: isMac, ctrlKey: !isMac }))
    expect(plainEvents.next.length).toBe(1)
    expect(modEvents.next.length).toBe(2)

    modEvents.unsubscribe()
    plainEvents.unsubscribe()
    el.remove()
  })
})

d("sequence", () => {
  it("emits both events when g g lands within the window", async () => {
    const el = makeEl()
    const events = record(fromEvent<KeyboardEvent>(el, "keydown").pipe(sequence("g g", 60)))
    el.dispatchEvent(press("keydown", { key: "g" }))
    await sleep(20)
    el.dispatchEvent(press("keydown", { key: "g" }))
    await sleep(20)
    expect(events.next.length).toBe(1)
    expect(events.next[0].map(event => event.key)).toEqual(["g", "g"])
    events.unsubscribe()
    el.remove()
  })

  it("resets past the window and restarts a new attempt on that same event", async () => {
    const el = makeEl()
    const events = record(fromEvent<KeyboardEvent>(el, "keydown").pipe(sequence("g g", 60)))
    el.dispatchEvent(press("keydown", { key: "g" }))
    await sleep(90)
    // Past the window: reset, and this same g starts the next attempt, so no emit yet.
    el.dispatchEvent(press("keydown", { key: "g" }))
    await sleep(10)
    expect(events.next.length).toBe(0)
    // The third g completes the fresh attempt.
    el.dispatchEvent(press("keydown", { key: "g" }))
    await sleep(10)
    expect(events.next.length).toBe(1)
    events.unsubscribe()
    el.remove()
  })

  it("treats a stray key as a reset and emits once, on the last two", async () => {
    const el = makeEl()
    const events = record(fromEvent<KeyboardEvent>(el, "keydown").pipe(sequence("g g", 60)))
    el.dispatchEvent(press("keydown", { key: "g" }))
    el.dispatchEvent(press("keydown", { key: "x" }))
    el.dispatchEvent(press("keydown", { key: "g" }))
    el.dispatchEvent(press("keydown", { key: "g" }))
    await sleep(10)
    expect(events.next.length).toBe(1)
    expect(events.next[0].map(event => event.key)).toEqual(["g", "g"])
    events.unsubscribe()
    el.remove()
  })
})

d("held", () => {
  it("emits the keydown once the key has been held for ms", async () => {
    const el = makeEl()
    const events = record(held(el, "k", 50))
    el.dispatchEvent(press("keydown", { key: "k" }))
    await sleep(20)
    expect(events.next.length).toBe(0)
    await sleep(60)
    expect(events.next.length).toBe(1)
    expect(events.next[0].key).toBe("k")
    events.unsubscribe()
    el.remove()
  })

  it("emits nothing when keyup lands before ms", async () => {
    const el = makeEl()
    const events = record(held(el, "k", 50))
    el.dispatchEvent(press("keydown", { key: "k" }))
    await sleep(15)
    el.dispatchEvent(press("keyup", { key: "k" }))
    await sleep(70)
    expect(events.next.length).toBe(0)
    events.unsubscribe()
    el.remove()
  })

  it("counts one hold from the first keydown while OS auto-repeat fires", async () => {
    const el = makeEl()
    const events = record(held(el, "k", 50))
    el.dispatchEvent(press("keydown", { key: "k" }))
    await sleep(15)
    // A repeat keydown must not restart the timer: the emit still lands 50ms from the first.
    el.dispatchEvent(press("keydown", { key: "k", repeat: true }))
    await sleep(50)
    expect(events.next.length).toBe(1)
    expect(events.next[0].key).toBe("k")
    events.unsubscribe()
    el.remove()
  })

  it("clears the timer on unsubscribe", async () => {
    const el = makeEl()
    const events = record(held(el, "k", 50))
    el.dispatchEvent(press("keydown", { key: "k" }))
    events.unsubscribe()
    await sleep(80)
    expect(events.next.length).toBe(0)
    el.remove()
  })
})

d("typeahead", () => {
  it("grows the buffer a, ab, abc", async () => {
    const el = makeEl()
    const events = record(fromEvent<KeyboardEvent>(el, "keydown").pipe(typeahead(80)))
    el.dispatchEvent(press("keydown", { key: "a" }))
    el.dispatchEvent(press("keydown", { key: "b" }))
    el.dispatchEvent(press("keydown", { key: "c" }))
    await sleep(10)
    expect(events.next).toEqual(["a", "ab", "abc"])
    events.unsubscribe()
    el.remove()
  })

  it("clears the buffer after a pause past the window", async () => {
    const el = makeEl()
    const events = record(fromEvent<KeyboardEvent>(el, "keydown").pipe(typeahead(60)))
    el.dispatchEvent(press("keydown", { key: "a" }))
    await sleep(90)
    el.dispatchEvent(press("keydown", { key: "d" }))
    await sleep(10)
    expect(events.next).toEqual(["a", "d"])
    events.unsubscribe()
    el.remove()
  })

  it("keeps Shift as a printable letter and skips modified keys", async () => {
    const el = makeEl()
    const events = record(fromEvent<KeyboardEvent>(el, "keydown").pipe(typeahead(80)))
    const isMac = /mac|iphone|ipad/i.test(navigator.platform)
    el.dispatchEvent(press("keydown", { key: "A", shiftKey: true }))
    el.dispatchEvent(press("keydown", { key: "a", metaKey: isMac, ctrlKey: !isMac }))
    el.dispatchEvent(press("keydown", { key: "b" }))
    await sleep(10)
    expect(events.next).toEqual(["A", "Ab"])
    events.unsubscribe()
    el.remove()
  })
})
