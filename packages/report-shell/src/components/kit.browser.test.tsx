import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { AnySpec } from "../spec/0_spec"
import type { Mode } from "../spec/1_url"
import { memoryStorage } from "../spec/2_store"
import { createSections, type SectionHost, type Sections } from "../spec/3_sections"
import { Drawer } from "./Drawer"
import { NavTabs, type Anchor } from "./NavTabs"
import { Section } from "./Section"
import "../kit.css"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const SPEC = {
  cut: { kind: "range", min: 0, max: 100, step: 1, default: 10, label: "cut", hint: "how deep the cut goes" },
  seed: { kind: "seed", default: 1 },
  mode: { kind: "select", options: ["a", "b"], default: "a", group: "look" },
  on: { kind: "bool", default: false, group: "look" },
  fixed: { kind: "range", min: 0, max: 1, step: 0.1, default: 0, static: true },
} as const satisfies AnySpec

// a host that keeps its query string in a variable and logs every history write
function memHost(search = "") {
  const writes: [string, Mode][] = []
  const host: SectionHost & { writes: typeof writes; storage: ReturnType<typeof memoryStorage> } = {
    search: () => search,
    write(s, m) {
      search = s
      writes.push([s, m])
    },
    storage: memoryStorage(),
    prefix: "t",
    writes,
  }
  return host
}

let root: Root | null = null
afterEach(() => {
  act(() => root?.unmount())
  root = null
  document.body.replaceChildren()
  document.body.removeAttribute("style")
  document.documentElement.removeAttribute("style")
  window.scrollTo(0, 0)
})

function mount(ui: React.ReactNode): HTMLElement {
  const el = document.createElement("div")
  document.body.append(el)
  root = createRoot(el)
  act(() => root?.render(ui))
  return el
}

// the panel needs the drawer body in the DOM first; Section portals into it after its own mount
function mountSection(host = memHost(), anchors: Anchor[] = [{ id: "slice" }]) {
  const k: Sections = createSections(host)
  k.setActivePage("p", host.search())
  const el = mount(
    <>
      <NavTabs tabs={[{ id: "p", href: "#/p", current: true }]} anchors={anchors} title="page p" />
      <Drawer pageKey="p" />
      <main>
        <Section sections={k} page="p" def={{ id: "slice", title: "slice", spec: SPEC }}>
          {v => <div data-testid="out" style={{ height: 1600 }}>{`cut=${v.cut} seed=${v.seed}`}</div>}
        </Section>
      </main>
    </>,
  )
  const state = k.sectionState("p", "slice", SPEC)
  const q = <T extends Element>(sel: string): T => {
    const hit = el.querySelector<T>(sel)
    if (!hit) throw new Error(`missing ${sel}`)
    return hit
  }
  return { el, k, state, host, q }
}

// React reads inputs through its value tracker, so writes go through the prototype setter before the event
const setNative = (el: HTMLInputElement, v: string, type: "input" | "change" = "input") => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, v)
  el.dispatchEvent(new Event(type, { bubbles: true }))
}
const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }))

describe("SpecPanel rows", () => {
  it("renders one row per field with pin · label · control · value · reroll, statics in their own group", () => {
    const { q, el } = mountSection()
    expect(el.querySelectorAll(".kit-panel .kit-row")).toHaveLength(5)
    const row = q<HTMLElement>('.kit-row[data-kind="range"]')
    expect(row.querySelector("input.kit-pin")).not.toBeNull()
    expect(row.querySelector("label")?.textContent).toBe("cut")
    expect(row.querySelector('input[type="range"]')).not.toBeNull()
    expect(row.querySelector("output")?.textContent).toBe("10")
    expect(row.querySelector("button.kit-roll")).not.toBeNull()
    expect(q(".kit-group.kit-static").querySelectorAll(".kit-row")).toHaveLength(1)
    expect(q('.kit-group[data-group="look"]').querySelectorAll(".kit-row")).toHaveLength(2)
  })

  it("a range edit lands in values, the output, the body, and the url as replace", () => {
    const { q, state, host } = mountSection()
    act(() => setNative(q("#kit-slice-cut"), "20"))
    expect(state.values.$().cut).toBe(20)
    expect(q("#kit-slice-cut + datalist").previousElementSibling).not.toBeNull()
    expect(q('.kit-row[data-kind="range"] output').textContent).toBe("20")
    expect(q('[data-testid="out"]').textContent).toBe("cut=20 seed=1")
    expect(host.writes.at(-1)).toEqual(["?slice.cut=20", "replace"])
  })

  it("a pinned field survives shuffle and prints in the url; reroll changes one field with one push", () => {
    const { q, state, host } = mountSection()
    act(() => setNative(q("#kit-slice-cut"), "33"))
    act(() => q<HTMLInputElement>('input.kit-pin[data-pin="cut"]').click())
    expect(host.writes.at(-1)?.[0]).toBe("?slice.cut=33&slice.pin=cut")
    act(() => q<HTMLButtonElement>("button.kit-shuffle").click())
    expect(state.values.$().cut).toBe(33)
    expect(state.values.$().seed).not.toBe(1)
    expect(host.writes.at(-1)?.[1]).toBe("push")
    const seed = state.values.$().seed
    const n = host.writes.length
    act(() => q<HTMLButtonElement>('.kit-row[data-kind="seed"] button.kit-roll').click())
    expect(state.values.$().cut).toBe(33)
    expect(state.values.$().seed).not.toBe(seed)
    expect(host.writes.length).toBe(n + 1)
  })

  it("every control in the drawer carries a tooltip on itself, its label, or its row", () => {
    const { el } = mountSection()
    const untitled = [...el.querySelectorAll<HTMLElement>(".kit-drawer input, .kit-drawer select, .kit-drawer button")]
      .filter(e => !(e.title || e.closest("label")?.title || e.closest<HTMLElement>(".kit-row")?.title))
      .map(e => e.tagName + (e.id || e.dataset.key || e.textContent))
    expect(untitled).toEqual([])
    expect(el.querySelector<HTMLElement>('.kit-row[data-kind="range"]')?.title).toContain("how deep the cut goes")
  })
})

describe("StateCombo", () => {
  it("Enter on a new name forks the current values; Enter on an existing name overwrites it", () => {
    const { q, state } = mountSection()
    const input = q<HTMLInputElement>(".kit-combo input")
    act(() => setNative(q("#kit-slice-cut"), "5"))
    act(() => input.focus())
    act(() => setNative(input, "tight"))
    act(() => void key(input, "Enter"))
    expect(state.states.$().map(s => s.name)).toEqual(["tight"])
    const id = state.states.$()[0].id
    expect(state.selected.$()).toBe(id)
    expect(q(".kit-sync").textContent).toBe("●")
    act(() => setNative(q("#kit-slice-cut"), "6"))
    expect(state.states.$()[0].vals.cut).toBe(6)
    act(() => input.focus())
    act(() => setNative(input, "tight"))
    act(() => void key(input, "Enter"))
    expect(state.states.$()).toHaveLength(1)
    expect(state.states.$()[0].id).toBe(id)
  })

  it("typing an existing name exactly loads it as a push; star and delete act per row; delete clears selected", () => {
    const { q, state, host, el } = mountSection()
    act(() => state.set({ cut: 7 }))
    act(() => state.save("seven"))
    act(() => state.select(null))
    act(() => state.set({ cut: 8 }))
    const input = q<HTMLInputElement>(".kit-combo input")
    act(() => input.focus())
    act(() => setNative(input, "seven"))
    expect(state.values.$().cut).toBe(7)
    expect(host.writes.at(-1)).toEqual(["?slice.cut=7", "push"])
    const id = state.states.$()[0].id
    expect(state.selected.$()).toBe(id)
    act(() => q<HTMLButtonElement>(`.kit-combo li[data-id="${id}"] button[title="star"]`).click())
    expect(state.states.$()[0].star).toBe(true)
    expect(el.querySelector(`.kit-combo li[data-id="${id}"] button.name`)?.textContent).toContain("★ seven")
    act(() => q<HTMLButtonElement>(`.kit-combo li[data-id="${id}"] button[title="delete"]`).click())
    expect(state.states.$()).toEqual([])
    expect(state.selected.$()).toBeNull()
    expect(q(".kit-sync").textContent).toBe("○")
  })

  it("ArrowDown twice then Enter loads the second row", () => {
    const { q, state } = mountSection()
    act(() => state.set({ cut: 1 }))
    act(() => state.save("one"))
    act(() => state.set({ cut: 2 }))
    act(() => state.save("two"))
    act(() => state.select(null))
    act(() => state.set({ cut: 3 }))
    const input = q<HTMLInputElement>(".kit-combo input")
    act(() => input.focus())
    expect(q(".kit-combo").hasAttribute("data-open")).toBe(true)
    act(() => void key(input, "ArrowDown"))
    act(() => void key(input, "ArrowDown"))
    expect(q(".kit-combo li.active button.name").textContent).toContain("two")
    act(() => void key(input, "Enter"))
    expect(state.values.$().cut).toBe(2)
    expect(state.selected.$()).toBe(state.states.$()[1].id)
    expect(q(".kit-combo").hasAttribute("data-open")).toBe(false)
  })
})

describe("Drawer + NavTabs", () => {
  it("folding the drawer shrinks --kit-drawer to the summary line and the section title sticks right under it", async () => {
    const { q } = mountSection()
    const details = q<HTMLDetailsElement>("details.kit-drawer")
    const summary = q<HTMLElement>("details.kit-drawer > summary")
    const px = (name: string) => Number.parseFloat(document.documentElement.style.getPropertyValue(name))
    await vi.waitFor(() => expect(px("--kit-drawer")).toBeGreaterThan(summary.offsetHeight + 40))
    act(() => summary.click())
    expect(details.open).toBe(false)
    await vi.waitFor(() => expect(px("--kit-drawer")).toBe(details.offsetHeight))
    expect(px("--kit-drawer")).toBeLessThan(summary.offsetHeight + 4)
    const title = q<HTMLElement>("h2.kit-sec-title")
    expect(Number.parseFloat(getComputedStyle(title).top)).toBe(px("--kit-top") + px("--kit-drawer"))
  })

  it("tab x positions do not move when the anchor row grows from 3 to 12", () => {
    const tabs = [
      { id: "eye", href: "#/eye", current: true },
      { id: "slice", href: "#/slice" },
      { id: "arches", href: "#/arches" },
    ]
    const few = Array.from({ length: 3 }, (_, i) => ({ id: `s${i}`, label: `section ${i}` }))
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, label: `a much longer section name ${i}` }))
    const xs = () => [...document.querySelectorAll("a[data-tab]")].map(a => Math.round(a.getBoundingClientRect().x))
    mount(<NavTabs tabs={tabs} anchors={few} title="t" />)
    const before = xs()
    expect(before).toHaveLength(3)
    act(() => root?.render(<NavTabs tabs={tabs} anchors={many} title="t" />))
    expect(document.querySelectorAll(".kit-anchor")).toHaveLength(12)
    expect(xs()).toEqual(before)
    expect(document.querySelector('a[data-tab="eye"]')?.getAttribute("aria-current")).toBe("page")
  })
})
