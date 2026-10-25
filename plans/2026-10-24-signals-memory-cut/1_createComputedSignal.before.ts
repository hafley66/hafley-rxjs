export function createComputedSignal<T>(compute: ComputeBody<T>, seed?: T, options: ComputedOptions = {}): Signal<T> {
  const id = ++computedSeq
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

  // Made on first subscribe: a memo nobody watches holds no set.
  let observers: Set<{ next(value: T): void; error(error: unknown): void }> | undefined
  // Runs of the body, so an event read twice in one run answers the same both times.
  let run = 0
  // An event's edge state rides the dependency entry the memo already keeps for it: the version it
  // last saw and the run that saw it. A first read makes the entry; `syncDependencies` subscribes it.
  const edge: EdgeReader = (node, version) => {
    let entry = dependencySubs?.get(node)
    if (!entry) {
      entry = { sub: undefined, consumed: -1, consumedRun: -1 }
      ;(dependencySubs ??= new Map()).set(node, entry)
    }
    if (entry.consumed === version) return entry.consumedRun === run
    entry.consumed = version
    entry.consumedRun = run
    return true
  }
  // Keyed by dependency so a recompute diffs instead of rebuilding: tearing every subscription
  // down and re-adding it re-emitted every BehaviorSubject on the way back in.
  // Made on the first dependency: a memo that reads nothing holds no map.
  let dependencySubs: Map<Signal<unknown>, DependencyEntry> | undefined
  // The live stream result, and the identity of the run that opened it. A late `complete` from a
  // cancelled run compares tokens and stays quiet.
  let inner: { unsubscribe(): void } | undefined
  let token = 0

  const clearDependencies = () => {
    if (!dependencySubs) return
    for (const [dependency, entry] of dependencySubs) {
      releaseDependency(entry, onDependency)
      if (LOG.on) LOG.emit(CAT_UNSUBSCRIBE, "unsubscribe {id} {path}", { id: `memo#${id}`, path: dependency.$.path })
    }
    dependencySubs.clear()
  }

  const cancelInner = () => {
    token++
    inner?.unsubscribe()
    inner = undefined
  }

  // Downstream recomputation may unsubscribe and resubscribe while handling this emission. Iterate
  // a snapshot so a newly added observer is not visited again in the same Set iteration.
  const emit = (next: T) => {
    emitVersion++
    if (observers) for (const observer of [...observers]) observer.next(next)
    if (watch) for (const listener of [...watch.listeners]) listener.next()
  }

  // One observer for every dependency, so a dependency costs its subscription and nothing more.
  let subscribing = false
  const onDependency = { next: () => subscribing || invalidate() }

  // Memos that depend on this one, held as a watch instead of RxJS subscriptions: while any is
  // listening the memo counts as subscribed once.
  let watch: Watch | undefined
  const watchRoot = (listener: Listener): Watch => {
    watch ??= {
      path: ROOT_PATH,
      last: undefined,
      listeners: new Set(),
      drop: gone => {
        if (!watch!.listeners.delete(gone) || watch!.listeners.size) return
        subscriberCount--
        if (!subscriberCount && !readPinned) {
          cancelInner()
          clearDependencies()
          dirty = true
        }
      },
    }
    if (!watch.listeners.size) {
      subscriberCount++
      readPinned = false
    }
    watch.listeners.add(listener)
    return watch
  }

  // Returns the diff size so a compute record can say how much of the wiring actually moved.
  const syncDependencies = (deps: Set<Signal<unknown>>) => {
    let added = 0
    let removed = 0
    if (dependencySubs) for (const [dependency, entry] of dependencySubs) {
      if (deps.has(dependency)) continue
      releaseDependency(entry, onDependency)
      dependencySubs.delete(dependency)
      removed++
      if (LOG.on) LOG.emit(CAT_UNSUBSCRIBE, "unsubscribe {id} {path}", { id: `memo#${id}`, path: dependency.$.path })
    }
    for (const dependency of deps) {
      const held = dependencySubs?.get(dependency)
      if (held?.sub || held?.watch) continue
      const watchHere = LOG.on ? undefined : (dependency.$ as unknown as { watch?: (listener: Listener) => Watch }).watch
      let sub: { unsubscribe(): void } | undefined
      let watch: Watch | undefined
      if (watchHere) watch = watchHere(onDependency)
      else {
        // A dependency replays its value on subscribe; that value is the one just read, not a change.
        subscribing = true
        sub = dependency.$.subscribe(LOG.on ? { next: () => subscribing || invalidate(dependency) } : onDependency)
        subscribing = false
      }
      if (held) {
        held.sub = sub
        held.watch = watch
      } else (dependencySubs ??= new Map()).set(dependency, { sub, watch, consumed: -1, consumedRun: -1 })
      added++
      if (LOG.on) LOG.emit(CAT_SUBSCRIBE, "subscribe {id} {path}", { id: `memo#${id}`, path: dependency.$.path })
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
          id: `memo#${id}`,
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

      const mine = ++token
      let emitted = false
      const sub = streamOf(out as Observable<T>).subscribe({
        next: next => {
          emitted = true
          value = next
          hasValue = true
          emit(next)
        },
        error: error => {
          if (observers) for (const observer of [...observers]) observer.error(error)
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
      LOG.emit(CAT_INVALIDATE, "invalidate {id} by {by}", { id: `memo#${id}`, by: by ? by.$.path : null, eager })
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
    ;(observers ??= new Set()).add(subscriber)

    try {
      const before = emitVersion
      const next = dirty || !hasValue ? recompute("read") : value
      if (before === emitVersion) subscriber.next(next)
    } catch (error) {
      observers!.delete(subscriber)
      subscriberCount--
      subscriber.error(error)
      return undefined
    }

    return () => {
      observers!.delete(subscriber)
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
  return SignalCreator({ observable, read: readMemo, write, publish: emit, watchRoot })
}
