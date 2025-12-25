import type { Draft } from "immer"
import type { BehaviorSubject, Observable } from "rxjs"

/**
 * Depth limiter for recursive proxy types.
 * Prevents TypeScript from exploding on deeply nested structures.
 */
export type DepthLimit = [never, 0, 1, 2, 3, 4, 5, 6]

/**
 * Action type for signal events
 */
export type Act<T extends string, V> = {
  type: T
  value: V
}

/**
 * The core signal accessor - extends BehaviorSubject with call signatures.
 * Named $ because it proxies a BehaviorSubject. jQuery reborn.
 *
 * @example
 * ```ts
 * signal.user.name.$        // the accessor (is a BehaviorSubject)
 * signal.user.name.$()      // sync read (shorthand for $.value)
 * signal.user.name.$("new") // sync write (shorthand for $.next())
 * signal.user.name.$.pipe() // RxJS operators (inherited from BS)
 * signal.user.name.$.$      // meta events stream
 * signal.user.name.$.use()  // React hook (if react integration enabled)
 * ```
 */
export interface Signal$<T, Base extends object = object> extends BehaviorSubject<T> {
  /** Sync read current value (shorthand for $.value) */
  (): T
  /** Sync write next value, returns the signal for chaining */
  (next: T): Signal<T, Base>
  /** Immer-style mutation */
  setImmer: (recipe: (draft: Draft<T>) => void | Draft<T>) => void
  /** Path from root signal */
  path: string[]
  /** Meta events stream for this signal */
  $: Observable<SignalEvent<T, Base>>
  /** ID getter/setter for debugging */
  id: {
    (setId: string): Signal<T, Base>
    (): string
  }
  /** React hook - auto re-renders on change. Only available with /react import */
  use?: () => T
}

/**
 * A signal node. Access `.$` for the reactive accessor,
 * or traverse properties to get child signals.
 *
 * The optional `Base` type param allows extensions (like FormSignal)
 * to attach additional properties at each node via `$field`.
 *
 * @example
 * ```ts
 * const state = Signal({ user: { name: "chris" } })
 *
 * state.user.name.$()           // "chris"
 * state.user.name.$("new name") // write
 * state.user.name.$.pipe(...)   // RxJS
 * state.user.name.$.$           // events
 *
 * // With Base extension (e.g. FormSignal):
 * form.user.name.$field.state   // { errors, isDirty, ... }
 * form.user.name.$field.props   // { input, label, ... }
 * ```
 */
export type Signal<T, Base extends object = object, Depth extends number = 5> = {
  /** The reactive accessor - read, write, subscribe, pipe */
  $: Signal$<T, Base>
} & (keyof Base extends never
  ? unknown
  : { /** Extension namespace for plugins (e.g. form state) */ $field: Base }
) & (Depth extends never
  ? unknown
  : IsRecursive<NonNullable<T>> extends 1
    ? {
        [K in keyof NonNullable<T>]-?: Signal<
          GetNestedValue<T, K>,
          Base,
          DepthLimit[Depth]
        >
      } & (NonNullable<T> extends unknown[]
        ? Record<number, Signal<GetNestedValue<T, number>, Base, DepthLimit[Depth]>>
        : unknown)
    : unknown)

/**
 * Get nested value type, preserving undefined when parent might be null/undefined
 */
export type GetNestedValue<T, K> = IsNullish<T> extends true
  ? K extends keyof NonNullable<T>
    ? NonNullable<T>[K] | undefined
    : never
  : K extends keyof T
    ? T[K]
    : never

/**
 * Check if type includes null or undefined
 */
export type IsNullish<T> = null extends T ? true : undefined extends T ? true : false

/**
 * Check if type should have recursive proxy properties
 */
export type IsRecursive<T> = NonNullable<T> extends Record<string, unknown>
  ? NonNullable<T> extends never
    ? 0
    : 1
  : NonNullable<T> extends unknown[]
    ? 1
    : 0

/**
 * Events emitted by the signal system for tracking/debugging/memo
 */
export type SignalEvent<T, Base extends object = object> =
  | Act<"create", { signal: Signal<T, Base>; path: string[] }>
  | Act<"subscribe", { signal: Signal<T, Base>; path: string[] }>
  | Act<"get", { signal: Signal<T, Base>; path: string[] }>
  | Act<"set", { signal: Signal<T, Base>; path: string[]; value: T }>
  | Act<"unsubscribe", { signal: Signal<T, Base>; path: string[] }>

/**
 * Options for creating a signal
 */
export type SignalCreatorOptions<T, Base extends object = object> = {
  initialState?: T
  observable?: Observable<T>
  /** Factory to create Base extension for each node */
  createBase?: (root: Signal<T, Base>, path: string[]) => Base
}
