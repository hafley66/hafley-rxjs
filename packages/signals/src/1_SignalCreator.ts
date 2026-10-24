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
type Listener = { next(): void }
/** One watched path of a tree: who to tell, and the value they last saw (shallow-distinct). */
type Watch = { path: string[]; last: unknown; listeners: Set<Listener>; drop?: (listener: Listener) => void }

function notifyWatches(watched: Map<string, Watch>, next: unknown): void {
  for (const watch of watched.values()) {
    if (watch.path.length) {
      const value = get(next, watch.path)
      if (shallowEqual(value, watch.last)) continue
      watch.last = value
    }
    for (const listener of [...watch.listeners]) listener.next()
  }
}

function watchPath(watched: Map<string, Watch>, path: string[], root: unknown, listener: Listener): Watch {
  const key = path.join(".")
  let watch = watched.get(key)
  if (!watch) {
    watch = { path, last: path.length ? get(root, path) : undefined, listeners: new Set() }
    watched.set(key, watch)
  }
  watch.listeners.add(listener)
  return watch
}
/** One computation in flight: where its reads are collected, and its edge rule if it has one. */
type Frame = { collect(signal: Signal<unknown>): void; edge?(node: Signal<unknown>, version: number): boolean }
const frames: Frame[] = []

let signalSeq = 0

// One root write emits into every nested-path selector a memo subscribed to, and each delivery
// invalidates that memo separately. Recomputing inline ran a 50k-row sort once per dependency
// instead of once per write. The emit turn brackets `state$.next`, so an invalidation raised
// inside it records the memo and the drain runs each one exactly once, after the last delivery.
let emitDepth = 0
const pendingFlush = new Map<{ flush(): void }, number>()

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
          let due!: { flush(): void }
          let lowest = Infinity
          for (const [flush, rank] of pendingFlush) {
            if (rank < lowest) {
              lowest = rank
              due = flush
            }
          }
          pendingFlush.delete(due)
          due.flush()
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
  const { initialState, observable, event = false, createBase, host } = options

  // A source that multicasts itself and publishes its own writes needs no subject of its own.
  const state$ = host
    ? undefined
    : event || (observable && initialState === undefined)
      ? new Subject<T>()
      : new BehaviorSubject(initialState as T)
  let latest = initialState as T
  // Surrogate id of this tree and the count of writes to it: every child node shares both.
  const sid = ++signalSeq
  let version = 0
  // Paths a memo depends on, each with the listeners to tell and the value they last saw: a memo's
  // dependency edge is a set entry here instead of an RxJS subscription. Plain state and event
  // trees only; a tree fed by an observable keeps subscriptions.
  let watched: Map<string, Watch> | undefined

  // `from` is the path of the write that caused the emit, not of the subject, which always sits
  // at the root: the whole point of the record is naming which branch moved.
  const pushState = (next: T, from: string[] = ROOT_PATH) => {
    latest = next
    version++
    // A writable memo mirrors the value into its own holder before the emit, so the next run of
    // the body reads what was written as `prev`.
    host?.write(next)
    if (LOG.on) {
      LOG.emit(CAT_EMIT, "emit {path}", {
        path: from,
        observerCount: (state$ as Subject<T> | undefined)?.observers.length ?? 0,
      })
    }
    inEmitTurn(() => {
      if (host) host.publish(next)
      else state$!.next(next)
      if (watched) notifyWatches(watched, next)
    })
  }

  // If an observable source is provided, pipe it into the state
  const root$: Observable<T> = host
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

  // Reads and writes are per tree and take the node's path, so a node holds no closures of its own
  // beyond its accessor.
  const setAt = (path: string[], n: T) => {
    if (!LOG.on) return applySetAt(path, n)
    const started = performance.now()
    const hasSubscribers = ((state$ as Subject<T> | undefined)?.observers.length ?? 0) > 0 || activeSubs.length > 0
    const result = applySetAt(path, n)
    LOG.emit(CAT_WRITE, "write {path}", {
      path,
      depth: path.length,
      hasSubscribers,
      durationMs: performance.now() - started,
    })
    return result
  }

  const applySetAt = (path: string[], n: T) => {
    if (!path.length) return pushState(n, path)
    // Deep set with lodash on an immer draft
    const next = produce(((host ? host.read() : latest) || {}) as object, (draft: Draft<object>) => {
      set(draft, path, n)
    })
    return pushState(next as T, path)
  }

  // Immer-based setter for complex mutations
  const immerAt = (path: string[], recipe: (draft: Draft<T>) => ValidDraftReturn<Draft<T>>) => {
    const root = host ? host.read() : latest
    const curr = path.length ? get(root, path) : root
    if (isDraftable(curr)) return setAt(path, produce(curr as Draft<T>, recipe) as T)
  }

    // Getter - handles root, nested, and function values
  const getAt = (path: string[]): T => {
    const depth = path.length
    const root = host ? host.read() : latest
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

  const createProxy = (path: string[], base?: Base): Signal<T, Base> => {
    // The callable accessor: a read with no argument, a write with one.
    const selfFn = (...args: unknown[]) => {
      if (args.length) {
        setAt(path, args[0] as T)
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
      return getAt(path)
    }
    const depth = path.length

    let ID = ""

    // The $ accessor object - proxied to add BS methods lazily
    const $proxy = new Proxy(selfFn as unknown as Signal$<T, Base>, {
      get(target, p) {
        // Our custom properties
        if (p === "value") return getAt(path)
        if (p === "next") return (n: T) => setAt(path, n)
        if (p === "setImmer") return (recipe: (draft: Draft<T>) => ValidDraftReturn<Draft<T>>) => immerAt(path, recipe)
        if (p === "path") return path
        if (p === "sid") return sid
        if (p === "watch") {
          if (host && !path.length) return (listener: Listener) => host.watch(listener)
          if (observable) return undefined
          return (listener: Listener) => watchPath((watched ??= new Map()), path, latest, listener)
        }
        if (p === "watching") return watched?.get(path.join("."))?.listeners.size ?? 0

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
/** What a memo holds per dependency: its watch entry or its subscription, and for an event the
 * version it last saw and the run that saw it. */
type DependencyEntry = {
  sub: { unsubscribe(): void } | undefined
  watch?: Watch
  consumed: number
  consumedRun: number
}

function releaseDependency(entry: DependencyEntry, listener: Listener): void {
  entry.sub?.unsubscribe()
  if (entry.watch?.drop) entry.watch.drop(listener)
  else entry.watch?.listeners.delete(listener)
}

/** What a memo is to its signal tree: its value, its writes, and the memos that depend on it. */
export type MemoHost<T> = {
  read(): T
  write(next: T): void
  publish(next: T): void
  watch(listener: Listener): Watch
}

type Observer<T> = { next(value: T): void; error(error: unknown): void }

/**
 * One memo. A class so its behaviour lives on the prototype: an instance is its fields, and it is
 * its own frame (`collect`, `edge`), its own dependency listener (`next`) and its own flush key.
 */
class Computed<T> implements MemoHost<T> {
  readonly id = ++computedSeq
  dirty = true
  running = false
  // A stream that completed asks for another run, and the loop in `recompute` serves it.
  rerun = false
  streamed = false
  lastRunFailed = false
  subscriberCount = 0
  readPinned = false
  // `recompute("read")` clears `dirty` and notifies nobody, so a downstream pull between an
  // invalidation and its drain would otherwise starve every subscriber of this memo.
  pushOwed = false
  rank = 0
  // Counts emissions so a flush can tell whether the run it just made already published.
  emitVersion = 0
  // Runs of the body, so an event read twice in one run answers the same both times.
  run = 0
  // Identity of the run that opened the live stream: a late `complete` from a cancelled run is quiet.
  token = 0
  // A dependency replays its value on subscribe; that value is the one just read, not a change.
  subscribing = false
  observers: Set<Observer<T>> | undefined = undefined
  // Keyed by dependency so a recompute diffs instead of rebuilding. Made on the first dependency.
  dependencySubs: Map<Signal<unknown>, DependencyEntry> | undefined = undefined
  // The dependencies the run in flight has read.
  reading: Set<Signal<unknown>> | undefined = undefined
  inner: { unsubscribe(): void } | undefined = undefined
  // Memos that depend on this one: while any listens, this memo counts as subscribed once.
  dependents: Watch | undefined = undefined

  constructor(
    readonly compute: ComputeBody<T>,
    public value: T,
    public hasValue: boolean,
    readonly writable: boolean,
  ) {}

  collect(dependency: Signal<unknown>): void {
    this.reading!.add(dependency)
  }

  // An event's edge state rides the dependency entry: the version this memo last saw and the run that
  // saw it. A first read makes the entry; `syncDependencies` subscribes it.
  edge(node: Signal<unknown>, version: number): boolean {
    let entry = this.dependencySubs?.get(node)
    if (!entry) {
      entry = { sub: undefined, consumed: -1, consumedRun: -1 }
      ;(this.dependencySubs ??= new Map()).set(node, entry)
    }
    if (entry.consumed === version) return entry.consumedRun === this.run
    entry.consumed = version
    entry.consumedRun = this.run
    return true
  }

  /** A dependency changed. */
  next(): void {
    if (!this.subscribing) this.invalidate()
  }

  clearDependencies(): void {
    if (!this.dependencySubs) return
    for (const [dependency, entry] of this.dependencySubs) {
      releaseDependency(entry, this)
      if (LOG.on) LOG.emit(CAT_UNSUBSCRIBE, "unsubscribe {id} {path}", { id: `memo#${this.id}`, path: dependency.$.path })
    }
    this.dependencySubs.clear()
  }

  cancelInner(): void {
    this.token++
    this.inner?.unsubscribe()
    this.inner = undefined
  }

  // Downstream recomputation may unsubscribe and resubscribe while handling this emission: iterate
  // snapshots so a newly added observer is not visited again in the same pass.
  publish(next: T): void {
    this.emitVersion++
    if (this.observers) for (const observer of [...this.observers]) observer.next(next)
    if (this.dependents) for (const listener of [...this.dependents.listeners]) listener.next()
  }

  write(next: T): void {
    if (!this.writable) return
    this.value = next
    this.hasValue = true
  }

  watch(listener: Listener): Watch {
    const dependents = (this.dependents ??= {
      path: ROOT_PATH,
      last: undefined,
      listeners: new Set(),
      drop: gone => {
        if (!dependents.listeners.delete(gone) || dependents.listeners.size) return
        this.subscriberCount--
        this.releaseIfUnwatched()
      },
    })
    if (!dependents.listeners.size) {
      this.subscriberCount++
      this.readPinned = false
    }
    dependents.listeners.add(listener)
    return dependents
  }

  releaseIfUnwatched(): void {
    if (this.subscriberCount || this.readPinned) return
    this.cancelInner()
    this.clearDependencies()
    this.dirty = true
  }

  // Returns the diff size so a compute record can say how much of the wiring actually moved.
  syncDependencies(deps: Set<Signal<unknown>>): { added: number; removed: number } {
    let added = 0
    let removed = 0
    const held = this.dependencySubs
    if (held) for (const [dependency, entry] of held) {
      if (deps.has(dependency)) continue
      releaseDependency(entry, this)
      held.delete(dependency)
      removed++
      if (LOG.on) LOG.emit(CAT_UNSUBSCRIBE, "unsubscribe {id} {path}", { id: `memo#${this.id}`, path: dependency.$.path })
    }
    for (const dependency of deps) {
      const entry = this.dependencySubs?.get(dependency)
      if (entry?.sub || entry?.watch) continue
      const watchHere = LOG.on ? undefined : (dependency.$ as unknown as { watch?: (listener: Listener) => Watch }).watch
      let sub: { unsubscribe(): void } | undefined
      let watch: Watch | undefined
      if (watchHere) watch = watchHere(this)
      else {
        this.subscribing = true
        sub = dependency.$.subscribe(LOG.on ? { next: () => this.subscribing || this.invalidate(dependency) } : this)
        this.subscribing = false
      }
      if (entry) {
        entry.sub = sub
        entry.watch = watch
      } else (this.dependencySubs ??= new Map()).set(dependency, { sub, watch, consumed: -1, consumedRun: -1 })
      added++
      if (LOG.on) LOG.emit(CAT_SUBSCRIBE, "subscribe {id} {path}", { id: `memo#${this.id}`, path: dependency.$.path })
    }
    return { added, removed }
  }

  recompute(trigger: "read" | "invalidate"): T {
    if (this.running) return this.value
    this.running = true

    do {
      this.rerun = false
      this.cancelInner()
      const started = LOG.on ? performance.now() : 0
      const dependencies = (this.reading = new Set<Signal<unknown>>())
      frames.push(this)
      this.run++
      computingRanks.push(0)

      const report = (diff: { added: number; removed: number }) => {
        if (!LOG.on) return
        LOG.emit(CAT_COMPUTE, "compute {id} {durationMs}ms", {
          id: `memo#${this.id}`,
          durationMs: performance.now() - started,
          depCount: dependencies.size,
          depsAdded: diff.added,
          depsRemoved: diff.removed,
          trigger,
        })
      }

      let out: ComputeResult<T>
      try {
        out = this.compute(this.value)
      } catch (error) {
        frames.pop()
        this.rank = computingRanks.pop()!
        this.running = false
        this.dirty = true
        this.lastRunFailed = true
        this.reading = undefined
        // Preserve the dependencies read before the throw so a later change can recover the memo.
        // A failed recomputation is not an Observable error: it must not permanently terminate
        // this or any composed memo.
        report(this.syncDependencies(dependencies))
        if (this.hasValue) return this.value
        throw error
      }

      frames.pop()
      this.rank = computingRanks.pop()!
      this.dirty = false
      this.lastRunFailed = false
      this.reading = undefined
      report(this.syncDependencies(dependencies))

      this.streamed = isStream(out)
      if (!this.streamed) {
        this.value = out as T
        this.hasValue = true
        break
      }

      const mine = ++this.token
      let emitted = false
      const sub = streamOf(out as Observable<T>).subscribe({
        next: next => {
          emitted = true
          this.value = next
          this.hasValue = true
          this.publish(next)
        },
        error: error => {
          if (this.observers) for (const observer of [...this.observers]) observer.error(error)
        },
        complete: () => {
          // A run whose token moved on was cancelled, and a stream that emitted nothing settles.
          if (this.token !== mine || !emitted) return
          this.inner = undefined
          if (this.running) this.rerun = true
          else this.invalidate()
        },
      })
      if (this.token === mine && !sub.closed) this.inner = sub
    } while (this.rerun)

    this.running = false
    return this.value
  }

  invalidate(by?: Signal<unknown>): void {
    this.dirty = true
    const eager = !!this.subscriberCount && !this.running
    if (LOG.on) {
      LOG.emit(CAT_INVALIDATE, "invalidate {id} by {by}", { id: `memo#${this.id}`, by: by ? by.$.path : null, eager })
    }
    if (!eager) return
    this.pushOwed = true
    // Inside an emit turn every sibling selector is still delivering. Recompute once at the end.
    if (emitDepth > 0) {
      pendingFlush.set(this, this.rank)
      return
    }
    // An observable-backed dependency emits outside any turn, so the fan-out opens one.
    inEmitTurn(() => this.flush())
  }

  flush(): void {
    if (!this.dirty && !this.pushOwed) return
    this.pushOwed = false
    const before = this.emitVersion
    const next = this.dirty ? this.recompute("invalidate") : this.value
    // A stream run publishes from its inner, so the seed surfaces only on first subscribe.
    if (!this.lastRunFailed && !this.streamed && before === this.emitVersion) this.publish(next)
  }

  read(): T {
    // A read pins only while nobody subscribes, so a memo used purely by `.$()` stays wired and
    // memoized. Subscribers own the lifetime once present, and the last one leaving releases it.
    if (!this.subscriberCount) this.readPinned = true
    const result = this.dirty || !this.hasValue ? this.recompute("read") : this.value
    const frame = computingRanks.length - 1
    if (frame >= 0) computingRanks[frame] = Math.max(computingRanks[frame], this.rank + 1)
    return result
  }

  attach(subscriber: Observer<T>): (() => void) | undefined {
    this.subscriberCount++
    this.readPinned = false
    ;(this.observers ??= new Set()).add(subscriber)
    try {
      const before = this.emitVersion
      const next = this.dirty || !this.hasValue ? this.recompute("read") : this.value
      if (before === this.emitVersion) subscriber.next(next)
    } catch (error) {
      this.observers.delete(subscriber)
      this.subscriberCount--
      subscriber.error(error)
      return undefined
    }
    return () => {
      this.observers!.delete(subscriber)
      this.subscriberCount--
      this.releaseIfUnwatched()
    }
  }
}

export function createComputedSignal<T>(compute: ComputeBody<T>, seed?: T, options: ComputedOptions = {}): Signal<T> {
  const memo = new Computed(compute, seed as T, arguments.length >= 2, options.writable !== false)
  // The memo multicasts itself and replays its value on subscribe, so a write publishes straight to
  // its observers instead of through a subject merged into a second shared stream.
  return SignalCreator({ observable: new Observable<T>(subscriber => memo.attach(subscriber)), host: memo })
}
