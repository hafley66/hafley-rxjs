import { isObservable, Observable } from "rxjs"
import { SignalCreator } from "./1_SignalCreator.js"
import type { Signal as SignalType } from "./0_types.js"

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
export function Signal<T>(state: T): SignalType<T>
export function Signal<T>(): SignalType<T | undefined>
export function Signal<T>(
  obs_or_state?: Observable<T> | T,
  defaults?: T
): SignalType<T> {
  // Observable source
  if (isObservable(obs_or_state)) {
    return SignalCreator({
      initialState: defaults,
      observable: obs_or_state,
    })
  }

  // Plain state or undefined
  return SignalCreator({ initialState: obs_or_state })
}
