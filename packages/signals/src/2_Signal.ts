import { isObservable, Observable } from "rxjs"
import { createComputedSignal, SignalCreator } from "./1_SignalCreator.js"
import type { Signal as SignalType } from "./0_types.js"

export type Signal<T, Base extends object = object, Depth extends number = 5> = SignalType<T, Base, Depth>

export type SignalSource<T> = SignalType<T> | Observable<T> | (() => T) | T

export function isSignal<T>(value: unknown): value is SignalType<T> {
  if (!value || typeof value !== "object") return false
  const accessor = (value as { $?: unknown }).$
  return typeof accessor === "function" &&
    typeof (accessor as { subscribe?: unknown }).subscribe === "function"
}

/** Normalize any source accepted by Signal while preserving existing Signals. */
export function toSignal<T>(source: SignalSource<T>): SignalType<T> {
  if (isSignal<T>(source)) return source
  return Signal(source as T)
}

/**
 * Create a reactive signal with proxy-based nested access.
 *
 * @example
 * ```ts
 * // From initial state
 * const state = Signal({ user: { name: "chris" } })
 *
 * // From observable (undefined until first emission)
 * const data = Signal(fetch$.pipe(map(r => r.data)))
 *
 * // From observable with default
 * const data = Signal(fetch$, { loading: true })
 * ```
 */
export function Signal<T>(observable: Observable<T>): SignalType<T | undefined>
export function Signal<T>(observable: Observable<T>, defaultState: T): SignalType<T>
export function Signal<T>(memo: () => T): SignalType<T>
export function Signal<T>(state: T): SignalType<T>
export function Signal<T>(): SignalType<T | undefined>
export function Signal<T>(
  obs_or_state?: Observable<T> | T,
  defaults?: T
): SignalType<T> {
  // Bare form is an event signal: lazy/shared Subject semantics, no initial
  // undefined emission and no replay to late subscribers.
  if (arguments.length === 0) {
    return SignalCreator<T>({ event: true })
  }

  // Observable source
  if (isObservable(obs_or_state)) {
    return SignalCreator({
      initialState: defaults,
      observable: obs_or_state,
    })
  }

  // Function source is automatic derived state.
  if (typeof obs_or_state === "function") {
    return createComputedSignal(obs_or_state as () => T)
  }

  // Plain state or undefined
  return SignalCreator({ initialState: obs_or_state })
}
