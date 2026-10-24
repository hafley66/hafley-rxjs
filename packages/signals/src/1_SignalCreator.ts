import { Draft, isDraftable, produce } from "immer"
import lodash from "lodash"
import {
  BehaviorSubject,
  distinctUntilChanged,
  filter,
  identity,
  isObservable,
  type MonoTypeOperatorFunction,
  map,
  merge,
  Observable,
  type OperatorFunction,
  Subject,
  shareReplay,
  from as streamOf,
  tap,
} from "rxjs"
import {
  CAT_COMPUTE,
  CAT_EMIT,
  CAT_INVALIDATE,
  CAT_SELECTOR,
  CAT_SUBSCRIBE,
  CAT_UNSUBSCRIBE,
  CAT_WRITE,
  LOG,
} from "./0_log.js"
import type { Signal, Signal$, SignalCreatorOptions, SignalEvent } from "./0_types.js"

type ValidDraftReturn<T> = T | void | undefined

const { get, set, isEqual } = lodash

const ROOT_PATH: string[] = []

/**
 * Global dispatch for signal events. Used by Signal.memo() to track dependencies.
 */
export const signalDispatch = new Subject<SignalEvent<unknown>>()

/** Postfix `$` methods plugged into every node by later modules — `12_match.ts` wires
 * `match$` and `switch$`. The node proxy's `get` consults this before creating children;
 * each entry receives the node and returns the method bound to it. Declared here so the
 * core stays free of any one plugin's knowledge. Types live on the `Signal` type; this
 * bridge is deliberately loose. */
export const special$: { [method: string]: (node: unknown) => (handlers: never) => unknown } = {}

/** One level deep, which is what immer's structural sharing already gives per branch. */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a as object)
  const kb = Object.keys(b as object)
  if (ka.length !== kb.length) return false
  for (const key of ka) {
    if (!Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false
  }
  return true
}

/** The default distinction for a nested-path selector. */
export const distinctShallow = <T>(): MonoTypeOperatorFunction<T> => distinctUntilChanged<T>(shallowEqual)

/**
 * The nested-path selector is a fixed pipeline and a slot is its pipe index, so a caller swaps one
 * operator without restating the rest. `distinct` is the only slot today: pass `null` for the
 * pre-2026-09-10 behaviour, where a sibling write re-emitted an unchanged branch.
 */
export const SELECTOR_SLOT = { project: 0, distinct: 1, track: 2, share: 3 } as const

// Memo dependency tracking is stack-scoped rather than derived from the global
// debug stream. With nested memos, only the innermost active computation owns
// reads of its primitive dependencies; the outer memo depends on the inner memo
// itself. A global subscription would make the outer computation accidentally
// collect both layers and can create duplicate cascades.
/** Answers whether the computation in flight sees an event's current value: an event is an edge,
 * so a memo sees each version once and reads `undefined` on later runs. */
export type EdgeReader = (node: Signal<unknown>, version: number) => boolean
/** One computation in flight: where its reads are collected, and its edge rule if it has one. */
type Frame = { collect: (signal: Signal<unknown>) => void; edge?: EdgeReader }
const frames: Frame[] = []

let signalSeq = 0

// One root write emits into every nested-path selector a memo subscribed to, and each delivery
// invalidates that memo separately. Recomputing inline ran a 50k-row sort once per dependency
// instead of once per write. The emit turn brackets `state$.next`, so an invalidation raised
// inside it records the memo and the drain runs each one exactly once, after the last delivery.
let emitDepth = 0
const pendingFlush = new Map<() => void, number>()

export function inEmitTurn<T>(run: () => T): T {
  emitDepth++
  try {
    return run()
  } finally {
    emitDepth--
    if (emitDepth === 0 && pendingFlush.size) {
      // The drain is a turn too, else a diamond's first leg recomputed the join inline and the
      // second leg did it again. Lowest rank first: an input pulled early would deliver again.
      emitDepth++
      try {
        while (pendingFlush.size) {
          let due!: () => void
          let lowest = Infinity
          for (const [flush, rank] of pendingFlush) {
            if (rank < lowest) {
              lowest = rank
              due = flush
            }
          }
          pendingFlush.delete(due)
          due()
        }
      } finally {
        emitDepth--
      }
    }
  }
}

// A memo's rank is one above the highest rank it read; a plain signal reads as 0. The stack holds
// the rank being built for each compute in flight, and a memo read adds itself to the top frame.
const computingRanks: number[] = []

// Run `compute`, recording every `.$()` signal read into `sink`. Re-throws;
// `sink` keeps deps observed before the throw so a caller can resubscribe.
export function trackDependencies<T>(compute: () => T, sink: Set<Signal<unknown>>): T {
  frames.push({ collect: dep => sink.add(dep) })
  try {
    return compute()
  } finally {
    frames.pop()
  }
}

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
  options: SignalCreatorOptions<T, Base>,
): Signal<T, Base> {
  const { initialState, observable, event = false, read, write, createBase, publish } = options

  // A source that multicasts itself and publishes its own writes needs no subject of its own.
  const state$ = publish
    ? undefined
    : event || (observable && initialState === undefined)
      ? new Subject<T>()
      : new BehaviorSubject(initialState as T)
  let latest = initialState as T
  // Surrogate id of this tree and the count of writes to it: every child node shares both.
  const sid = ++signalSeq
  let version = 0

  // `from` is the path of the write that caused the emit, not of the subject, which always sits
  // at the root: the whole point of the record is naming which branch moved.
  const pushState = (next: T, from: string[] = ROOT_PATH) => {
    latest = next
    version++
    // A writable memo mirrors the value into its own holder before the emit, so the next run of
    // the body reads what was written as `prev`.
    write?.(next)
    if (LOG.on) {
      LOG.emit(CAT_EMIT, "emit {path}", {
        path: from,
        observerCount: (state$ as Subject<T> | undefined)?.observers.length ?? 0,
      })
    }
    inEmitTurn(() => (publish ? publish(next) : state$!.next(next)))
  }

  // If an observable source is provided, pipe it into the state
  const root$: Observable<T> = publish
    ? observable!
    : !observable
      ? state$!
      : merge(
          state$!,
          observable.pipe(
            tap({
              next: next => {
                latest = next
              },
            }),
          ),
        ).pipe(shareReplay({ refCount: true, bufferSize: 1 }))

  // Track active subscriptions for debugging/cleanup
  const activeSubs: Signal<T, Base>[] = []

  const createProxy = (_path: string[], base?: Base): Signal<T, Base> => {
    // Filter out symbols that might sneak through
    const path = _path.filter(i => typeof i === "string")
    const depth = path.length

    // Immer-based setter for complex mutations
    const setterImmer = (recipe: (draft: Draft<T>) => ValidDraftReturn<Draft<T>>) => {
      const root = read ? read() : latest
      const curr = depth ? get(root, path) : root
      if (isDraftable(curr)) {
        const next = produce(curr as Draft<T>, recipe)
        return setter(next as T)
      }
    }

    // Direct setter - handles both root and nested paths
    const applySet = (n: T) => {
      if (!depth) {
        return pushState(n, path)
      }

      // Deep set with lodash on an immer draft
      const next = produce(((read ? read() : latest) || {}) as object, (draft: Draft<object>) => {
        set(draft, path, n)
      })

      return pushState(next as T, path)
    }

    // The branch is duplicated so the unlogged path costs exactly one boolean read.
    const setter = (n: T) => {
      if (!LOG.on) return applySet(n)

      const started = performance.now()
      const hasSubscribers = ((state$ as Subject<T> | undefined)?.observers.length ?? 0) > 0 || activeSubs.length > 0
      const result = applySet(n)
      LOG.emit(CAT_WRITE, "write {path}", {
        path,
        depth,
        hasSubscribers,
        durationMs: performance.now() - started,
      })
      return result
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
            let toReturn: unknown
            const next = produce(context, draft => {
              const funcName = path[path.length - 1]
              toReturn = (draft as unknown as Record<string, (...a: unknown[]) => unknown>)[funcName](...args)
            })

            if (!isEqual(next, context)) {
              const parent: Signal<unknown, Base> = depth > 1 ? get(rootProxy, path.slice(0, -1)) : rootProxy
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
            value: { signal: proxy as unknown as Signal<unknown>, path, value: args[0] },
          })
          return proxy
        }
        signalDispatch.next({
          type: "get",
          value: { signal: proxy as unknown as Signal<unknown>, path },
        })
        // An event read is tracked like any other, so a write pushes a rerun, and it is an edge:
        // the reader in flight decides whether this version was already seen.
        const frame = frames.at(-1)
        frame?.collect(proxy as unknown as Signal<unknown>)
        if (event && frame?.edge && !frame.edge(proxy as unknown as Signal<unknown>, version)) return undefined as T
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
        if (p === "sid") return sid

        // `pipe` hands back an Observable, which is right for composition and wrong for storage.
        // `pipe$` runs the same operators and wraps the result, so a piped stream keeps `.$()`,
        // the proxy dots, and this node's distinction slot.
        if (p === "pipe$") {
          return (...operators: Array<OperatorFunction<unknown, unknown>>) => {
            const source$ = ($proxy as unknown as Observable<unknown>).pipe(
              ...(operators as [OperatorFunction<unknown, unknown>]),
            )
            return SignalCreator({
              observable: source$,
              distinct: options.distinct as SignalCreatorOptions<unknown>["distinct"],
            })
          }
        }

        // Meta events stream ($.$)
        if (p === "$") {
          return signalDispatch.pipe(filter(i => (i.value.signal as unknown) === (proxy as unknown)))
        }

        // Cache hit
        if (p in target) return (target as unknown as Record<string | symbol, unknown>)[p]

        // Lazy match BehaviorSubject/Observable methods
        if (p in root$) {
          let autoSelector$ = root$ as Observable<unknown>

          if (depth) {
            // Scoped selector for nested paths
            if (LOG.on) LOG.emit(CAT_SELECTOR, "selector {path} {reason}", { path, reason: "create" })
            // SELECTOR_SLOT.distinct. Without it a write to any branch re-emits every other
            // branch's selector, and a computed downstream re-runs its whole body: one colWidth
            // write was re-sorting 50k rows through the `sort` selector.
            const distinct = options.distinct === undefined ? distinctShallow<unknown>() : options.distinct
            autoSelector$ = root$.pipe(
              map(i => get(i, path)),
              distinct === null ? identity : distinct,
              tap({
                subscribe: () => {
                  if (LOG.on) {
                    LOG.emit(CAT_SELECTOR, "selector {path} {reason}", { path, reason: "resubscribe" })
                  }
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
          return ((target as unknown as Record<string | symbol, unknown>)[p] ??= it)
        }

        // ID getter/setter
        if (p === "id") {
          return ((target as unknown as Record<string | symbol, unknown>)[p] ??= (setId?: string) => {
            if (setId) {
              ID = setId
              return proxy
            }
            return ID
          })
        }

        // use() hook - placeholder, gets added by /react
        if (p === "use") {
          return (target as unknown as Record<string | symbol, unknown>)[p]
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

    // Main proxy for property traversal. `$`-suffixed names are a reserved namespace: the
    // registry (match$, switch$, … filled by later modules) resolves before state keys.
    const proxy = new Proxy(self, {
      get(target, p) {
        // Known properties
        if (p in target) return (target as Record<string | symbol, unknown>)[p]

        // Symbols pass through
        if (typeof p === "symbol") {
          return (target as Record<string | symbol, unknown>)[p]
        }

        // Plugged postfix methods — node-level graph verbs.
        if (Object.hasOwn(special$, p)) return special$[p](proxy)

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
let computedSeq = 0

/** Same shape as Solid 2.0 `ComputeFunction<Prev, Next>`: a value, or a stream of values. */
export type ComputeResult<T> = T | Observable<T> | PromiseLike<T> | AsyncIterable<T>

/** Arity 1 is the scan form: the body is handed its own previous value. */
export type ComputeBody<T> = (prev: T) => ComputeResult<T>

export type ComputedOptions = {
  /** `.$(next)` overrides the value until the next run, which sees it as `prev`. Default true. */
  writable?: boolean
}

function isStream<T>(value: ComputeResult<T>): value is Observable<T> | PromiseLike<T> | AsyncIterable<T> {
  if (value === null || value === undefined) return false
  if (isObservable(value)) return true
  if (typeof value !== "object" && typeof value !== "function") return false
  if (typeof (value as PromiseLike<T>).then === "function") return true
  return Symbol.asyncIterator in (value as object)
}

/**
 * The body receives the current value as `prev`. A stream result feeds the value one emission at a
 * time: a dependency change cancels it and reruns (switch), completion after at least one emission
 * reruns (expand), completion with none settles until a dependency changes.
 */
/** What a memo holds per dependency: its subscription, and for an event the version it last saw
 * and the run that saw it. */
type DependencyEntry = { sub: { unsubscribe(): void } | undefined; consumed: number; consumedRun: number }

export function createComputedSignal<T>(compute: ComputeBody<T>, seed?: T, options: ComputedOptions = {}): Signal<T> {
  const id = `memo#${++computedSeq}`
  let dirty = true
  let hasValue = arguments.length >= 2
  let value = seed as T
  let running = false
  // A stream that completed asks for another run, and the loop below serves it without recursing.
  let rerun = false
  let streamed = false
  let lastRunFailed = false
  let subscriberCount = 0
  let readPinned = false
  // `recompute("read")` clears `dirty` and notifies nobody, so a downstream pull between an
  // invalidation and its drain would otherwise starve every subscriber of this memo.
  let pushOwed = false
  let rank = 0
  // Counts emissions so a flush can tell whether the run it just made already published. A stream
  // run publishes from its inner subscription, and a second push here would double every value.
  let emitVersion = 0

  const observers = new Set<{ next(value: T): void; error(error: unknown): void }>()
  // Runs of the body, so an event read twice in one run answers the same both times.
  let run = 0
  // An event's edge state rides the dependency entry the memo already keeps for it: the version it
  // last saw and the run that saw it. A first read makes the entry; `syncDependencies` subscribes it.
  const edge: EdgeReader = (node, version) => {
    let entry = dependencySubs.get(node)
    if (!entry) {
      entry = { sub: undefined, consumed: -1, consumedRun: -1 }
      dependencySubs.set(node, entry)
    }
    if (entry.consumed === version) return entry.consumedRun === run
    entry.consumed = version
    entry.consumedRun = run
    return true
  }
  // Keyed by dependency so a recompute diffs instead of rebuilding: tearing every subscription
  // down and re-adding it re-emitted every BehaviorSubject on the way back in.
  const dependencySubs = new Map<Signal<unknown>, DependencyEntry>()
  // The live stream result, and the identity of the run that opened it. A late `complete` from a
  // cancelled run compares tokens and stays quiet.
  let inner: { unsubscribe(): void } | undefined
  let token: object = {}

  const clearDependencies = () => {
    for (const [dependency, entry] of dependencySubs) {
      entry.sub?.unsubscribe()
      if (LOG.on) LOG.emit(CAT_UNSUBSCRIBE, "unsubscribe {id} {path}", { id, path: dependency.$.path })
    }
    dependencySubs.clear()
  }

  const cancelInner = () => {
    token = {}
    inner?.unsubscribe()
    inner = undefined
  }

  // Downstream recomputation may unsubscribe and resubscribe while handling this emission. Iterate
  // a snapshot so a newly added observer is not visited again in the same Set iteration.
  const emit = (next: T) => {
    emitVersion++
    for (const observer of [...observers]) observer.next(next)
  }

  // Returns the diff size so a compute record can say how much of the wiring actually moved.
  const syncDependencies = (deps: Set<Signal<unknown>>) => {
    let added = 0
    let removed = 0
    for (const [dependency, entry] of dependencySubs) {
      if (deps.has(dependency)) continue
      entry.sub?.unsubscribe()
      dependencySubs.delete(dependency)
      removed++
      if (LOG.on) LOG.emit(CAT_UNSUBSCRIBE, "unsubscribe {id} {path}", { id, path: dependency.$.path })
    }
    for (const dependency of deps) {
      const held = dependencySubs.get(dependency)
      if (held?.sub) continue
      let initializing = true
      const sub = dependency.$.subscribe(() => {
        if (!initializing) invalidate(dependency)
      })
      initializing = false
      if (held) held.sub = sub
      else dependencySubs.set(dependency, { sub, consumed: -1, consumedRun: -1 })
      added++
      if (LOG.on) LOG.emit(CAT_SUBSCRIBE, "subscribe {id} {path}", { id, path: dependency.$.path })
    }
    return { added, removed }
  }

  const recompute = (trigger: "read" | "invalidate"): T => {
    if (running) return value
    running = true

    do {
      rerun = false
      cancelInner()
      const started = LOG.on ? performance.now() : 0
      const dependencies = new Set<Signal<unknown>>()
      frames.push({ collect: dependency => dependencies.add(dependency), edge })
      run++
      computingRanks.push(0)

      const report = (diff: { added: number; removed: number }) => {
        if (!LOG.on) return
        LOG.emit(CAT_COMPUTE, "compute {id} {durationMs}ms", {
          id,
          durationMs: performance.now() - started,
          depCount: dependencies.size,
          depsAdded: diff.added,
          depsRemoved: diff.removed,
          trigger,
        })
      }

      let out: ComputeResult<T>
      try {
        out = compute(value)
      } catch (error) {
        frames.pop()
        rank = computingRanks.pop()!
        running = false
        dirty = true
        lastRunFailed = true

        // Preserve the dependencies read before the throw so a later change can recover the memo.
        // A failed recomputation is not an Observable error: it must not permanently terminate
        // this or any composed memo.
        report(syncDependencies(dependencies))

        if (hasValue) return value
        throw error
      }

      frames.pop()
      rank = computingRanks.pop()!
      dirty = false
      lastRunFailed = false
      report(syncDependencies(dependencies))

      streamed = isStream(out)
      if (!streamed) {
        value = out as T
        hasValue = true
        break
      }

      const mine = (token = {})
      let emitted = false
      const sub = streamOf(out as Observable<T>).subscribe({
        next: next => {
          emitted = true
          value = next
          hasValue = true
          emit(next)
        },
        error: error => {
          for (const observer of [...observers]) observer.error(error)
        },
        complete: () => {
          // A run whose token moved on was cancelled, and a stream that emitted nothing settles.
          if (token !== mine || !emitted) return
          inner = undefined
          if (running) rerun = true
          else invalidate()
        },
      })
      if (token === mine && !sub.closed) inner = sub
    } while (rerun)

    running = false
    return value
  }

  const invalidate = (by?: Signal<unknown>) => {
    dirty = true
    const eager = !!subscriberCount && !running
    if (LOG.on) {
      LOG.emit(CAT_INVALIDATE, "invalidate {id} by {by}", { id, by: by ? by.$.path : null, eager })
    }
    if (!eager) return
    pushOwed = true
    // Inside an emit turn every sibling selector is still delivering. Recompute once at the end.
    if (emitDepth > 0) {
      pendingFlush.set(flush, rank)
      return
    }
    // An observable-backed dependency emits outside any turn, so the fan-out opens one.
    inEmitTurn(flush)
  }

  const flush = () => {
    if (!dirty && !pushOwed) return
    pushOwed = false
    const before = emitVersion
    const next = dirty ? recompute("invalidate") : value
    // A stream run publishes from its inner, so the seed surfaces only on first subscribe.
    if (!lastRunFailed && !streamed && before === emitVersion) emit(next)
  }

  const readMemo = () => {
    // A read pins only while nobody subscribes, so a memo used purely by `.$()` stays wired and
    // memoized. Subscribers own the lifetime once present, and the last one leaving releases it.
    if (!subscriberCount) readPinned = true
    const result = dirty || !hasValue ? recompute("read") : value
    const frame = computingRanks.length - 1
    if (frame >= 0) computingRanks[frame] = Math.max(computingRanks[frame], rank + 1)
    return result
  }

  const observable = new Observable<T>(subscriber => {
    subscriberCount++
    readPinned = false
    observers.add(subscriber)

    try {
      const before = emitVersion
      const next = dirty || !hasValue ? recompute("read") : value
      if (before === emitVersion) subscriber.next(next)
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
        cancelInner()
        clearDependencies()
        dirty = true
      }
    }
  })

  const write =
    options.writable !== false
      ? (next: T) => {
          value = next
          hasValue = true
        }
      : undefined

  // The memo multicasts itself and replays its value on subscribe, so a write publishes straight to
  // its observers instead of through a subject merged into a second shared stream.
  return SignalCreator({ observable, read: readMemo, write, publish: emit })
}
