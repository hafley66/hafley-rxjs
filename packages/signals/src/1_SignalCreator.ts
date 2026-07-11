import {
  BehaviorSubject,
  filter,
  map,
  merge,
  Observable,
  shareReplay,
  Subject,
  tap,
} from "rxjs"
import { get, set, isEqual } from "lodash"
import { Draft, produce, isDraftable } from "immer"
import type { Signal, Signal$, SignalEvent, SignalCreatorOptions } from "./0_types.js"

type ValidDraftReturn<T> = T | void | undefined

/**
 * Global dispatch for signal events. Used by Signal.memo() to track dependencies.
 */
export const signalDispatch = new Subject<SignalEvent<unknown>>()

// Memo dependency tracking is stack-scoped rather than derived from the global
// debug stream. With nested memos, only the innermost active computation owns
// reads of its primitive dependencies; the outer memo depends on the inner memo
// itself. A global subscription would make the outer computation accidentally
// collect both layers and can create duplicate cascades.
const dependencyCollectors: Array<(signal: Signal<unknown>) => void> = []

/**
 * Creates a signal tree with proxy-based nested access.
 *
 * @example
 * ```ts
 * const state = SignalCreator({ initialState: { user: { name: "chris" } } })
 * state.user.name.$()        // "chris"
 * state.user.name.$("new")   // set
 * state.user.name.$.pipe()   // Observable
 * ```
 */
export function SignalCreator<T, Base extends object = object>(
  options: SignalCreatorOptions<T, Base>
): Signal<T, Base> {
  const { initialState, observable, event = false, read, createBase } = options

  const state$ = event || (observable && initialState === undefined)
    ? new Subject<T>()
    : new BehaviorSubject(initialState as T)
  let latest = initialState as T

  const pushState = (next: T) => {
    latest = next
    state$.next(next)
  }

  // If an observable source is provided, pipe it into the state
  const root$ = !observable
    ? state$
    : merge(
        state$,
        observable.pipe(
          tap({ next: (next) => { latest = next } }),
        ),
      ).pipe(
        shareReplay({ refCount: true, bufferSize: 1 }),
      )

  // Track active subscriptions for debugging/cleanup
  const activeSubs: Signal<T, Base>[] = []

  const createProxy = (
    _path: string[],
    base?: Base,
  ): Signal<T, Base> => {
    // Filter out symbols that might sneak through
    const path = _path.filter((i) => typeof i === "string")
    const depth = path.length

    // Immer-based setter for complex mutations
    const setterImmer = (recipe: (draft: Draft<T>) => ValidDraftReturn<Draft<T>>) => {
      const curr = get(latest, path)
      if (isDraftable(curr)) {
        const next = produce(curr as Draft<T>, recipe)
        return setter(next as T)
      }
    }

    // Direct setter - handles both root and nested paths
    const setter = (n: T) => {
      if (!depth) {
        return pushState(n)
      }

      // Deep set with lodash on an immer draft
      const next = produce((latest || {}) as object, (draft: Draft<object>) => {
        set(draft, path, n)
      })

      return pushState(next as T)
    }

    // Getter - handles root, nested, and function values
    const getter = (): T => {
      const root = read ? read() : latest
      if (!depth) {
        return root
      }

      const val = get(root, path)

      // If value is a function (e.g. array method), bind it properly
      if (typeof val === "function") {
        const context = depth === 1 ? root : get(root, path.slice(0, -1))

        if (Array.isArray(context)) {
          // For array methods, wrap to auto-update state on mutation
          return ((...args: unknown[]) => {
            let toReturn: unknown = undefined
            const next = produce(context, (draft) => {
              const funcName = path[path.length - 1]
              toReturn = (draft as Record<string, (...a: unknown[]) => unknown>)[funcName](...args)
            })

            if (!isEqual(next, context)) {
              const parent: Signal<unknown, Base> =
                depth > 1 ? get(rootProxy, path.slice(0, -1)) : rootProxy
              parent.$.next(next)
            }

            return toReturn
          }) as T
        }
        return val.bind(context)
      }
      return val
    }

    // The callable function for $
    const selfFnName = path.join("/") || "root"
    const selfFn = {
      [selfFnName]: (...args: unknown[]) => {
        if (args.length) {
          setter(args[0] as T)
          signalDispatch.next({
            type: "set",
            value: { signal: proxy as Signal<unknown>, path, value: args[0] },
          })
          return proxy
        }
        signalDispatch.next({
          type: "get",
          value: { signal: proxy as Signal<unknown>, path },
        })
        dependencyCollectors.at(-1)?.(proxy as Signal<unknown>)
        return getter()
      },
    }[selfFnName]

    let ID = ""

    // The $ accessor object - proxied to add BS methods lazily
    const $proxy = new Proxy(selfFn as unknown as Signal$<T, Base>, {
      get(target, p) {
        // Our custom properties
        if (p === "value") return getter()
        if (p === "next") return setter
        if (p === "setImmer") return setterImmer
        if (p === "path") return path

        // Meta events stream ($.$)
        if (p === "$") {
          return signalDispatch.pipe(
            filter((i) => i.value.signal === proxy),
          )
        }

        // Cache hit
        if (p in target) return (target as Record<string | symbol, unknown>)[p]

        // Lazy match BehaviorSubject/Observable methods
        if (p in root$) {
          let autoSelector$ = root$ as Observable<unknown>

          if (depth) {
            // Scoped selector for nested paths
            autoSelector$ = root$.pipe(
              map((i) => get(i, path)),
              tap({
                subscribe: () => {
                  if (!activeSubs.includes(proxy)) {
                    activeSubs.push(proxy)
                  }
                },
                finalize: () => {
                  const idx = activeSubs.indexOf(proxy)
                  if (idx >= 0) {
                    activeSubs.splice(idx, 1)
                  }
                },
              }),
              shareReplay({
                refCount: true,
                bufferSize: 1,
              }),
            )
          }

          let it: unknown = autoSelector$[p as keyof typeof root$]

          // Bind methods to the observable
          if (typeof it === "function") {
            it = (it as (...args: unknown[]) => unknown).bind(autoSelector$)
          }

          // Cache and return
          return ((target as Record<string | symbol, unknown>)[p] ??= it)
        }

        // ID getter/setter
        if (p === "id") {
          return ((target as Record<string | symbol, unknown>)[p] ??= (setId?: string) => {
            if (setId) {
              ID = setId
              return proxy
            }
            return ID
          })
        }

        // use() hook - placeholder, gets added by /react
        if (p === "use") {
          return (target as Record<string | symbol, unknown>)[p]
        }

        return undefined
      },

      // Make $ callable
      apply(_target, _thisArg, args) {
        return selfFn(...args)
      },
    })

    // The signal node object
    const self = {
      $: $proxy,
      ...(base && { $field: base }),
    } as Signal<T, Base>

    // Main proxy for property traversal
    const proxy = new Proxy(self, {
      get(target, p) {
        // Known properties
        if (p in target) return (target as Record<string | symbol, unknown>)[p]

        // Symbols pass through
        if (typeof p === "symbol") {
          return (target as Record<string | symbol, unknown>)[p]
        }

        // Lazy create child signals
        return ((target as Record<string | symbol, unknown>)[p] ??= createProxy(
          [...path, p],
          createBase?.(rootProxy, [...path, p]),
        ))
      },
    })

    return proxy
  }

  const rootProxy = createProxy([], createBase?.(undefined as unknown as Signal<T, Base>, []))

  return rootProxy
}

/**
 * Creates the Observable + synchronous reader used by Signal(fn).
 *
 * A computation discovers dependencies from synchronous signal `get` events.
 * Dependencies are replaced after every run, so conditional branches behave
 * like Solid's createMemo rather than a static combineLatest. The computation
 * is lazy, shared across readers, and keeps its last successful value when a
 * transient computation throws.
 */
export function createComputedSignal<T>(compute: () => T): Signal<T> {
  let dirty = true
  let hasValue = false
  let value: T
  let running = false
  let lastRunFailed = false
  let subscriberCount = 0
  let readPinned = false

  const observers = new Set<{ next(value: T): void }>()
  let dependencySubs: Array<{ unsubscribe(): void }> = []

  const clearDependencies = () => {
    for (const sub of dependencySubs) sub.unsubscribe()
    dependencySubs = []
  }

  const recompute = (): T => {
    if (running) return value
    running = true

    const dependencies = new Set<Signal<unknown>>()
    dependencyCollectors.push((dependency) => dependencies.add(dependency))

    let next: T
    try {
      next = compute()
    } catch (error) {
      dependencyCollectors.pop()
      running = false
      dirty = true
      lastRunFailed = true

      // Preserve the dependencies read before the throw so a later change can
      // recover the memo. A failed recomputation is not an Observable error:
      // it must not permanently terminate this or any composed memo.
      clearDependencies()
      for (const dependency of dependencies) {
        let initializing = true
        const sub = dependency.$.subscribe(() => {
          if (!initializing) invalidate()
        })
        initializing = false
        dependencySubs.push(sub)
      }

      if (hasValue) return value
      throw error
    }

    dependencyCollectors.pop()
    running = false
    value = next
    hasValue = true
    dirty = false
    lastRunFailed = false

    clearDependencies()
    for (const dependency of dependencies) {
      let initializing = true
      const sub = dependency.$.subscribe(() => {
        if (!initializing) invalidate()
      })
      initializing = false
      dependencySubs.push(sub)
    }

    return value
  }

  const invalidate = () => {
    dirty = true
    if (!subscriberCount || running) return

    const next = recompute()
    // Downstream recomputation may unsubscribe and resubscribe while handling
    // this emission. Iterate a snapshot so a newly added observer is not visited
    // again in the same Set iteration (an infinite nested-memo cascade).
    if (!lastRunFailed) for (const observer of [...observers]) observer.next(next)
  }

  const readMemo = () => {
    readPinned = true
    return dirty || !hasValue ? recompute() : value
  }

  const observable = new Observable<T>((subscriber) => {
    subscriberCount++
    observers.add(subscriber)

    try {
      subscriber.next(dirty || !hasValue ? recompute() : value)
    } catch (error) {
      observers.delete(subscriber)
      subscriberCount--
      subscriber.error(error)
      return undefined
    }

    return () => {
      observers.delete(subscriber)
      subscriberCount--
      if (!subscriberCount && !readPinned) {
        clearDependencies()
        dirty = true
      }
    }
  })

  return SignalCreator({ observable, read: readMemo })
}
