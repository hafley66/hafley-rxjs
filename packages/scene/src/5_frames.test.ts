import { from, lastValueFrom, map, of, Subject, toArray } from "rxjs"
import { describe, expect, it } from "vitest"
import type { Frame, Layout, Scene } from "./0_types"
import { geometryOf } from "./2_geometry"
import { tween } from "./3_tween"
import { frames, keyframes } from "./5_frames"

const scene = (...ids: string[]): Scene => ({
  ...Object.fromEntries(ids.map(id => [id, { id, type: "node" as const }])),
})
const rowLayout: Layout = s => {
  const ids = Object.keys(s)
  return geometryOf(ids, new Map(ids.map((id, i) => [id, [i * 10, 0] as const])))
}

describe("keyframes", () => {
  it("lays out each scene and diffs against the previous one", async () => {
    const out = await lastValueFrom(from([scene("a", "b"), scene("b", "c")]).pipe(keyframes(rowLayout), toArray()))
    expect(out.map(k => k.diff)).toEqual([
      { keep: [], enter: ["a", "b"], exit: [] },
      { keep: ["b"], enter: ["c"], exit: ["a"] },
    ])
    expect(Array.from(out[1].geometry.pos)).toEqual([0, 0, 10, 0])
  })
  it("accepts an async layout", async () => {
    const asyncLayout: Layout = async s => rowLayout(s) as ReturnType<typeof rowLayout>
    const out = await lastValueFrom(of(scene("z")).pipe(keyframes(asyncLayout), toArray()))
    expect(out[0].geometry.ids).toEqual(["z"])
  })
  it("passes the previous emitted geometry to the next layout", async () => {
    const previous: Array<readonly string[] | undefined> = []
    const incrementalLayout: Layout = (value, prior) => {
      previous.push(prior?.ids)
      return rowLayout(value)
    }
    await lastValueFrom(from([scene("a"), scene("b")]).pipe(keyframes(incrementalLayout), toArray()))

    expect(previous).toEqual([undefined, ["a"]])
  })
})

describe("frames", () => {
  it("emits the first keyframe as-is, then one tweened frame per clock tick", async () => {
    const clock = of(0, 0.5, 1)
    const snapshot = (f: Frame) => ({ enter: f.diff.enter, exit: f.diff.exit, x: f.geometry.pos[0] })
    const out = await lastValueFrom(
      from([scene("a", "b"), scene("b", "c")]).pipe(
        keyframes(rowLayout),
        frames(tween(), clock),
        map(snapshot),
        toArray(),
      ),
    )
    expect(out).toHaveLength(4)
    expect(out[0].enter).toEqual(["a", "b"])
    expect(out.slice(1).map(f => f.x)).toEqual([10, 5, 0])
    expect(out.slice(1).every(f => f.exit[0] === "a")).toBe(true)
  })
  it("reuses one output buffer across ticks of a transition", async () => {
    const clock = new Subject<number>()
    const seen: Float32Array[] = []
    const sub = from([scene("a"), scene("a")])
      .pipe(keyframes(rowLayout), frames(tween(), clock))
      .subscribe(f => seen.push(f.geometry.pos))
    clock.next(0.2)
    clock.next(0.4)
    sub.unsubscribe()
    expect(seen).toHaveLength(3)
    expect(seen[1]).toBe(seen[2])
  })
  it("allocates transition state for each subscription", async () => {
    const key = {
      scene: scene("a"),
      geometry: rowLayout(scene("a")) as Exclude<ReturnType<typeof rowLayout>, Promise<unknown>>,
      diff: { keep: [], enter: ["a"], exit: [] },
    }
    const operator = frames(tween(), of(0))
    const first = await lastValueFrom(of(key).pipe(operator))
    const second = await lastValueFrom(of(key).pipe(operator))

    expect([first, second]).toEqual([key, key])
  })

  it("continues an interrupted transition from the last emitted geometry", () => {
    const clock = new Subject<number>()
    const keys = new Subject<ReturnType<typeof key>>()
    const positions: number[] = []
    const subscription = keys.pipe(frames(tween(), clock)).subscribe(value => positions.push(value.geometry.pos[0]))

    keys.next(key(0))
    keys.next(key(10))
    clock.next(0.5)
    keys.next(key(20))
    clock.next(0.5)
    subscription.unsubscribe()

    expect(positions).toEqual([0, 5, 12.5])
  })
})

function key(x: number) {
  const value = scene("a")
  return {
    scene: value,
    geometry: geometryOf(["a"], new Map([["a", [x, 0] as const]])),
    diff: { keep: ["a"], enter: [], exit: [] },
  }
}
