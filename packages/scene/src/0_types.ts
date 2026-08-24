import type { MonoTypeOperatorFunction } from "rxjs"

/** Stable identity. The only string that survives into a frame. */
export type Id = string

/** One keyed thing in a scene. `kind` picks the renderer tier; `attrs` is opaque to this package. */
export type Item = {
  id: Id
  kind: string
  parent?: Id
  attrs?: Readonly<Record<string, unknown>>
}

/** Topology at one step. Touched when the step changes, never per frame. */
export type Scene = {
  items: ReadonlyMap<Id, Item>
  edges: ReadonlyMap<Id, readonly [Id, Id]>
}

/** Struct-of-arrays: `pos[2i], pos[2i+1]` is the point for `ids[i]`; `size` is `w, h` pairs; `routes` are `x, y, ...` polylines. */
export type Geometry = {
  ids: readonly Id[]
  pos: Float32Array
  size?: Float32Array
  routes?: ReadonlyMap<Id, Float32Array>
}

/** Membership change between two scenes or geometries, computed once per transition. */
export type Diff = {
  keep: readonly Id[]
  enter: readonly Id[]
  exit: readonly Id[]
}

/** Topology to positions. May run in a worker; `prev` lets incremental layouts keep constancy. */
export type Layout = (scene: Scene, prev?: Geometry) => Geometry | Promise<Geometry>

/** Interpolate two geometries at `t` in `[0, 1]`. Pure; writes into `out` when given. */
export type Tween = (from: Geometry, to: Geometry, diff: Diff, t: number, out?: Float32Array) => Geometry

/** What a renderer receives per emission. */
export type Frame = {
  scene: Scene
  geometry: Geometry
  diff: Diff
}

/** An operator bound to a host: subscribe = mount, next = draw, unsubscribe = unmount. `frame$.pipe(pixi(el)).subscribe()` */
export type Renderer<T = Frame> = (host: HTMLElement) => MonoTypeOperatorFunction<T>
