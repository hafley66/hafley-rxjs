import type { FC } from "react"
import { SignalReact } from "./3_react.js"

// Wrap a function component so signal reads during render auto-track.
// One wrapper per function (WeakMap cache); reconciliation sees a stable type.
const trackCache = new WeakMap<object, object>()

export function track<T>(type: T): T {
  if (typeof type !== "function") return type
  const fn = type as unknown as Function
  let wrapped = trackCache.get(fn)
  if (!wrapped) {
    wrapped = SignalReact(fn as FC) as unknown as object
    trackCache.set(fn, wrapped)
  }
  return wrapped as unknown as T
}
