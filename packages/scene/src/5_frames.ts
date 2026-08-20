import {
  concatMap,
  defer,
  from,
  map,
  type Observable,
  type OperatorFunction,
  of,
  pairwise,
  startWith,
  switchMap,
} from "rxjs"
import type { Diff, Frame, Geometry, Layout, Scene, Tween } from "./0_types"
import { diff, enterAll } from "./1_diff"

const keepAllCache = new WeakMap<Scene, Diff>()
const keepAll = (scene: Scene): Diff => {
  let d = keepAllCache.get(scene)
  if (!d) {
    d = { keep: [...scene.items.keys()], enter: [], exit: [] }
    keepAllCache.set(scene, d)
  }
  return d
}

/** `(scene, geometry)` after layout, with the membership diff against the previous scene. */
export type Keyframe = { scene: Scene; geometry: Geometry; diff: Diff }

/** scene$ -> keyframe$. Sync layouts emit inline; a pending async layout is dropped when a newer scene arrives. Re-emitting the same `Scene` object skips the diff. */
export function keyframes(layout: Layout): OperatorFunction<Scene, Keyframe> {
  return scene$ =>
    scene$.pipe(
      startWith(undefined),
      pairwise(),
      switchMap(([prev, scene]) => {
        if (!scene) return of()
        const d = prev === scene ? keepAll(scene) : prev ? diff(prev.items.keys(), scene.items.keys()) : undefined
        return defer(() => {
          const laid = layout(scene)
          return laid instanceof Promise ? from(laid) : of(laid)
        }).pipe(map(geometry => ({ scene, geometry, diff: d ?? enterAll(geometry.ids) })))
      }),
    )
}

/** keyframe$ -> frame$, one frame per `clock` tick. The keyframe's diff rides every frame so exits stay visible until `t` reaches 1. */
export function frames(tweenFn: Tween, clock: Observable<number>): OperatorFunction<Keyframe, Frame> {
  return keyframe$ => {
    let last: Geometry | undefined
    let buffer: Float32Array | undefined
    return keyframe$.pipe(
      concatMap(key => {
        const fromGeometry = last
        last = key.geometry
        if (!fromGeometry) return of<Frame>(key)
        if (!buffer || buffer.length !== key.geometry.pos.length) buffer = new Float32Array(key.geometry.pos.length)
        const out = buffer
        return clock.pipe(
          map(
            (t): Frame => ({
              scene: key.scene,
              diff: key.diff,
              geometry: tweenFn(fromGeometry, key.geometry, key.diff, t, out),
            }),
          ),
        )
      }),
    )
  }
}
