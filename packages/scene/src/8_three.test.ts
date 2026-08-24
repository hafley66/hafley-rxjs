// @vitest-environment jsdom
import { Subject } from "rxjs"
import { describe, expect, it } from "vitest"
import type { Frame, Scene } from "./0_types"
import { diff, enterAll } from "./1_diff"
import { geometryOf } from "./2_geometry"
import { inspect, three } from "./8_three"

type Views = Map<string, { position: { x: number; y: number } }>
const viewsOf = (host: HTMLElement): Views =>
  (host as HTMLElement & { __threeScene: { views: Views } }).__threeScene.views

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

describe("three renderer", () => {
  it("mounts a css2d layer, places one view per id, renders card html, and reports ids through inspect", () => {
    const host = document.createElement("div")
    document.body.appendChild(host)
    const frame$ = new Subject<Frame>()
    const sub = frame$.pipe(three()(host)).subscribe()
    frame$.next(frameOf(scene("a", "card:b")))
    const info = inspect(host)
    expect(info?.ids).toEqual(["a", "card:b"])
    expect(info?.pooled).toBe(0)
    expect(info?.ready).toBe(true)
    const card = host.querySelector(".scene-card") as HTMLElement
    expect(card.innerHTML).toBe("<b>card:b</b>")
    sub.unsubscribe()
    expect(host.children.length).toBe(0)
    expect(document.querySelectorAll(".scene-card").length).toBe(0)
    expect(inspect(host)?.ready).toBe(false)
    host.remove()
  })

  it("puts a pos pair on the same screen pixel the pixi sink uses, y growing downward", () => {
    const host = document.createElement("div")
    document.body.appendChild(host)
    const frame$ = new Subject<Frame>()
    const sub = frame$.pipe(three()(host)).subscribe()
    frame$.next(frameOf(scene("a", "card:b")))
    // The css2d layer projects through the same OrthographicCamera as the meshes, so its
    // translate is the camera mapping made readable: pos (10, 5) must land on pixel (10, 5).
    const card = host.querySelector(".scene-card") as HTMLElement
    const [x, y] = [...card.style.transform.matchAll(/(-?[\d.]+)px/g)].map(m => Number(m[1]))
    expect(x).toBeCloseTo(10, 3)
    expect(y).toBeCloseTo(5, 3)
    const view = viewsOf(host).get("a")
    expect(view?.position.x).toBe(0)
    expect(view?.position.y).toBe(5)
    sub.unsubscribe()
    host.remove()
  })

  it("pools exited meshes and hands them to the next entrants", () => {
    const host = document.createElement("div")
    document.body.appendChild(host)
    const frame$ = new Subject<Frame>()
    const sub = frame$.pipe(three()(host)).subscribe()
    const s0 = scene("a", "b")
    frame$.next(frameOf(s0))
    const meshA = viewsOf(host).get("a")
    const meshB = viewsOf(host).get("b")
    const s1 = scene("c")
    frame$.next(frameOf(s1, s0))
    const info = inspect(host)
    expect(info?.ids).toEqual(["c"])
    expect(info?.pooled).toBe(1)
    const meshC = viewsOf(host).get("c")
    expect(meshC === meshA || meshC === meshB).toBe(true)
    expect(meshC?.position.x).toBe(0)
    sub.unsubscribe()
    expect(inspect(host)?.pooled).toBe(0)
    host.remove()
  })
})
