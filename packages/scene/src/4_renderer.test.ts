import { Subject } from "rxjs"
import { describe, expect, it } from "vitest"
import type { Frame } from "./0_types"
import { enterAll } from "./1_diff"
import { geometryOf } from "./2_geometry"
import { renderer } from "./4_renderer"

const frame = (id: string): Frame => ({
  scene: { [id]: { id, type: "node" } },
  geometry: geometryOf([id], new Map([[id, [1, 1]]])),
  diff: enterAll([id]),
})

function recording() {
  const log: string[] = []
  const r = renderer(() => {
    log.push("subscribe")
    return {
      render: (f: Frame) => log.push(`next:${f.geometry.ids[0]}`),
      unsubscribe: () => log.push("unsubscribe"),
    }
  })
  return { log, r }
}

describe("renderer", () => {
  it("supports renderer-specific value types", () => {
    const values = new Subject<{ selected: string }>()
    const applied: string[] = []
    const selectedRenderer = renderer<{ selected: string }>(() => ({
      render: value => applied.push(value.selected),
      unsubscribe: () => undefined,
    }))

    const lifetime = values.pipe(selectedRenderer({} as HTMLElement)).subscribe()
    values.next({ selected: "viewport" })
    values.next({ selected: "layout" })
    lifetime.unsubscribe()

    expect(applied).toMatchInlineSnapshot(`
      [
        "viewport",
        "layout",
      ]
    `)
  })

  it("mounts on subscribe, draws on next, unmounts on unsubscribe, and passes frames through", () => {
    const { log, r } = recording()
    const frame$ = new Subject<Frame>()
    const seen: string[] = []
    const sub = frame$.pipe(r({} as HTMLElement)).subscribe(f => seen.push(f.geometry.ids[0]))
    frame$.next(frame("a"))
    frame$.next(frame("b"))
    sub.unsubscribe()
    expect(log).toEqual(["subscribe", "next:a", "next:b", "unsubscribe"])
    expect(seen).toEqual(["a", "b"])
  })
  it("chains two renderers over one frame stream", () => {
    const a = recording()
    const b = recording()
    const frame$ = new Subject<Frame>()
    const sub = frame$.pipe(a.r({} as HTMLElement), b.r({} as HTMLElement)).subscribe()
    frame$.next(frame("x"))
    sub.unsubscribe()
    expect(a.log).toEqual(["subscribe", "next:x", "unsubscribe"])
    expect(b.log).toEqual(["subscribe", "next:x", "unsubscribe"])
  })
  it("errors the subscriber when next throws and still tears down", () => {
    const log: string[] = []
    const r = renderer(() => ({
      render: () => {
        throw new Error("boom")
      },
      unsubscribe: () => log.push("unsubscribe"),
    }))
    const frame$ = new Subject<Frame>()
    const errors: unknown[] = []
    frame$.pipe(r({} as HTMLElement)).subscribe({ error: e => errors.push(e) })
    frame$.next(frame("a"))
    expect(String(errors[0])).toContain("boom")
    expect(log).toEqual(["unsubscribe"])
  })
})
