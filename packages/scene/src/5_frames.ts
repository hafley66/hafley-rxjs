import {
  defer,
  from,
  map,
  type Observable,
  type OperatorFunction,
  of,
  pairwise,
  startWith,
  switchMap,
  tap,
} from "rxjs"
import type { Diff, Frame, Geometry, Layout, Scene, Tween } from "./0_types"
import { diff, enterAll } from "./1_diff"

const keepAllCache = new WeakMap<Scene, Diff>()
const keepAll = (scene: Scene): Diff => {
  let d = keepAllCache.get(scene)
  if (!d) {
    d = { keep: Object.keys(scene), enter: [], exit: [] }
    keepAllCache.set(scene, d)
  }
  return d
}

/** `(scene, geometry)` after layout, with the membership diff against the previous scene. */
export type Keyframe = { scene: Scene; geometry: Geometry; diff: Diff }

/** scene$ -> keyframe$. Sync layouts emit inline; a pending async layout is dropped when a newer scene arrives. Re-emitting the same `Scene` object skips the diff. */
export function keyframes(layout: Layout): OperatorFunction<Scene, Keyframe> {
  return scene$ =>
    defer(() => {
      let previousGeometry: Geometry | undefined
      return scene$.pipe(
        startWith(undefined),
        pairwise(),
        switchMap(([prev, scene]) => {
          if (!scene) return of()
          const d = prev === scene ? keepAll(scene) : prev ? diff(Object.keys(prev), Object.keys(scene)) : undefined
          return defer(() => {
            const laid = layout(scene, previousGeometry)
            return laid instanceof Promise ? from(laid) : of(laid)
          }).pipe(
            tap(geometry => {
              previousGeometry = geometry
            }),
            map(geometry => ({ scene, geometry, diff: d ?? enterAll(geometry.ids) })),
          )
        }),
      )
    })
}

/** keyframe$ -> frame$, one frame per `clock` tick. The keyframe's diff rides every frame so exits stay visible until `t` reaches 1. */
export function frames(tweenFn: Tween, clock: Observable<number>): OperatorFunction<Keyframe, Frame> {
  return keyframe$ =>
    defer(() => {
      let current: Geometry | undefined
      let firstBuffer: Float32Array | undefined
      let secondBuffer: Float32Array | undefined
      return keyframe$.pipe(
        switchMap(key => {
          const fromGeometry = current
          if (!fromGeometry) {
            current = key.geometry
            return of<Frame>(key)
          }
          const length = key.geometry.pos.length
          if (!firstBuffer || firstBuffer.length !== length) firstBuffer = new Float32Array(length)
          if (!secondBuffer || secondBuffer.length !== length) secondBuffer = new Float32Array(length)
          const out = fromGeometry.pos === firstBuffer ? secondBuffer : firstBuffer
          return clock.pipe(
            map((t): Frame => {
              const geometry = tweenFn(fromGeometry, key.geometry, key.diff, t, out)
              current = geometry
              return { scene: key.scene, diff: key.diff, geometry }
            }),
          )
        }),
      )
    })
}
