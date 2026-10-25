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
