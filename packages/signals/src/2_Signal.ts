import { isObservable, Observable, type OperatorFunction } from "rxjs"
import {
  createComputedSignal,
  signalFromObservable,
  SignalCreator,
  type ComputeBody,
  type ComputedOptions,
} from "./1_SignalCreator.js"
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
export function Signal<T>(scan: ComputeBody<T>, seed: T, options?: ComputedOptions): SignalType<T>
export function Signal<T>(state: T): SignalType<T>
export function Signal<T>(): SignalType<T | undefined>
export function Signal<T>(
  obs_or_state?: Observable<T> | T,
  defaults?: T,
  options?: ComputedOptions,
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

  // Function source is automatic derived state. Arity 1 receives its own
  // previous value (scan) and may return a stream (expand). fn.length counts
  // params before the first default, so `(prev = x) =>` reads as arity 0.
  if (typeof obs_or_state === "function") {
    if ((obs_or_state as Function).length >= 1) {
      return createComputedSignal(obs_or_state as ComputeBody<T>, defaults as T, options)
    }
    return createComputedSignal(obs_or_state as ComputeBody<T>)
  }

  // Plain state or undefined
  return SignalCreator({ initialState: obs_or_state })
}

/** Anything a pipeline can start from: a live stream or an existing signal node. */
export type Source$<T> = Observable<T> | SignalType<T>

export function pipe$<T, A>(source: Source$<T>, op1: OperatorFunction<T, A>): SignalType<A>
export function pipe$<T, A, B>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>): SignalType<B>
export function pipe$<T, A, B, C>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>): SignalType<C>
export function pipe$<T, A, B, C, D>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>): SignalType<D>
export function pipe$<T, A, B, C, D, E>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>): SignalType<E>
export function pipe$<T, A, B, C, D, E, F>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>): SignalType<F>
export function pipe$<T, A, B, C, D, E, F, G>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>): SignalType<G>
export function pipe$<T, A, B, C, D, E, F, G, H>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>, op8: OperatorFunction<G, H>): SignalType<H>
export function pipe$<T, A, B, C, D, E, F, G, H, I>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>, op8: OperatorFunction<G, H>, op9: OperatorFunction<H, I>): SignalType<I>
export function pipe$<T, A, B, C, D, E, F, G, H, I, J>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>, op8: OperatorFunction<G, H>, op9: OperatorFunction<H, I>, op10: OperatorFunction<I, J>): SignalType<J>
export function pipe$(
  source: Source$<unknown>,
  ...operators: Array<OperatorFunction<unknown, unknown>>
): SignalType<unknown> {
  const source$ = isSignal(source)
    ? (source.$ as unknown as Observable<unknown>)
    : (source as Observable<unknown>)
  return signalFromObservable(
    source$.pipe(...(operators as [OperatorFunction<unknown, unknown>])),
    undefined,
  )
}
