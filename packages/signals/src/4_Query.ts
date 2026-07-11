import {
  EMPTY,
  Observable,
  ReplaySubject,
  Subject,
  concat,
  defer,
  filter,
  map,
  materialize,
  merge,
  of,
  scan,
  share,
  startWith,
  switchMap,
  type Notification,
} from "rxjs"
import type { Signal as SignalType } from "./0_types.js"
import { Signal, toSignal, type SignalSource } from "./2_Signal.js"
import type { Endpoint } from "./3_Endpoint.js"

export type AsyncStatus = "idle" | "loading" | "success" | "error"

export type QueryState<T, E = unknown> = {
  data?: T
  error?: E
  status: AsyncStatus
  isLoading: boolean
  isLoadingEmpty: boolean
  isSuccess: boolean
  isError: boolean
  isStale: boolean
  updatedAt?: number
}

export type QueryOptions = {
  staleTime?: number
  cacheTime?: number
  skip?: "clear" | "retain"
  now?: () => number
}

export type Query<I, O, E = unknown> = SignalType<QueryState<O, E>> & {
  input: SignalType<I | undefined>
  refetch: () => void
  invalidate: () => void
  clear: () => void
}

export type Mutation<I, O, E = unknown> = SignalType<QueryState<O, E>> & {
  input: SignalType<I | undefined>
  clear: () => void
}

const idle = <T, E>(): QueryState<T, E> => ({
  status: "idle",
  isLoading: false,
  isLoadingEmpty: false,
  isSuccess: false,
  isError: false,
  isStale: false,
})

type RequestEvent<T> =
  | { type: "start" }
  | { type: "notification"; value: Notification<T> }
  | { type: "invalidate" }
  | { type: "clear" }

function reduceState<T, E>(
  state: QueryState<T, E>,
  event: RequestEvent<T>,
  now: () => number,
): QueryState<T, E> {
  if (event.type === "clear") return idle()
  if (event.type === "invalidate") return { ...state, isStale: true }
  if (event.type === "start") {
    const hasData = state.data !== undefined
    return {
      ...state,
      error: undefined,
      status: hasData ? state.status : "loading",
      isLoading: true,
      isLoadingEmpty: !hasData,
      isError: false,
      isStale: hasData ? state.isStale : false,
    }
  }

  const notification = event.value
  if (notification.kind === "N") {
    return {
      data: notification.value,
      error: undefined,
      status: "success",
      isLoading: false,
      isLoadingEmpty: false,
      isSuccess: true,
      isError: false,
      isStale: false,
      updatedAt: now(),
    }
  }
  if (notification.kind === "E") {
    return {
      ...state,
      error: notification.error as E,
      status: "error",
      isLoading: false,
      isLoadingEmpty: false,
      isSuccess: state.data !== undefined,
      isError: true,
    }
  }
  return state
}

const requestEvents = <I, O>(endpoint: Endpoint<I, O>, input: I) => concat(
  of<RequestEvent<O>>({ type: "start" }),
  endpoint.execute(input).pipe(
    materialize(),
    map((value) => ({ type: "notification", value }) as RequestEvent<O>),
  ),
)

type QueryEntry<T, E> = {
  state$: Observable<QueryState<T, E>>
  current: QueryState<T, E>
  refetch: () => void
  invalidate: () => void
}

const endpointCaches = new WeakMap<object, Map<string, QueryEntry<unknown, unknown>>>()

function queryCache(endpoint: object) {
  let cache = endpointCaches.get(endpoint)
  if (!cache) {
    cache = new Map()
    endpointCaches.set(endpoint, cache)
  }
  return cache
}

function getQueryEntry<I, O, E>(
  endpoint: Endpoint<I, O>,
  input: I,
  options: Required<QueryOptions>,
): QueryEntry<O, E> {
  const cache = queryCache(endpoint)
  const key = endpoint.key(input)
  const found = cache.get(key) as QueryEntry<O, E> | undefined
  if (found) return found

  const command = new Subject<"refetch" | "invalidate">()
  const entry: QueryEntry<O, E> = {
    current: idle(),
    state$: EMPTY,
    refetch: () => command.next("refetch"),
    invalidate: () => {
      command.next("invalidate")
      command.next("refetch")
    },
  }

  const state$ = defer(() => {
    const fresh = entry.current.updatedAt !== undefined &&
      options.now() - entry.current.updatedAt < options.staleTime
    const initialFetch$ = entry.current.status === "idle" || !fresh
      ? of("refetch" as const)
      : EMPTY
    const fetchEvents$ = merge(
      initialFetch$,
      command.pipe(filter((value) => value === "refetch")),
    ).pipe(
      // One query key represents one current request/response cycle. A new
      // refetch cancels the previous cycle; concurrency is deliberately not
      // part of createQuery.
      switchMap(() => requestEvents(endpoint, input)),
    )
    const invalidated$ = command.pipe(
      filter((value) => value === "invalidate"),
      map(() => ({ type: "invalidate" }) as RequestEvent<O>),
    )

    return merge(fetchEvents$, invalidated$).pipe(
      scan(
        (state, event) => reduceState<O, E>(state, event, options.now),
        entry.current,
      ),
      startWith(entry.current),
      map((state) => (entry.current = state)),
    )
  }).pipe(
    share({
      connector: () => new ReplaySubject<QueryState<O, E>>(1),
      resetOnError: true,
      resetOnComplete: false,
      // Request ownership follows active observers. Cached knowledge lives in
      // entry.current below, not in a secretly still-running transport.
      resetOnRefCountZero: true,
    }),
  )

  let refs = 0
  let gc: ReturnType<typeof setTimeout> | undefined
  entry.state$ = new Observable<QueryState<O, E>>((subscriber) => {
    refs++
    if (gc) clearTimeout(gc)
    gc = undefined
    const sub = state$.subscribe(subscriber)
    return () => {
      sub.unsubscribe()
      refs--
      if (!refs && options.cacheTime !== Infinity) {
        gc = setTimeout(() => {
          if (!refs) cache.delete(key)
        }, options.cacheTime)
      }
    }
  })

  cache.set(key, entry as QueryEntry<unknown, unknown>)
  return entry
}

export function createQuery<I, O, E = unknown>(
  endpoint: Endpoint<I, O>,
  source: SignalSource<I | undefined>,
  config: QueryOptions = {},
): Query<I, O, E> {
  const input = toSignal(source)
  const options: Required<QueryOptions> = {
    staleTime: config.staleTime ?? 0,
    cacheTime: config.cacheTime ?? 5 * 60_000,
    skip: config.skip ?? "clear",
    now: config.now ?? Date.now,
  }
  let activeEntry: QueryEntry<O, E> | undefined
  let retained = idle<O, E>()

  const state$ = input.$.pipe(
    switchMap((nextInput) => {
      if (nextInput === undefined) {
        activeEntry = undefined
        return of(options.skip === "retain" ? retained : idle<O, E>())
      }

      const entry = getQueryEntry<I, O, E>(endpoint, nextInput, options)
      activeEntry = entry
      return entry.state$.pipe(map((state) => (retained = state)))
    }),
  )

  const query = Signal(state$, idle<O, E>()) as Query<I, O, E>
  return Object.assign(query, {
    input,
    refetch: () => activeEntry?.refetch(),
    invalidate: () => activeEntry?.invalidate(),
    clear: () => input.$(undefined),
  })
}

export function createMutation<I, O, E = unknown>(
  endpoint: Endpoint<I, O>,
  source?: SignalSource<I | undefined>,
): Mutation<I, O, E> {
  const input = source === undefined
    ? Signal<I | undefined>(undefined)
    : toSignal(source)

  const state$ = input.$.pipe(
    switchMap((nextInput) => nextInput === undefined
      ? of<RequestEvent<O>>({ type: "clear" })
      : requestEvents(endpoint, nextInput)),
    scan(
      (state, event) => reduceState<O, E>(state, event, Date.now),
      idle<O, E>(),
    ),
  )

  const mutation = Signal(state$, idle<O, E>()) as Mutation<I, O, E>
  return Object.assign(mutation, {
    input,
    clear: () => input.$(undefined),
  })
}
