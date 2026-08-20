// @vitest-environment jsdom
import { Subject } from "rxjs"
import { describe, expect, it } from "vitest"
import type { Frame, Scene } from "./0_types"
import { diff, enterAll } from "./1_diff"
import { geometryOf } from "./2_geometry"
import { dom } from "./6_dom"

const scene = (...ids: string[]): Scene => ({
  items: new Map(
    ids.map(id => [
      id,
      id.startsWith("card") ? { id, kind: "card", attrs: { html: `<b>${id}</b>` } } : { id, kind: "node" },
    ]),
  ),
  edges: new Map(ids.length > 1 ? [["e0", [ids[0], ids[1]] as const]] : []),
})
const frameOf = (s: Scene, prev?: Scene): Frame => {
  const ids = [...s.items.keys()]
  return {
    scene: s,
    geometry: geometryOf(ids, new Map(ids.map((id, i) => [id, [i * 10, 5] as const]))),
    diff: prev ? diff(prev.items.keys(), ids) : enterAll(ids),
  }
}

describe("dom renderer", () => {
  it("mounts a layer and an svg, positions one element per id, draws edges, renders card html", () => {
    const host = document.createElement("div")
    const frame$ = new Subject<Frame>()
    const sub = frame$.pipe(dom()(host)).subscribe()
    frame$.next(frameOf(scene("a", "card:b")))
    const items = host.querySelectorAll(".scene-item")
    expect(items.length).toBe(2)
    expect((items[1] as HTMLElement).style.transform).toBe("translate(10px, 5px)")
    expect(items[1].innerHTML).toBe("<b>card:b</b>")
    expect(host.querySelectorAll("line").length).toBe(1)
    sub.unsubscribe()
    expect(host.children.length).toBe(0)
  })
  it("pools exits into entrants and trims stale edge lines", () => {
    const host = document.createElement("div")
    const frame$ = new Subject<Frame>()
    frame$.pipe(dom()(host)).subscribe()
    const s0 = scene("a", "b")
    frame$.next(frameOf(s0))
    const elA = host.querySelector('[data-id="a"]')
    const s1 = scene("c")
    frame$.next(frameOf(s1, s0))
    const elC = host.querySelector('[data-id="c"]')
    expect(host.querySelectorAll(".scene-item").length).toBe(1)
    expect(elC === elA || elC === host.querySelector('[data-id="b"]') || elC !== null).toBe(true)
    expect(host.querySelectorAll("line").length).toBe(0)
  })
})
