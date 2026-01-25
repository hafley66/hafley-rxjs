/**
 * Diet RxJS - minimal Observable/Subject/BehaviorSubject for bootstrapping
 * devtools without circular dependency on real RxJS.
 *
 * No finalizers, no schedulers, no fancy teardown. Just pub/sub with pipe.
 */
// noRxjs()
import { cloneDeep } from "lodash"

export interface DietSubscription {
  unsubscribe(): void
  closed: boolean
}

export interface DietObserver<T> {
  next?: (value: T) => void
  error?: (err: unknown) => void
  complete?: () => void
}

type NextFn<T> = (value: T) => void
type SubscribeArg<T> = DietObserver<T> | NextFn<T> | null | undefined

function toObserver<T>(arg: SubscribeArg<T>): DietObserver<T> {
  if (!arg) return {}
  if (typeof arg === "function") return { next: arg }
  return arg
}

export type DietOperator<T, R> = (source: DietObservable<T>) => DietObservable<R>

export class DietObservable<T> {
  constructor(protected _subscribe?: (observer: DietObserver<T>) => (() => void) | void) {}

  subscribe(observerOrNext?: SubscribeArg<T>): DietSubscription {
    const observer = toObserver(observerOrNext)
    let closed = false
    const teardown = this._subscribe?.({
      next: v => !closed && observer.next?.(v),
      error: e => !closed && observer.error?.(e),
      complete: () => !closed && observer.complete?.(),
    })

    return {
      get closed() {
        return closed
      },
      unsubscribe() {
        if (closed) return
        closed = true
        teardown?.()
      },
    }
  }

  pipe(): DietObservable<T>
  pipe<A>(op1: DietOperator<T, A>): DietObservable<A>
  pipe<A, B>(op1: DietOperator<T, A>, op2: DietOperator<A, B>): DietObservable<B>
  pipe<A, B, C>(op1: DietOperator<T, A>, op2: DietOperator<A, B>, op3: DietOperator<B, C>): DietObservable<C>
  pipe<A, B, C, D>(
    op1: DietOperator<T, A>,
    op2: DietOperator<A, B>,
    op3: DietOperator<B, C>,
    op4: DietOperator<C, D>,
  ): DietObservable<D>
  pipe(...ops: DietOperator<unknown, unknown>[]): DietObservable<unknown> {
    if (ops.length === 1 && ops[0]) return ops[0](this)
    return ops.reduce((source, op) => op(source), this as DietObservable<unknown>)
  }
}

export class DietSubject<T> extends DietObservable<T> {
  observers: Set<DietObserver<T>> = new Set()
  isStopped = false
  hasError = false
  thrownError: unknown = null

  constructor() {
    super()
  }

  override subscribe(observerOrNext?: SubscribeArg<T>): DietSubscription {
    const observer = toObserver(observerOrNext)
    let closed = false

    const wrappedObserver: DietObserver<T> = {
      next: v => !closed && observer.next?.(v),
      error: e => !closed && observer.error?.(e),
      complete: () => !closed && observer.complete?.(),
    }

    if (this.hasError) {
      wrappedObserver.error?.(this.thrownError)
      return { closed: true, unsubscribe() {} }
    }
    if (this.isStopped) {
      wrappedObserver.complete?.()
      return { closed: true, unsubscribe() {} }
    }

    this.observers.add(wrappedObserver)

    return {
      get closed() {
        return closed
      },
      unsubscribe: () => {
        if (closed) {
          console.log(new Error().stack)
          console.log("already closed")

          return
        }
        console.log(new Error().stack)
        console.log("Closing")
        closed = true
        this.observers.delete(wrappedObserver)
      },
    }
  }

  next(value: T) {
    if (this.isStopped) return
    for (const obs of this.observers) {
      obs.next?.(value)
    }
  }

  error(err: unknown) {
    if (this.isStopped) return
    this.hasError = true
    this.thrownError = err
    this.isStopped = true
    for (const obs of this.observers) {
      obs.error?.(err)
    }
    this.observers.clear()
  }

  complete() {
    if (this.isStopped) return
    this.isStopped = true
    for (const obs of this.observers) {
      obs.complete?.()
    }
    this.observers.clear()
  }

  asObservable(): DietObservable<T> {
    return new DietObservable(observer => {
      const sub = this.subscribe(observer)
      return () => sub.unsubscribe()
    })
  }
}

export class DietBehaviorSubject<T> extends DietSubject<T> {
  _value: T

  constructor(initialValue: T) {
    super()
    this._value = initialValue
  }

  override subscribe(observerOrNext?: SubscribeArg<T>): DietSubscription {
    const observer = toObserver(observerOrNext)

    // Emit current value synchronously before setting up subscription
    if (!this.hasError && !this.isStopped) {
      observer.next?.(this._value)
    }

    return super.subscribe(observer)
  }

  override next(value: T) {
    this._value = value
    super.next(value)
  }

  getValue(): T {
    if (this.hasError) throw this.thrownError
    return this._value
  }

  get value(): T {
    return this.getValue()
  }
}

// Common operators you might need for bootstrapping

export function dietMap<T, R>(project: (value: T, index: number) => R): DietOperator<T, R> {
  return source =>
    new DietObservable(observer => {
      let i = 0
      const sub = source.subscribe({
        next: v => observer.next?.(project(v, i++)),
        error: e => observer.error?.(e),
        complete: () => observer.complete?.(),
      })
      return () => sub.unsubscribe()
    })
}

export function dietFilter<T>(predicate: (value: T, index: number) => boolean): DietOperator<T, T> {
  return source =>
    new DietObservable(observer => {
      let i = 0
      const sub = source.subscribe({
        next: v => predicate(v, i++) && observer.next?.(v),
        error: e => observer.error?.(e),
        complete: () => observer.complete?.(),
      })
      return () => sub.unsubscribe()
    })
}

export function dietTake<T>(count: number): DietOperator<T, T> {
  return source =>
    new DietObservable(observer => {
      let seen = 0
      const sub = source.subscribe({
        next: v => {
          if (seen < count) {
            seen++
            observer.next?.(v)
            if (seen >= count) {
              observer.complete?.()
              sub.unsubscribe()
            }
          }
        },
        error: e => observer.error?.(e),
        complete: () => observer.complete?.(),
      })
      return () => sub.unsubscribe()
    })
}

export function dietDistinctUntilChanged<T>(
  compare: (prev: T, curr: T) => boolean = (a, b) => a === b,
): DietOperator<T, T> {
  return source =>
    new DietObservable(observer => {
      let hasPrev = false
      let prev: T
      const sub = source.subscribe({
        next: v => {
          if (!hasPrev || !compare(prev, v)) {
            hasPrev = true
            prev = v
            observer.next?.(v)
          }
        },
        error: e => observer.error?.(e),
        complete: () => observer.complete?.(),
      })
      return () => sub.unsubscribe()
    })
}

export function dietShareRefCount<T>(): DietOperator<T, T> {
  let refCount = 0
  let sourceSub: DietSubscription | null = null
  const observers: Set<DietObserver<T>> = new Set()

  return source =>
    new DietObservable(observer => {
      refCount++
      observers.add(observer)

      if (refCount === 1) {
        sourceSub = source.subscribe({
          next: v => {
            for (const obs of observers) obs.next?.(v)
          },
          error: e => {
            for (const obs of observers) obs.error?.(e)
          },
          complete: () => {
            for (const obs of observers) obs.complete?.()
          },
        })
      }

      return () => {
        refCount--
        observers.delete(observer)
        if (refCount === 0) {
          sourceSub?.unsubscribe()
          sourceSub = null
        }
      }
    })
}
/**
 * ReplaySubject that resets after complete/error.
 * - Replays buffered values to new subscribers
 * - complete()/error() notifies current observers, clears them, then resets subject state
 * - Subject stays alive for future subscriptions
 */
export class DietReplaySubject<T> extends DietObservable<T> {
  observers: Set<DietObserver<T>> = new Set()
  buffer: T[] = []

  constructor(public bufferSize = Infinity) {
    super()
  }

  override subscribe(observerOrNext?: SubscribeArg<T>): DietSubscription {
    const observer = toObserver(observerOrNext)
    let closed = false

    const wrappedObserver: DietObserver<T> = {
      next: v => !closed && observer.next?.(v),
      error: e => !closed && observer.error?.(e),
      complete: () => !closed && observer.complete?.(),
    }

    // Replay buffer
    for (const val of this.buffer) {
      wrappedObserver.next?.(val)
    }

    this.observers.add(wrappedObserver)

    return {
      get closed() {
        return closed
      },
      unsubscribe: () => {
        if (closed) return
        closed = true
        this.observers.delete(wrappedObserver)
      },
    }
  }

  next(value: T) {
    this.buffer.push(value)
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift()
    }
    for (const obs of this.observers) {
      obs.next?.(value)
    }
  }

  error(err: unknown) {
    for (const obs of this.observers) {
      obs.error?.(err)
    }
    this.observers.clear()
    this.buffer = []
  }

  complete() {
    for (const obs of this.observers) {
      obs.complete?.()
    }
    this.observers.clear()
    this.buffer = []
  }

  asObservable(): DietObservable<T> {
    return new DietObservable(observer => {
      const sub = this.subscribe(observer)
      return () => sub.unsubscribe()
    })
  }
}

export class EasierDietBS<T extends {}> extends DietBehaviorSubject<T> {
  initialValue: T
  safeInitialClone: T
  constructor(initialValue: T) {
    super(initialValue)
    this.initialValue = cloneDeep(initialValue)
    this.safeInitialClone = cloneDeep(this.initialValue)
  }

  set(partial: Partial<T>) {
    return this.next({
      ...this.value,
      ...partial,
    })
  }

  reset$ = new DietSubject<null>()

  reset() {
    console.log("Resetting?")
    return this.reset$.next(null)
  }

  scanEager<Next>(accumulator: (sum: T, next: Next) => T) {
    return (source$: DietObservable<Next>): DietObservable<T> => {
      return new DietObservable<T>(observer => {
        let sourceSub: DietSubscription | null = null
        let i = 0
        const setupSource = () => {
          console.log("SETTING UP", i++)
          sourceSub?.unsubscribe()
          const initClone = cloneDeep(this.initialValue)
          this.next(initClone)
          observer.next?.(initClone)

          sourceSub = source$.subscribe({
            next: val => {
              const result = accumulator(this.value, val)
              this.next(result)
              observer.next?.(result)
            },
            error: e => observer.error?.(e),
          })
        }

        console.log("Initial setup (equivalent to startWith(null) triggering first switchMap)")
        setupSource()

        // On reset, tear down and re-setup (switchMap behavior)
        const resetSub = this.reset$.subscribe(() => {
          console.log("Fuckers ")
          setupSource()
        })

        return () => {
          console.log("Fucking wait what")
          sourceSub?.unsubscribe()
          resetSub.unsubscribe()
        }
      })
    }
  }
}
